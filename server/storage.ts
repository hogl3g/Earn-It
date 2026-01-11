import { 
  users, chores, choreNegotiations, payments, messages, achievements,
  type User, type InsertUser, type Chore, type InsertChore, 
  type ChoreNegotiation, type InsertNegotiation, type Payment, type InsertPayment,
  type Message, type InsertMessage, type Achievement, type InsertAchievement
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getUsersByFamily(familyId: string): Promise<User[]>;
  updateUserBalance(id: number, amount: string): Promise<User>;
  
  // Chore operations
  getChore(id: number): Promise<Chore | undefined>;
  createChore(chore: InsertChore): Promise<Chore>;
  updateChore(id: number, updates: Partial<Chore>): Promise<Chore>;
  getChoresByFamily(familyId: string): Promise<Chore[]>;
  getChoresByKid(kidId: number): Promise<Chore[]>;
  getChoresByParent(parentId: number): Promise<Chore[]>;
  getChoresByStatus(familyId: string, status: string): Promise<Chore[]>;
  deleteChore(id: number): Promise<boolean>;
  startChore(id: number): Promise<Chore>;
  completeChore(id: number, completionTimeMinutes?: number, proofPhoto?: string): Promise<Chore>;
  
  // Negotiation operations
  createNegotiation(negotiation: InsertNegotiation): Promise<ChoreNegotiation>;
  getNegotiationsByChore(choreId: number): Promise<ChoreNegotiation[]>;
  updateNegotiation(id: number, updates: Partial<ChoreNegotiation>): Promise<ChoreNegotiation>;
  
  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentsByFamily(familyId: string): Promise<Payment[]>;
  getPaymentsByUser(userId: number): Promise<Payment[]>;
  updatePayment(id: number, updates: Partial<Payment>): Promise<Payment>;
  
  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByFamily(familyId: string): Promise<Message[]>;
  getMessagesByChore(choreId: number): Promise<Message[]>;
  getMessagesBetweenUsers(user1Id: number, user2Id: number): Promise<Message[]>;
  
  // Achievement operations
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  getAchievementsByUser(userId: number): Promise<Achievement[]>;
  
  // Analytics
  getFamilyStats(familyId: string): Promise<{
    totalEarned: string;
    completedChores: number;
    pendingApprovals: number;
    activeNegotiations: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private chores: Map<number, Chore> = new Map();
  private negotiations: Map<number, ChoreNegotiation> = new Map();
  private payments: Map<number, Payment> = new Map();
  private messages: Map<number, Message> = new Map();
  private achievements: Map<number, Achievement> = new Map();
  
  private currentUserId = 1;
  private currentChoreId = 1;
  private currentNegotiationId = 1;
  private currentPaymentId = 1;
  private currentMessageId = 1;
  private currentAchievementId = 1;

  constructor() {
    // Initialize with demo family
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create demo family
    const familyId = "demo-family-123";
    
    // Create parent user
    const parent: User = {
      id: this.currentUserId++,
      username: "parent",
      email: "parent@demo.com",
      password: "password123",
      role: "parent",
      familyId,
      balance: "1000.00",
      level: 1,
      totalEarned: "0.00",
      choreCount: 0,
      stripeCustomerId: null,
      avatar: null,
      createdAt: new Date(),
    };
    this.users.set(parent.id, parent);

    // Create kid users
    const emma: User = {
      id: this.currentUserId++,
      username: "emma",
      email: "emma@demo.com",
      password: "password123",
      role: "kid",
      familyId,
      balance: "47.50",
      level: 3,
      totalEarned: "47.50",
      choreCount: 12,
      stripeCustomerId: null,
      avatar: null,
      createdAt: new Date(),
    };
    this.users.set(emma.id, emma);

    const jake: User = {
      id: this.currentUserId++,
      username: "jake",
      email: "jake@demo.com",
      password: "password123",
      role: "kid",
      familyId,
      balance: "32.00",
      level: 2,
      totalEarned: "32.00",
      choreCount: 8,
      stripeCustomerId: null,
      avatar: null,
      createdAt: new Date(),
    };
    this.users.set(jake.id, jake);

    const sophia: User = {
      id: this.currentUserId++,
      username: "sophia",
      email: "sophia@demo.com",
      password: "password123",
      role: "kid",
      familyId,
      balance: "18.50",
      level: 1,
      totalEarned: "18.50",
      choreCount: 5,
      stripeCustomerId: null,
      avatar: null,
      createdAt: new Date(),
    };
    this.users.set(sophia.id, sophia);

    // Create demo chores
    const choreData = [
      {
        title: "Clean My Room",
        description: "Make bed, organize desk, vacuum",
        price: "8.00",
        status: "pending",
        kidId: emma.id,
        assignedBy: "kid",
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      },
      {
        title: "Wash Car",
        description: "Full wash and vacuum interior",
        price: "12.00",
        originalPrice: "15.00",
        status: "negotiating",
        kidId: emma.id,
        parentId: parent.id,
        assignedBy: "kid",
      },
      {
        title: "Take Out Trash",
        description: "Kitchen and bathroom bins",
        price: "3.50",
        status: "completed",
        kidId: emma.id,
        assignedBy: "kid",
        completedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
      {
        title: "Mow Front Yard",
        description: "Cut grass and edge walkway",
        price: "15.00",
        status: "completed",
        kidId: jake.id,
        assignedBy: "kid",
        completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
    ];

    choreData.forEach(chore => {
      const newChore: Chore = {
        id: this.currentChoreId++,
        ...chore,
        originalPrice: chore.originalPrice || null,
        parentId: chore.parentId || null,
        familyId,
        scheduledDate: chore.scheduledDate || null,
        completedAt: chore.completedAt || null,
        approvedAt: null,
        calendarEventId: null,
        createdAt: new Date(),
      };
      this.chores.set(newChore.id, newChore);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.currentUserId++,
      ...insertUser,
      balance: "0.00",
      level: 1,
      totalEarned: "0.00",
      choreCount: 0,
      stripeCustomerId: null,
      avatar: null,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getUsersByFamily(familyId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.familyId === familyId);
  }

  async updateUserBalance(id: number, amount: string): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    
    const currentBalance = parseFloat(user.balance);
    const amountToAdd = parseFloat(amount);
    const newBalance = (currentBalance + amountToAdd).toFixed(2);
    
    const updatedUser = { 
      ...user, 
      balance: newBalance,
      totalEarned: user.role === "kid" ? (parseFloat(user.totalEarned) + amountToAdd).toFixed(2) : user.totalEarned
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getChore(id: number): Promise<Chore | undefined> {
    return this.chores.get(id);
  }

  async createChore(insertChore: InsertChore): Promise<Chore> {
    const chore: Chore = {
      id: this.currentChoreId++,
      ...insertChore,
      status: "pending",
      originalPrice: null,
      startedAt: null,
      completedAt: null,
      approvedAt: null,
      completionTimeMinutes: null,
      proofPhoto: null,
      calendarEventId: null,
      createdAt: new Date(),
    };
    this.chores.set(chore.id, chore);
    return chore;
  }

  async updateChore(id: number, updates: Partial<Chore>): Promise<Chore> {
    const chore = this.chores.get(id);
    if (!chore) throw new Error("Chore not found");
    
    const updatedChore = { ...chore, ...updates };
    this.chores.set(id, updatedChore);
    return updatedChore;
  }

  async getChoresByFamily(familyId: string): Promise<Chore[]> {
    return Array.from(this.chores.values()).filter(chore => chore.familyId === familyId);
  }

  async getChoresByKid(kidId: number): Promise<Chore[]> {
    return Array.from(this.chores.values()).filter(chore => chore.kidId === kidId);
  }

  async getChoresByParent(parentId: number): Promise<Chore[]> {
    return Array.from(this.chores.values()).filter(chore => chore.parentId === parentId);
  }

  async getChoresByStatus(familyId: string, status: string): Promise<Chore[]> {
    return Array.from(this.chores.values()).filter(
      chore => chore.familyId === familyId && chore.status === status
    );
  }

  async deleteChore(id: number): Promise<boolean> {
    return this.chores.delete(id);
  }

  async startChore(id: number): Promise<Chore> {
    const chore = this.chores.get(id);
    if (!chore) throw new Error("Chore not found");
    
    const updatedChore = { 
      ...chore, 
      status: "in_progress", 
      startedAt: new Date() 
    };
    this.chores.set(id, updatedChore);
    return updatedChore;
  }

  async completeChore(id: number, completionTimeMinutes?: number, proofPhoto?: string): Promise<Chore> {
    const chore = this.chores.get(id);
    if (!chore) throw new Error("Chore not found");
    
    let actualCompletionTime = completionTimeMinutes;
    if (!actualCompletionTime && chore.startedAt) {
      const startTime = new Date(chore.startedAt).getTime();
      const completionTime = new Date().getTime();
      actualCompletionTime = Math.round((completionTime - startTime) / (1000 * 60));
    }
    
    const updatedChore = { 
      ...chore, 
      status: "completed", 
      completedAt: new Date(),
      completionTimeMinutes: actualCompletionTime || null,
      proofPhoto: proofPhoto || null
    };
    this.chores.set(id, updatedChore);
    return updatedChore;
  }

  async createNegotiation(insertNegotiation: InsertNegotiation): Promise<ChoreNegotiation> {
    const negotiation: ChoreNegotiation = {
      id: this.currentNegotiationId++,
      ...insertNegotiation,
      status: "pending",
      createdAt: new Date(),
    };
    this.negotiations.set(negotiation.id, negotiation);
    return negotiation;
  }

  async getNegotiationsByChore(choreId: number): Promise<ChoreNegotiation[]> {
    return Array.from(this.negotiations.values()).filter(neg => neg.choreId === choreId);
  }

  async updateNegotiation(id: number, updates: Partial<ChoreNegotiation>): Promise<ChoreNegotiation> {
    const negotiation = this.negotiations.get(id);
    if (!negotiation) throw new Error("Negotiation not found");
    
    const updatedNegotiation = { ...negotiation, ...updates };
    this.negotiations.set(id, updatedNegotiation);
    return updatedNegotiation;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const payment: Payment = {
      id: this.currentPaymentId++,
      ...insertPayment,
      status: "pending",
      stripePaymentIntentId: null,
      createdAt: new Date(),
    };
    this.payments.set(payment.id, payment);
    return payment;
  }

  async getPaymentsByFamily(familyId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(payment => payment.familyId === familyId);
  }

  async getPaymentsByUser(userId: number): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      payment => payment.fromUserId === userId || payment.toUserId === userId
    );
  }

  async updatePayment(id: number, updates: Partial<Payment>): Promise<Payment> {
    const payment = this.payments.get(id);
    if (!payment) throw new Error("Payment not found");
    
    const updatedPayment = { ...payment, ...updates };
    this.payments.set(id, updatedPayment);
    return updatedPayment;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const message: Message = {
      id: this.currentMessageId++,
      ...insertMessage,
      createdAt: new Date(),
    };
    this.messages.set(message.id, message);
    return message;
  }

  async getMessagesByFamily(familyId: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(message => message.familyId === familyId);
  }

  async getMessagesByChore(choreId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(message => message.choreId === choreId);
  }

  async getMessagesBetweenUsers(user1Id: number, user2Id: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      message => 
        (message.fromUserId === user1Id && message.toUserId === user2Id) ||
        (message.fromUserId === user2Id && message.toUserId === user1Id)
    );
  }

  async createAchievement(insertAchievement: InsertAchievement): Promise<Achievement> {
    const achievement: Achievement = {
      id: this.currentAchievementId++,
      ...insertAchievement,
      unlockedAt: new Date(),
    };
    this.achievements.set(achievement.id, achievement);
    return achievement;
  }

  async getAchievementsByUser(userId: number): Promise<Achievement[]> {
    return Array.from(this.achievements.values()).filter(achievement => achievement.userId === userId);
  }

  async getFamilyStats(familyId: string): Promise<{
    totalEarned: string;
    completedChores: number;
    pendingApprovals: number;
    activeNegotiations: number;
  }> {
    const familyChores = await this.getChoresByFamily(familyId);
    const familyUsers = await this.getUsersByFamily(familyId);
    
    const totalEarned = familyUsers
      .filter(user => user.role === "kid")
      .reduce((sum, user) => sum + parseFloat(user.totalEarned), 0)
      .toFixed(2);
    
    const completedChores = familyChores.filter(chore => chore.status === "completed" || chore.status === "approved_payment" || chore.status === "paid").length;
    const pendingApprovals = familyChores.filter(chore => chore.status === "completed").length;
    const activeNegotiations = familyChores.filter(chore => chore.status === "negotiating").length;
    
    return {
      totalEarned,
      completedChores,
      pendingApprovals,
      activeNegotiations,
    };
  }
}

import { db } from "./db";
import { eq } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUsersByFamily(familyId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.familyId, familyId));
  }

  async updateUserBalance(id: number, amount: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ balance: amount })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getChore(id: number): Promise<Chore | undefined> {
    const [chore] = await db.select().from(chores).where(eq(chores.id, id));
    return chore || undefined;
  }

  async createChore(insertChore: InsertChore): Promise<Chore> {
    const [chore] = await db
      .insert(chores)
      .values(insertChore)
      .returning();
    return chore;
  }

  async updateChore(id: number, updates: Partial<Chore>): Promise<Chore> {
    const [chore] = await db
      .update(chores)
      .set(updates)
      .where(eq(chores.id, id))
      .returning();
    return chore;
  }

  async getChoresByFamily(familyId: string): Promise<Chore[]> {
    return await db.select().from(chores).where(eq(chores.familyId, familyId));
  }

  async getChoresByKid(kidId: number): Promise<Chore[]> {
    return await db.select().from(chores).where(eq(chores.kidId, kidId));
  }

  async getChoresByParent(parentId: number): Promise<Chore[]> {
    return await db.select().from(chores).where(eq(chores.parentId, parentId));
  }

  async getChoresByStatus(familyId: string, status: string): Promise<Chore[]> {
    return await db.select().from(chores).where(eq(chores.familyId, familyId)).where(eq(chores.status, status));
  }

  async deleteChore(id: number): Promise<boolean> {
    const result = await db.delete(chores).where(eq(chores.id, id));
    return result.rowCount > 0;
  }

  async startChore(id: number): Promise<Chore> {
    const [chore] = await db
      .update(chores)
      .set({ 
        status: "in_progress",
        startedAt: new Date()
      })
      .where(eq(chores.id, id))
      .returning();
    return chore;
  }

  async completeChore(id: number, completionTimeMinutes?: number, proofPhoto?: string): Promise<Chore> {
    const [chore] = await db
      .update(chores)
      .set({ 
        status: "completed",
        completedAt: new Date(),
        completionTimeMinutes,
        proofPhoto
      })
      .where(eq(chores.id, id))
      .returning();
    return chore;
  }

  async createNegotiation(insertNegotiation: InsertNegotiation): Promise<ChoreNegotiation> {
    const [negotiation] = await db
      .insert(choreNegotiations)
      .values(insertNegotiation)
      .returning();
    return negotiation;
  }

  async getNegotiationsByChore(choreId: number): Promise<ChoreNegotiation[]> {
    return await db.select().from(choreNegotiations).where(eq(choreNegotiations.choreId, choreId));
  }

  async updateNegotiation(id: number, updates: Partial<ChoreNegotiation>): Promise<ChoreNegotiation> {
    const [negotiation] = await db
      .update(choreNegotiations)
      .set(updates)
      .where(eq(choreNegotiations.id, id))
      .returning();
    return negotiation;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(insertPayment)
      .returning();
    return payment;
  }

  async getPaymentsByFamily(familyId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.familyId, familyId));
  }

  async getPaymentsByUser(userId: number): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.fromUserId, userId));
  }

  async updatePayment(id: number, updates: Partial<Payment>): Promise<Payment> {
    const [payment] = await db
      .update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getMessagesByFamily(familyId: string): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.familyId, familyId));
  }

  async getMessagesByChore(choreId: number): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.choreId, choreId));
  }

  async getMessagesBetweenUsers(user1Id: number, user2Id: number): Promise<Message[]> {
    return await db.select().from(messages).where(eq(messages.fromUserId, user1Id)).where(eq(messages.toUserId, user2Id));
  }

  async createAchievement(insertAchievement: InsertAchievement): Promise<Achievement> {
    const [achievement] = await db
      .insert(achievements)
      .values(insertAchievement)
      .returning();
    return achievement;
  }

  async getAchievementsByUser(userId: number): Promise<Achievement[]> {
    return await db.select().from(achievements).where(eq(achievements.userId, userId));
  }

  async getFamilyStats(familyId: string): Promise<{
    totalEarned: string;
    completedChores: number;
    pendingApprovals: number;
    activeNegotiations: number;
  }> {
    const familyChores = await db.select().from(chores).where(eq(chores.familyId, familyId));
    const familyPayments = await db.select().from(payments).where(eq(payments.familyId, familyId));
    const familyNegotiations = await db.select().from(choreNegotiations);
    
    const totalEarned = familyPayments
      .filter(p => p.status === "completed")
      .reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
      .toFixed(2);
    
    const completedChores = familyChores.filter(c => c.status === "completed").length;
    const pendingApprovals = familyChores.filter(c => c.status === "pending_approval").length;
    const activeNegotiations = familyNegotiations.filter(n => n.status === "pending").length;

    return {
      totalEarned,
      completedChores,
      pendingApprovals,
      activeNegotiations
    };
  }
}

export const storage = new DatabaseStorage();
