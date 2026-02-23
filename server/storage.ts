import { db } from "./db";
import {
  projects, teamMembers, tasks, taskAssignments, taskDependencies, holidays,
  type Project, type TeamMember, type Task, type TaskAssignment, type TaskDependency, type Holiday,
  type FullProjectResponse
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

export interface IStorage {
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  getFullProject(id: number): Promise<FullProjectResponse | undefined>;
  createProject(project: Omit<Project, "id">): Promise<Project>;
  updateProject(id: number, project: Partial<Project>): Promise<Project>;

  // Team
  getTeamMembers(projectId: number): Promise<TeamMember[]>;
  createTeamMember(member: Omit<TeamMember, "id">): Promise<TeamMember>;
  updateTeamMember(id: number, member: Partial<TeamMember>): Promise<TeamMember>;
  deleteTeamMember(id: number): Promise<void>;

  // Tasks
  getTasks(projectId: number): Promise<Task[]>;
  createTask(task: Omit<Task, "id">): Promise<Task>;
  updateTask(id: number, task: Partial<Task>): Promise<Task>;
  deleteTask(id: number): Promise<void>;

  // Assignments
  createTaskAssignment(assignment: Omit<TaskAssignment, "id">): Promise<TaskAssignment>;
  deleteTaskAssignment(id: number): Promise<void>;

  // Dependencies
  createTaskDependency(dependency: Omit<TaskDependency, "id">): Promise<TaskDependency>;
  deleteTaskDependency(id: number): Promise<void>;

  // Holidays
  getHolidays(projectId: number): Promise<Holiday[]>;
  createHoliday(holiday: Omit<Holiday, "id">): Promise<Holiday>;
  deleteHoliday(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // --- Projects ---
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getFullProject(id: number): Promise<FullProjectResponse | undefined> {
    const project = await this.getProject(id);
    if (!project) return undefined;

    const [members, projectTasks, projectHolidays] = await Promise.all([
      this.getTeamMembers(id),
      this.getTasks(id),
      this.getHolidays(id)
    ]);

    // Fetch assignments and dependencies for these tasks
    const taskIds = projectTasks.map(t => t.id);
    let allAssignments: (TaskAssignment & { teamMember: TeamMember })[] = [];
    let allDependencies: TaskDependency[] = [];
    
    if (taskIds.length > 0) {
      const assignments = await db.select().from(taskAssignments).where(inArray(taskAssignments.taskId, taskIds));
      allDependencies = await db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds));
      
      allAssignments = assignments.map(a => {
        const member = members.find(m => m.id === a.teamMemberId)!;
        return { ...a, teamMember: member };
      });
    }

    const tasksWithRelations = projectTasks.map(t => ({
      ...t,
      assignments: allAssignments.filter(a => a.taskId === t.id),
      dependencies: allDependencies.filter(d => d.taskId === t.id)
    }));

    return {
      ...project,
      teamMembers: members,
      tasks: tasksWithRelations,
      holidays: projectHolidays
    };
  }

  async createProject(project: Omit<Project, "id">): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, update: Partial<Project>): Promise<Project> {
    const [updated] = await db.update(projects).set(update).where(eq(projects.id, id)).returning();
    return updated;
  }

  // --- Team ---
  async getTeamMembers(projectId: number): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(eq(teamMembers.projectId, projectId));
  }

  async createTeamMember(member: Omit<TeamMember, "id">): Promise<TeamMember> {
    const [created] = await db.insert(teamMembers).values(member).returning();
    return created;
  }

  async updateTeamMember(id: number, update: Partial<TeamMember>): Promise<TeamMember> {
    const [updated] = await db.update(teamMembers).set(update).where(eq(teamMembers.id, id)).returning();
    return updated;
  }

  async deleteTeamMember(id: number): Promise<void> {
    await db.delete(taskAssignments).where(eq(taskAssignments.teamMemberId, id));
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }

  // --- Tasks ---
  async getTasks(projectId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  }

  async createTask(task: Omit<Task, "id">): Promise<Task> {
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: number, update: Partial<Task>): Promise<Task> {
    const [updated] = await db.update(tasks).set(update).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: number): Promise<void> {
    // Delete dependencies and assignments first
    await db.delete(taskDependencies).where(eq(taskDependencies.taskId, id));
    await db.delete(taskDependencies).where(eq(taskDependencies.dependsOnTaskId, id));
    await db.delete(taskAssignments).where(eq(taskAssignments.taskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // --- Assignments ---
  async createTaskAssignment(assignment: Omit<TaskAssignment, "id">): Promise<TaskAssignment> {
    const [created] = await db.insert(taskAssignments).values(assignment).returning();
    return created;
  }

  async deleteTaskAssignment(id: number): Promise<void> {
    await db.delete(taskAssignments).where(eq(taskAssignments.id, id));
  }

  // --- Dependencies ---
  async createTaskDependency(dependency: Omit<TaskDependency, "id">): Promise<TaskDependency> {
    const [created] = await db.insert(taskDependencies).values(dependency).returning();
    return created;
  }

  async deleteTaskDependency(id: number): Promise<void> {
    await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
  }

  // --- Holidays ---
  async getHolidays(projectId: number): Promise<Holiday[]> {
    return await db.select().from(holidays).where(eq(holidays.projectId, projectId));
  }

  async createHoliday(holiday: Omit<Holiday, "id">): Promise<Holiday> {
    const [created] = await db.insert(holidays).values(holiday).returning();
    return created;
  }

  async deleteHoliday(id: number): Promise<void> {
    await db.delete(holidays).where(eq(holidays.id, id));
  }
}

export const storage = new DatabaseStorage();