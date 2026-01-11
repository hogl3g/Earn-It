import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("kid"), // "kid" | "parent"
  familyId: text("familyId").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  level: integer("level").notNull().default(1),
  totalEarned: decimal("totalEarned", { precision: 10, scale: 2 }).notNull().default("0.00"),
  choreCount: integer("choreCount").notNull().default(0),
  stripeCustomerId: text("stripeCustomerId"),
  avatar: text("avatar"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chores = pgTable("chores", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"), // "pending" | "negotiating" | "approved" | "in_progress" | "completed" | "approved_payment" | "paid"
  kidId: integer("kidId").notNull(),
  parentId: integer("parentId"),
  assignedBy: text("assignedBy").notNull().default("kid"), // "kid" | "parent"
  scheduledDate: timestamp("scheduledDate"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  approvedAt: timestamp("approvedAt"),
  completionTimeMinutes: integer("completionTimeMinutes"),
  proofPhoto: text("proofPhoto"), // base64 encoded image or file path
  beforePhoto: text("beforePhoto"), // before starting the chore
  afterPhoto: text("afterPhoto"), // after completing the chore
  familyId: text("familyId").notNull(),
  calendarEventId: text("calendarEventId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const choreNegotiations = pgTable("chore_negotiations", {
  id: serial("id").primaryKey(),
  choreId: integer("choreId").notNull(),
  fromUserId: integer("fromUserId").notNull(),
  toUserId: integer("toUserId").notNull(),
  message: text("message").notNull(),
  proposedPrice: decimal("proposedPrice", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"), // "pending" | "accepted" | "rejected"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  fromUserId: integer("fromUserId").notNull(),
  toUserId: integer("toUserId").notNull(),
  choreId: integer("choreId"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "completed" | "failed"
  stripePaymentIntentId: text("stripePaymentIntentId"),
  method: text("method").notNull().default("stripe"), // "stripe" | "balance"
  familyId: text("familyId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("fromUserId").notNull(),
  toUserId: integer("toUserId"),
  choreId: integer("choreId"),
  content: text("content").notNull(),
  type: text("type").notNull().default("chat"), // "chat" | "negotiation" | "system" | "ai"
  familyId: text("familyId").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: text("type").notNull(), // "chores_completed" | "money_earned" | "streak" | "level_up"
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  value: integer("value"),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  balance: true,
  totalEarned: true,
  choreCount: true,
  level: true,
});

export const insertChoreSchema = createInsertSchema(chores).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  approvedAt: true,
  status: true,
  originalPrice: true,
  calendarEventId: true,
});

export const insertNegotiationSchema = createInsertSchema(choreNegotiations).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  status: true,
  stripePaymentIntentId: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  unlockedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Chore = typeof chores.$inferSelect;
export type InsertChore = z.infer<typeof insertChoreSchema>;
export type ChoreNegotiation = typeof choreNegotiations.$inferSelect;
export type InsertNegotiation = z.infer<typeof insertNegotiationSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
