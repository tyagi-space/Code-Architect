import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(), // ISO date string YYYY-MM-DD
  endDate: text("end_date"),
  workingDays: jsonb("working_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  maxCapacity: integer("max_capacity").notNull().default(100),
  costPerDay: integer("cost_per_day"),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  moduleName: text("module_name"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  duration: integer("duration").notNull(), // in days
  priority: text("priority").notNull().default("Medium"), 
  estimatedEffort: integer("estimated_effort"),
  bufferTime: integer("buffer_time").default(0),
});

export const taskAssignments = pgTable("task_assignments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  teamMemberId: integer("team_member_id").notNull(),
  utilization: integer("utilization").notNull().default(100),
});

export const taskDependencies = pgTable("task_dependencies", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  dependsOnTaskId: integer("depends_on_task_id").notNull(),
});

export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  date: text("date").notNull(),
  name: text("name").notNull(),
});

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
  dependencies: many(taskDependencies, { relationName: "dependencies" }),
  dependents: many(taskDependencies, { relationName: "dependents" }),
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
    relationName: "dependencies"
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: "dependents"
  }),
}));

export const holidaysRelations = relations(holidays, ({ one }) => ({
  project: one(projects, {
    fields: [holidays.projectId],
    references: [projects.id],
  }),
}));

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments).omit({ id: true });
export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({ id: true });
export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true });

export type Project = typeof projects.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;

export type FullProjectResponse = Project & {
  teamMembers: TeamMember[];
  tasks: (Task & {
    assignments: (TaskAssignment & { teamMember: TeamMember })[];
    dependencies: TaskDependency[];
  })[];
  holidays: Holiday[];
};