import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import Stripe from "stripe";
import OpenAI from "openai";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import { insertUserSchema, insertChoreSchema, insertMessageSchema, insertNegotiationSchema, insertPaymentSchema } from "@shared/schema";
import { z } from "zod";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2023-10-16",
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
});

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "earn-it-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Passport configuration
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== password) {
        return done(null, false, { message: 'Invalid credentials' });
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// WebSocket connections storage
const wsConnections = new Map<number, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware
  app.use(session(sessionConfig));
  app.use(passport.initialize());
  app.use(passport.session());

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Authentication required" });
  };

  // Auth routes
  app.post("/api/auth/login", passport.authenticate('local'), (req: any, res) => {
    res.json({ user: req.user });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      const user = await storage.createUser(userData);
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        res.json({ user });
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, (req: any, res) => {
    res.json({ user: req.user });
  });

  // User routes
  app.get("/api/users/family", requireAuth, async (req: any, res) => {
    try {
      const users = await storage.getUsersByFamily(req.user.familyId);
      res.json(users.map(user => ({ ...user, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (id !== req.user.id && req.user.role !== "parent") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updates = req.body;
      delete updates.password; // Don't allow password updates through this route
      
      const user = await storage.updateUser(id, updates);
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Chore routes
  app.get("/api/chores", requireAuth, async (req: any, res) => {
    try {
      const chores = await storage.getChoresByFamily(req.user.familyId);
      res.json(chores);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chores/kid/:kidId", requireAuth, async (req: any, res) => {
    try {
      const kidId = parseInt(req.params.kidId);
      const chores = await storage.getChoresByKid(kidId);
      res.json(chores);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chores/status/:status", requireAuth, async (req: any, res) => {
    try {
      const status = req.params.status;
      const chores = await storage.getChoresByStatus(req.user.familyId, status);
      res.json(chores);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chores", requireAuth, async (req: any, res) => {
    try {
      const choreData = insertChoreSchema.parse({
        ...req.body,
        familyId: req.user.familyId,
        kidId: req.body.kidId || req.user.id,
        parentId: req.user.role === "parent" ? req.user.id : null,
        assignedBy: req.user.role
      });
      
      const chore = await storage.createChore(choreData);
      
      // Broadcast to family members
      broadcastToFamily(req.user.familyId, {
        type: "chore_created",
        data: chore
      });
      
      res.json(chore);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/chores/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const chore = await storage.getChore(id);
      
      if (!chore || chore.familyId !== req.user.familyId) {
        return res.status(404).json({ message: "Chore not found" });
      }
      
      const updates = req.body;
      const updatedChore = await storage.updateChore(id, updates);
      
      // Broadcast update
      broadcastToFamily(req.user.familyId, {
        type: "chore_updated",
        data: updatedChore
      });
      
      res.json(updatedChore);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Start chore with time tracking
  app.post("/api/chores/:id/start", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const chore = await storage.getChore(id);
      
      if (!chore || chore.kidId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedChore = await storage.startChore(id);
      
      broadcastToFamily(req.user.familyId, {
        type: "chore_started",
        data: updatedChore
      });
      
      res.json(updatedChore);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Complete chore with time tracking and photo upload
  app.post("/api/chores/:id/complete", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { completionTimeMinutes, proofPhoto } = req.body;
      const chore = await storage.getChore(id);
      
      if (!chore || chore.kidId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedChore = await storage.completeChore(id, completionTimeMinutes, proofPhoto);
      
      // Broadcast completion
      broadcastToFamily(req.user.familyId, {
        type: "chore_completed",
        data: updatedChore
      });
      
      res.json(updatedChore);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chores/:id/approve", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const chore = await storage.getChore(id);
      
      if (!chore || req.user.role !== "parent") {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedChore = await storage.updateChore(id, {
        status: "approved_payment",
        approvedAt: new Date()
      });
      
      // Update kid's balance
      await storage.updateUserBalance(chore.kidId, chore.price);
      
      // Update kid's chore count
      const kid = await storage.getUser(chore.kidId);
      if (kid) {
        await storage.updateUser(chore.kidId, {
          choreCount: kid.choreCount + 1
        });
      }
      
      // Broadcast approval
      broadcastToFamily(req.user.familyId, {
        type: "chore_approved",
        data: updatedChore
      });
      
      res.json(updatedChore);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Negotiation routes
  app.post("/api/negotiations", requireAuth, async (req: any, res) => {
    try {
      const negotiationData = insertNegotiationSchema.parse({
        ...req.body,
        fromUserId: req.user.id
      });
      
      const negotiation = await storage.createNegotiation(negotiationData);
      
      // Update chore status to negotiating
      await storage.updateChore(negotiationData.choreId, {
        status: "negotiating"
      });
      
      // Broadcast negotiation
      broadcastToFamily(req.user.familyId, {
        type: "negotiation_created",
        data: negotiation
      });
      
      res.json(negotiation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/negotiations/chore/:choreId", requireAuth, async (req: any, res) => {
    try {
      const choreId = parseInt(req.params.choreId);
      const negotiations = await storage.getNegotiationsByChore(choreId);
      res.json(negotiations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Payment routes
  app.post("/api/create-payment-intent", requireAuth, async (req: any, res) => {
    try {
      const { amount, choreId } = req.body;
      
      if (req.user.role !== "parent") {
        return res.status(403).json({ message: "Only parents can create payments" });
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency: "usd",
      });
      
      // Create payment record
      await storage.createPayment({
        fromUserId: req.user.id,
        toUserId: req.body.toUserId,
        choreId: choreId || null,
        amount,
        method: "stripe",
        familyId: req.user.familyId
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  app.get("/api/payments", requireAuth, async (req: any, res) => {
    try {
      const payments = await storage.getPaymentsByFamily(req.user.familyId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Message routes
  app.post("/api/messages", requireAuth, async (req: any, res) => {
    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        fromUserId: req.user.id,
        familyId: req.user.familyId
      });
      
      const message = await storage.createMessage(messageData);
      
      // Broadcast message
      broadcastToFamily(req.user.familyId, {
        type: "new_message",
        data: message
      });
      
      res.json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/messages/family", requireAuth, async (req: any, res) => {
    try {
      const messages = await storage.getMessagesByFamily(req.user.familyId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/messages/chore/:choreId", requireAuth, async (req: any, res) => {
    try {
      const choreId = parseInt(req.params.choreId);
      const messages = await storage.getMessagesByChore(choreId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI Assistant routes
  app.post("/api/ai/tips", requireAuth, async (req: any, res) => {
    try {
      const { choreTitle, choreDescription } = req.body;
      
      const prompt = `You are EarnIt's helpful AI assistant for kids and families. Provide 3-5 practical, age-appropriate tips for completing this chore efficiently and safely: "${choreTitle}" - ${choreDescription}. Focus on being encouraging and educational. Respond with JSON in this format: { "tips": ["tip1", "tip2", "tip3"] }`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      
      const result = JSON.parse(response.choices[0].message.content || "{}");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "AI assistant unavailable: " + error.message });
    }
  });

  app.post("/api/ai/products", requireAuth, async (req: any, res) => {
    try {
      const { choreTitle, choreDescription } = req.body;
      
      const prompt = `You are EarnIt's AI assistant helping kids be more efficient with chores. Suggest 2-3 helpful, age-appropriate products or tools that could make this chore easier: "${choreTitle}" - ${choreDescription}. Include brief explanations of how each helps. Respond with JSON in this format: { "products": [{"name": "Product Name", "description": "How it helps", "category": "cleaning/organizing/outdoor/etc"}] }`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      
      const result = JSON.parse(response.choices[0].message.content || "{}");
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "AI assistant unavailable: " + error.message });
    }
  });

  // Analytics routes
  app.get("/api/analytics/family", requireAuth, async (req: any, res) => {
    try {
      const stats = await storage.getFamilyStats(req.user.familyId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    let userId: number | null = null;
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth' && message.userId) {
          userId = message.userId;
          wsConnections.set(userId, ws);
          ws.send(JSON.stringify({ type: 'auth_success' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      if (userId) {
        wsConnections.delete(userId);
      }
    });
  });

  // Helper function to broadcast to family members
  function broadcastToFamily(familyId: string, message: any) {
    storage.getUsersByFamily(familyId).then(users => {
      users.forEach(user => {
        const ws = wsConnections.get(user.id);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      });
    });
  }

  return httpServer;
}
