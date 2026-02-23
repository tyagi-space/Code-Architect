import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(), // ISO date string YYYY-MM-DD
  endDate: text("end_date"),
  workingDays: jsonb("working_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
  settings: jsonb("settings").$type<{
    showCriticalPath?: boolean;
    colorBy?: 'priority' | 'module' | 'member';
    defaultBuffer?: number;
  }>().default({ showCriticalPath: true, colorBy: 'priority', defaultBuffer: 0 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  username: text("username").notNull().unique(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"), // admin | manager | user
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetOtps = pgTable("password_reset_otps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  maxCapacity: integer("max_capacity").notNull().default(100),
  costPerDay: integer("cost_per_day"),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  moduleName: text("module_name"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  duration: integer("duration").notNull(), // in working days
  priority: text("priority").notNull().default("Medium"), // Low, Medium, High, Critical
  status: text("status").notNull().default("pending"), // pending, in_progress, completed
  estimatedEffort: integer("estimated_effort"), // in hours
  bufferTime: integer("buffer_time").default(0),
  color: text("color"), // Optional custom color
});

export const taskAssignments = pgTable("task_assignments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  teamMemberId: integer("team_member_id").notNull(),
  utilization: integer("utilization").notNull().default(100), // % of member's capacity
});

export const taskDependencies = pgTable("task_dependencies", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  dependsOnTaskId: integer("depends_on_task_id").notNull(),
  type: text("type").default("FS"), // Finish-to-Start (FS), SS, FF, SF
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  date: text("date").notNull(),
  name: text("name").notNull(),
  isGlobal: integer("is_global").default(0), // 1 for global company holiday
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  teamMembers: many(teamMembers),
  tasks: many(tasks),
  holidays: many(holidays),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignments: many(taskAssignments),
  dependencies: many(taskDependencies, { relationName: "task_to_deps" }),
  dependents: many(taskDependencies, { relationName: "task_to_dependents" }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  project: one(projects, {
    fields: [teamMembers.projectId],
    references: [projects.id],
  }),
  assignments: many(taskAssignments),
}));

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignments.taskId],
    references: [tasks.id],
  }),
  teamMember: one(teamMembers, {
    fields: [taskAssignments.teamMemberId],
    references: [teamMembers.id],
  }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: "task_to_deps"
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: "task_to_dependents"
  }),
}));

export const holidaysRelations = relations(holidays, ({ one }) => ({
  project: one(projects, {
    fields: [holidays.projectId],
    references: [projects.id],
  }),
}));

// Schemas
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments).omit({ id: true });
export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({ id: true });
export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, passwordHash: true });
export const createUserSchema = z.object({
  fullName: z.string().min(2),
  username: z.string().min(3).max(32),
  phone: z.string().min(7).max(20),
  password: z.string().min(8),
  role: z.enum(["admin", "manager", "user"]).default("user"),
});
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
export const forgotPasswordRequestSchema = z.object({
  phone: z.string().min(7).max(20),
});
export const otpVerifySchema = z.object({
  phone: z.string().min(7).max(20),
  otp: z.string().length(6),
});
export const passwordResetSchema = z.object({
  phone: z.string().min(7).max(20),
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

// Types
export type Project = typeof projects.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type User = typeof users.$inferSelect;
export type PasswordResetOtp = typeof passwordResetOtps.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertTaskAssignment = z.infer<typeof insertTaskAssignmentSchema>;
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

export type FullProjectResponse = Project & {
  teamMembers: TeamMember[];
  tasks: (Task & {
    assignments: (TaskAssignment & { teamMember: TeamMember })[];
    dependencies: TaskDependency[];
  })[];
  holidays: Holiday[];
};

export interface DayWiseUtilization {
  date: string;
  members: {
    memberId: number;
    name: string;
    utilization: number;
    tasks: string[];
    isOverloaded: boolean;
  }[];
}

export interface ProjectSummary {
  totalTasks: number;
  completedTasks: number;
  criticalPathCount: number;
  overloadedDays: number;
  moduleBreakdown: Record<string, number>;
}
