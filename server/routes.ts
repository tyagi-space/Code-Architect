import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- Projects ---
  app.get(api.projects.list.path, async (req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.get(api.projects.get.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.get(api.projects.getFull.path, async (req, res) => {
    const project = await storage.getFullProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      const project = await storage.createProject(input);
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.put(api.projects.update.path, async (req, res) => {
    try {
      const input = api.projects.update.input.parse(req.body);
      const project = await storage.updateProject(Number(req.params.id), input);
      res.json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Team ---
  app.get(api.teamMembers.list.path, async (req, res) => {
    const team = await storage.getTeamMembers(Number(req.params.projectId));
    res.json(team);
  });

  app.post(api.teamMembers.create.path, async (req, res) => {
    try {
      // Coerce numeric strings if any
      const input = api.teamMembers.create.input.parse(req.body);
      const member = await storage.createTeamMember({ ...input, projectId: Number(req.params.projectId) });
      res.status(201).json(member);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.teamMembers.update.path, async (req, res) => {
    try {
      const input = api.teamMembers.update.input.parse(req.body);
      const member = await storage.updateTeamMember(Number(req.params.id), input);
      res.json(member);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.teamMembers.delete.path, async (req, res) => {
    await storage.deleteTeamMember(Number(req.params.id));
    res.status(204).end();
  });

  // --- Tasks ---
  app.get(api.tasks.list.path, async (req, res) => {
    const tasks = await storage.getTasks(Number(req.params.projectId));
    res.json(tasks);
  });

  app.post(api.tasks.create.path, async (req, res) => {
    try {
      const input = api.tasks.create.input.parse(req.body);
      const task = await storage.createTask({ ...input, projectId: Number(req.params.projectId) });
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.tasks.update.path, async (req, res) => {
    try {
      const input = api.tasks.update.input.parse(req.body);
      const task = await storage.updateTask(Number(req.params.id), input);
      res.json(task);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.tasks.delete.path, async (req, res) => {
    await storage.deleteTask(Number(req.params.id));
    res.status(204).end();
  });

  // --- Assignments ---
  app.post(api.taskAssignments.create.path, async (req, res) => {
    try {
      const input = api.taskAssignments.create.input.parse(req.body);
      const assignment = await storage.createTaskAssignment({ ...input, taskId: Number(req.params.taskId) });
      res.status(201).json(assignment);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.taskAssignments.delete.path, async (req, res) => {
    await storage.deleteTaskAssignment(Number(req.params.id));
    res.status(204).end();
  });

  // --- Dependencies ---
  app.post(api.taskDependencies.create.path, async (req, res) => {
    try {
      const input = api.taskDependencies.create.input.parse(req.body);
      const dep = await storage.createTaskDependency({ ...input, taskId: Number(req.params.taskId) });
      res.status(201).json(dep);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.taskDependencies.delete.path, async (req, res) => {
    await storage.deleteTaskDependency(Number(req.params.id));
    res.status(204).end();
  });

  // --- Holidays ---
  app.get(api.holidays.list.path, async (req, res) => {
    const h = await storage.getHolidays(Number(req.params.projectId));
    res.json(h);
  });

  app.post(api.holidays.create.path, async (req, res) => {
    try {
      const input = api.holidays.create.input.parse(req.body);
      const h = await storage.createHoliday({ ...input, projectId: Number(req.params.projectId) });
      res.status(201).json(h);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.holidays.delete.path, async (req, res) => {
    await storage.deleteHoliday(Number(req.params.id));
    res.status(204).end();
  });

  // --- Scheduling Engine ---
  app.post(api.schedule.generate.path, async (req, res) => {
    const projectId = Number(req.params.projectId);
    const fullProject = await storage.getFullProject(projectId);
    
    if (!fullProject) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    try {
      const workingDays = fullProject.workingDays; // [1,2,3,4,5]
      const holidaysSet = new Set(fullProject.holidays.map(h => h.date));
      const projectStart = new Date(fullProject.startDate);
      
      const isWorkingDay = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay(); // 0 is Sun, 6 is Sat
        return workingDays.includes(dayOfWeek) && !holidaysSet.has(dateStr);
      };

      const addWorkingDays = (startDate: Date, days: number) => {
        let currentDate = new Date(startDate);
        let remainingDays = days;
        
        while (!isWorkingDay(currentDate)) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        let endDate = new Date(currentDate);
        remainingDays--;

        while (remainingDays > 0) {
          endDate.setDate(endDate.getDate() + 1);
          if (isWorkingDay(endDate)) {
            remainingDays--;
          }
        }
        return { start: currentDate, end: endDate };
      };

      let updatedCount = 0;
      let unresolvedTasks = [...fullProject.tasks];
      let resolvedTaskEnds = new Map<number, Date>();

      let madeProgress = true;
      while (unresolvedTasks.length > 0 && madeProgress) {
        madeProgress = false;
        
        for (let i = unresolvedTasks.length - 1; i >= 0; i--) {
          const task = unresolvedTasks[i];
          const allDepsResolved = task.dependencies.every(d => resolvedTaskEnds.has(d.dependsOnTaskId));
          
          if (allDepsResolved) {
            let earlyStart = new Date(projectStart);
            
            task.dependencies.forEach(d => {
              const depEnd = resolvedTaskEnds.get(d.dependsOnTaskId)!;
              if (depEnd >= earlyStart) {
                earlyStart = new Date(depEnd);
                earlyStart.setDate(earlyStart.getDate() + 1); // Start next day
              }
            });

            const duration = task.duration + (task.bufferTime || 0);
            const { start, end } = addWorkingDays(earlyStart, duration > 0 ? duration : 1);
            
            resolvedTaskEnds.set(task.id, end);
            
            await storage.updateTask(task.id, {
              startDate: start.toISOString().split('T')[0],
              endDate: end.toISOString().split('T')[0]
            });
            
            updatedCount++;
            unresolvedTasks.splice(i, 1);
            madeProgress = true;
          }
        }
      }

      res.json({ success: true, message: `Auto-scheduled ${updatedCount} tasks.` });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, message: "Scheduling failed. Please check dependencies." });
    }
  });

  // Seed Data Call
  seedDatabase().catch(console.error);

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getProjects();
  if (existing.length === 0) {
    const proj = await storage.createProject({
      name: "Demo Website Launch",
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      workingDays: [1,2,3,4,5] // Mon-Fri
    });

    const m1 = await storage.createTeamMember({
      projectId: proj.id,
      name: "Alice Frontend",
      role: "Developer",
      maxCapacity: 100,
      costPerDay: 500
    });

    const t1 = await storage.createTask({
      projectId: proj.id,
      name: "Design Mockups",
      moduleName: "Design",
      duration: 3,
      startDate: null,
      endDate: null,
      priority: "High",
      estimatedEffort: 24,
      bufferTime: 0
    });

    const t2 = await storage.createTask({
      projectId: proj.id,
      name: "Implement Header",
      moduleName: "Frontend",
      duration: 2,
      startDate: null,
      endDate: null,
      priority: "Medium",
      estimatedEffort: 16,
      bufferTime: 1
    });

    await storage.createTaskAssignment({
      taskId: t1.id,
      teamMemberId: m1.id,
      utilization: 100
    });

    await storage.createTaskDependency({
      taskId: t2.id,
      dependsOnTaskId: t1.id
    });
  }
}