import type { Express } from "express";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import * as XLSX from "xlsx-js-style";
import { db } from "./db";
import { clearSession, setSession } from "./auth";
import {
  users,
  passwordResetOtps,
  createUserSchema,
  loginSchema,
  forgotPasswordRequestSchema,
  otpVerifySchema,
  passwordResetSchema,
  type Project,
  type TeamMember,
  type Task,
  type TaskAssignment,
  type TaskDependency,
  type Holiday,
} from "@shared/schema";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { log } from "node:console";

export async function registerRoutes(app: Express): Promise<void> {
  // --- Auth ---
  app.get(api.auth.me.path, async (req, res) => {
    if (!req.auth?.userId) return res.status(401).json({ message: "Unauthorized" });
    const [user] = await db.select().from(users).where(eq(users.id, req.auth.userId)).limit(1);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    res.json(sanitizeUser(user));
  });

  app.get(api.auth.setupStatus.path, async (req, res) => {
    const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
    const hasUsers = existingUsers.length > 0;
    res.json({
      hasUsers,
      canBootstrap: !hasUsers,
      canManageUsers: req.auth?.role === "admin",
    });
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const identityRaw = input.username.trim();
      const identityLower = identityRaw.toLowerCase();

      const [user] = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.username, identityRaw),
            eq(users.phone, identityRaw),
            sql`lower(${users.username}) = ${identityLower}`,
          ),
        )
        .limit(1);
      if (!user || !verifyPassword(input.password, user.passwordHash) || !user.isActive) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      setSession(res, { userId: user.id, role: user.role });
      res.json(sanitizeUser(user));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.auth.logout.path, async (req, res) => {
    clearSession(res);
    res.json({ success: true });
  });

  app.post(api.auth.forgotPasswordRequest.path, async (req, res) => {
    try {
      const input = api.auth.forgotPasswordRequest.input.parse(req.body);
      const phone = input.phone.trim();
      const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

      // Privacy-preserving response: same response whether user exists or not.
      if (!user) {
        return res.json({ success: true, message: "If the phone exists, OTP has been sent." });
      }

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(passwordResetOtps).values({
        userId: user.id,
        otp,
        expiresAt,
        consumedAt: null,
        attempts: 0,
      });

      await sendSmsOtp(phone, `Your PlanFlow OTP is ${otp}. It expires in 10 minutes.`);
      res.json({ success: true, message: "If the phone exists, OTP has been sent." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.auth.forgotPasswordVerify.path, async (req, res) => {
    try {
      const input = api.auth.forgotPasswordVerify.input.parse(req.body);
      const valid = await isValidOtp(input.phone.trim(), input.otp.trim());
      if (!valid) return res.status(400).json({ message: "Invalid or expired OTP" });
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.post(api.auth.forgotPasswordReset.path, async (req, res) => {
    try {
      const input = api.auth.forgotPasswordReset.input.parse(req.body);
      const phone = input.phone.trim();
      const otp = input.otp.trim();
      const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

      const otpRow = await getLatestValidOtpRow(user.id, otp);
      if (!otpRow) return res.status(400).json({ message: "Invalid or expired OTP" });

      await db.update(users).set({ passwordHash: hashPassword(input.newPassword) }).where(eq(users.id, user.id));
      await db.update(passwordResetOtps)
        .set({ consumedAt: new Date() })
        .where(eq(passwordResetOtps.id, otpRow.id));

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // --- Users ---
  app.get(api.users.list.path, requireAuth, requireAdmin, async (_req, res) => {
    const allUsers = await db.select().from(users).orderBy(desc(users.id));
    res.json(allUsers.map(sanitizeUser));
  });

  app.post(api.users.create.path, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const normalizedFullName = input.fullName.trim();
      const normalizedUsername = input.username.trim().toLowerCase();
      const normalizedPhone = input.phone.trim();

      if (!normalizedFullName || !normalizedUsername || !normalizedPhone) {
        return res.status(400).json({ message: "Name, username and phone are required" });
      }

      const existingUsers = await db.select().from(users).limit(1);
      const isBootstrap = existingUsers.length === 0;

      if (!isBootstrap) {
        if (!req.auth?.userId) {
          return res.status(401).json({ message: "Initial setup already completed. Please login as admin to add users." });
        }
        if (req.auth?.role !== "admin") return res.status(403).json({ message: "Only admin can add users." });
      }

      const [usernameExists] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.username}) = ${normalizedUsername}`)
        .limit(1);
      if (usernameExists) return res.status(400).json({ message: "Username already exists" });

      const [phoneExists] = await db.select().from(users).where(eq(users.phone, normalizedPhone)).limit(1);
      if (phoneExists) return res.status(400).json({ message: "Phone already exists" });

      const [created] = await db.insert(users).values({
        fullName: normalizedFullName,
        username: normalizedUsername,
        phone: normalizedPhone,
        passwordHash: hashPassword(input.password),
        role: isBootstrap ? "admin" : input.role,
        isActive: 1,
      }).returning();

      res.status(201).json(sanitizeUser(created));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.use("/api", requireAuthUnlessPublic);

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
      const project = await storage.createProject(normalizeProjectCreateInput(input));
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
      const project = await storage.updateProject(Number(req.params.id), normalizeProjectUpdateInput(input));
      res.json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.projects.getSummary.path, async (req, res) => {
    const summary = await storage.getProjectSummary(Number(req.params.id));
    if (!summary) return res.status(404).json({ message: "Project not found" });
    res.json(summary);
  });

  app.get(api.projects.getUtilization.path, async (req, res) => {
    const utilization = await storage.getProjectUtilization(Number(req.params.id));
    if (!utilization) return res.status(404).json({ message: "Project not found" });
    res.json(utilization);
  });

  app.get(api.projects.exportExcel.path, async (req, res) => {
    const projectId = Number(req.params.id);
    const full = await storage.getFullProject(projectId);
    if (!full) return res.status(404).json({ message: "Project not found" });

    const utilization = (await storage.getProjectUtilization(projectId)) ?? [];

    const ganttRows: Array<Record<string, string | number>> = [];
    const taskCalendarRows: Array<Record<string, string | number>> = [];
    const daywiseRows: Array<Record<string, string | number>> = [];

    ganttRows.push({
      Section: "Project",
      Name: full.name,
      StartDate: full.startDate,
      EndDate: full.endDate ?? "",
      Tasks: full.tasks.length,
      TeamMembers: full.teamMembers.length,
      Holidays: full.holidays.length,
    });
    ganttRows.push({
      Section: "Project",
      Name: "Working Days",
      StartDate: full.workingDays.join(", "),
      EndDate: "",
    });
    ganttRows.push({});

    const timelineDates = collectTimelineDates(full.startDate, full.tasks);
    const timelineColumns = timelineDates.map((d) => d.toISOString().split("T")[0]);
    const memberEmojiMap = buildMemberEmojiMap(full.teamMembers.map((m) => m.id));

    ganttRows.push({ Section: "Legend", Label: "Utilization States", Value: "🟢 Allocated, ⚪ Idle, 🔴 Overloaded" });
    ganttRows.push({ Section: "Legend", Label: "Priority Colors", Value: "🔴 Critical, 🟠 High, 🔵 Medium, 🟢 Low" });
    full.teamMembers.forEach((member) => {
      ganttRows.push({
        Section: "Legend",
        Label: "Member Calendar Color",
        Value: `${memberEmojiMap[member.id]} ${member.name}`,
      });
    });
    ganttRows.push({});

    const memberSummary = buildMemberIdleSummary(full, utilization, timelineDates.length);
    ganttRows.push({
      Section: "Team Summary",
      Member: "Member",
      Role: "Role",
      AssignedDays: "Assigned Days",
      IdleDays: "Idle Days",
      IdlePct: "Idle %",
      AvgUtilizationPct: "Avg Util %",
      AvgIdleCapacityPct: "Avg Idle Capacity %",
      OverloadedDays: "Overloaded Days",
      UtilizationGraph: "Utilization Graph",
      IdleGraph: "Idle Graph",
    });
    memberSummary.forEach((m) => {
      ganttRows.push({
        Section: "Team Summary",
        Member: m.name,
        Role: m.role,
        AssignedDays: m.assignedDays,
        IdleDays: m.idleDays,
        IdlePct: `${m.idlePct.toFixed(1)}%`,
        AvgUtilizationPct: `${m.avgUtilization.toFixed(1)}%`,
        AvgIdleCapacityPct: `${m.avgIdleCapacity.toFixed(1)}%`,
        OverloadedDays: m.overloadedDays,
        UtilizationGraph: barGraph(m.avgUtilization),
        IdleGraph: barGraph(m.idlePct),
      });
    });
    ganttRows.push({});

    taskCalendarRows.push({
      Section: "Tasks",
      Module: "Module",
      Task: "Task",
      Description: "Description",
      Priority: "Priority",
      Status: "Status",
      DurationDays: "Duration",
      BufferDays: "Buffer",
      EstimatedEffortHours: "Effort(Hrs)",
      StartDate: "Start Date",
      EndDate: "End Date",
      Dependencies: "Dependencies",
      Resources: "Assigned Resources",
      ResourceUtilizationPct: "Utilization%",
      PriorityMarker: "Priority Marker",
      ...Object.fromEntries(timelineColumns.map((d) => [d, d])),
    });

    for (const task of full.tasks) {
      const dependencies = task.dependencies
        .map((dep) => full.tasks.find((t) => t.id === dep.dependsOnTaskId)?.name)
        .filter(Boolean)
        .join(", ");
      const resources = task.assignments.map((a) => `${a.teamMember.name} (${a.utilization}%)`).join(", ");
      const utilizationPct = task.assignments.reduce((sum, a) => sum + a.utilization, 0);
      const assignmentMemberIds = task.assignments.map((a) => a.teamMember.id);

      const timelineMap: Record<string, string> = {};
      for (const d of timelineColumns) {
        timelineMap[d] = "";
      }
      if (task.startDate && task.endDate) {
        const start = new Date(task.startDate);
        const end = new Date(task.endDate);
        for (const d of timelineDates) {
          if (d >= start && d <= end) {
            timelineMap[d.toISOString().split("T")[0]] = buildTaskCalendarMarker(
              assignmentMemberIds,
              utilizationPct,
              memberEmojiMap,
            );
          }
        }
      }

      taskCalendarRows.push({
        Section: "Tasks",
        Module: task.moduleName ?? "Unassigned",
        Task: task.name,
        Description: task.description ?? "",
        Priority: task.priority,
        Status: task.status,
        DurationDays: task.duration,
        BufferDays: task.bufferTime ?? 0,
        EstimatedEffortHours: task.estimatedEffort ?? 0,
        StartDate: task.startDate ?? "",
        EndDate: task.endDate ?? "",
        Dependencies: dependencies,
        Resources: resources,
        ResourceUtilizationPct: utilizationPct,
        PriorityMarker: priorityIcon(task.priority),
        ...timelineMap,
      });
    }

    ganttRows.push({
      Section: "Team Graph Snapshot",
      Metric: "Member",
      Value: "Utilization vs Idle",
      Graph: "Graph",
    });
    memberSummary.forEach((m) => {
      ganttRows.push({
        Section: "Team Graph Snapshot",
        Metric: m.name,
        Value: `Util ${m.avgUtilization.toFixed(1)}% | Idle ${m.idlePct.toFixed(1)}%`,
        Graph: `${barGraph(m.avgUtilization)} | ${barGraph(m.idlePct)}`,
      });
    });

    daywiseRows.push({
      Section: "Daywise Utilization",
      Date: "Date",
      Member: "Member",
      UtilizationPct: "Utilization %",
      IdlePct: "Idle %",
      State: "State",
      UtilizationGraph: "Utilization Graph",
      Tasks: "Tasks",
      Overloaded: "Overloaded",
    });
    for (const day of utilization) {
      for (const member of day.members) {
        const teamMember = full.teamMembers.find((m) => m.id === member.memberId);
        const maxCapacity = teamMember?.maxCapacity ?? 100;
        const idlePct = Math.max(0, maxCapacity - member.utilization);
        daywiseRows.push({
          Section: "Daywise Utilization",
          Date: day.date,
          Member: member.name,
          UtilizationPct: member.utilization,
          IdlePct: idlePct,
          State: member.isOverloaded ? "🔴 Overloaded" : member.utilization === 0 ? "⚪ Idle" : "🟢 Allocated",
          UtilizationGraph: barGraph(member.utilization),
          Tasks: member.tasks.join(", "),
          Overloaded: member.isOverloaded ? "Yes" : "No",
        });
      }
    }

    const wb = XLSX.utils.book_new();
    const ganttHeaders = Array.from(new Set(ganttRows.flatMap((row) => Object.keys(row))));
    const ganttSheet = XLSX.utils.json_to_sheet(ganttRows, { header: ganttHeaders, skipHeader: false });
    ganttSheet["!freeze"] = { xSplit: 5, ySplit: 1 };
    ganttSheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(ganttHeaders.length - 1)}1` };
    applyWorksheetStyling(ganttSheet, ganttHeaders);
    XLSX.utils.book_append_sheet(wb, ganttSheet, "Gantt Report");

    const taskCalendarHeaders = Array.from(new Set(taskCalendarRows.flatMap((row) => Object.keys(row))));
    const taskCalendarSheet = XLSX.utils.json_to_sheet(taskCalendarRows, { header: taskCalendarHeaders, skipHeader: false });
    taskCalendarSheet["!freeze"] = { xSplit: 6, ySplit: 1 };
    taskCalendarSheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(taskCalendarHeaders.length - 1)}1` };
    applyWorksheetStyling(taskCalendarSheet, taskCalendarHeaders);
    XLSX.utils.book_append_sheet(wb, taskCalendarSheet, "Task Allocation Calendar");

    const daywiseHeaders = Array.from(new Set(daywiseRows.flatMap((row) => Object.keys(row))));
    const daywiseSheet = XLSX.utils.json_to_sheet(daywiseRows, { header: daywiseHeaders, skipHeader: false });
    daywiseSheet["!freeze"] = { xSplit: 3, ySplit: 1 };
    daywiseSheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(daywiseHeaders.length - 1)}1` };
    applyWorksheetStyling(daywiseSheet, daywiseHeaders);
    XLSX.utils.book_append_sheet(wb, daywiseSheet, "Daywise Utilization");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });
    const filename = `${full.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_gantt_report.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
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
      const member = await storage.createTeamMember(
        normalizeTeamMemberCreateInput(input, Number(req.params.projectId)),
      );
      res.status(201).json(member);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.teamMembers.update.path, async (req, res) => {
    try {
      const input = api.teamMembers.update.input.parse(req.body);
      const member = await storage.updateTeamMember(Number(req.params.id), normalizeTeamMemberUpdateInput(input));
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
      const task = await storage.createTask(normalizeTaskCreateInput(input, Number(req.params.projectId)));
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.tasks.update.path, async (req, res) => {
    try {
      const input = api.tasks.update.input.parse(req.body);
      const task = await storage.updateTask(Number(req.params.id), normalizeTaskUpdateInput(input));
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
      const assignment = await storage.createTaskAssignment(
        normalizeTaskAssignmentCreateInput(input, Number(req.params.taskId)),
      );
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
      const dep = await storage.createTaskDependency(
        normalizeTaskDependencyCreateInput(input, Number(req.params.taskId)),
      );
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
      const h = await storage.createHoliday(normalizeHolidayCreateInput(input, Number(req.params.projectId)));
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

  return;
}

async function seedDatabase() {
  const existing = await storage.getProjects();
  if (existing.length === 0) {
    const proj = await storage.createProject({
      name: "Demo Website Launch",
      description: null,
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      workingDays: [1,2,3,4,5], // Mon-Fri
      settings: null,
    });

    const m1 = await storage.createTeamMember({
      projectId: proj.id,
      name: "Alice Frontend",
      role: "Developer",
      email: null,
      maxCapacity: 100,
      costPerDay: 500,
    });

    const t1 = await storage.createTask({
      projectId: proj.id,
      name: "Design Mockups",
      moduleName: "Design",
      duration: 3,
      startDate: null,
      endDate: null,
      priority: "High",
      status: "pending",
      description: null,
      estimatedEffort: 24,
      bufferTime: 0,
      color: null,
    });

    const t2 = await storage.createTask({
      projectId: proj.id,
      name: "Implement Header",
      moduleName: "Frontend",
      duration: 2,
      startDate: null,
      endDate: null,
      priority: "Medium",
      status: "pending",
      description: null,
      estimatedEffort: 16,
      bufferTime: 1,
      color: null,
    });

    await storage.createTaskAssignment({
      taskId: t1.id,
      teamMemberId: m1.id,
      utilization: 100
    });

    await storage.createTaskDependency({
      taskId: t2.id,
      dependsOnTaskId: t1.id,
      type: "FS",
    });
  }
}

function normalizeProjectCreateInput(input: any): Omit<Project, "id" | "createdAt"> {
  return {
    name: input.name,
    description: input.description ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    workingDays: Array.isArray(input.workingDays) ? input.workingDays.map(Number) : [1, 2, 3, 4, 5],
    settings: input.settings ?? null,
  };
}

function normalizeProjectUpdateInput(input: any): Partial<Project> {
  const update: Partial<Project> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description ?? null;
  if (input.startDate !== undefined) update.startDate = input.startDate;
  if (input.endDate !== undefined) update.endDate = input.endDate ?? null;
  if (input.workingDays !== undefined) {
    update.workingDays = Array.isArray(input.workingDays) ? input.workingDays.map(Number) : [];
  }
  if (input.settings !== undefined) update.settings = input.settings ?? null;
  return update;
}

function normalizeTeamMemberCreateInput(input: any, projectId: number): Omit<TeamMember, "id"> {
  return {
    projectId,
    name: input.name,
    role: input.role ?? null,
    email: input.email ?? null,
    maxCapacity: input.maxCapacity ?? 100,
    costPerDay: input.costPerDay ?? null,
  };
}

function normalizeTeamMemberUpdateInput(input: any): Partial<TeamMember> {
  const update: Partial<TeamMember> = {};
  if (input.projectId !== undefined) update.projectId = input.projectId;
  if (input.name !== undefined) update.name = input.name;
  if (input.role !== undefined) update.role = input.role ?? null;
  if (input.email !== undefined) update.email = input.email ?? null;
  if (input.maxCapacity !== undefined) update.maxCapacity = input.maxCapacity;
  if (input.costPerDay !== undefined) update.costPerDay = input.costPerDay ?? null;
  return update;
}

function normalizeTaskCreateInput(input: any, projectId: number): Omit<Task, "id"> {
  return {
    projectId,
    name: input.name,
    description: input.description ?? null,
    moduleName: input.moduleName ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    duration: input.duration,
    priority: input.priority ?? "Medium",
    status: input.status ?? "pending",
    estimatedEffort: input.estimatedEffort ?? null,
    bufferTime: input.bufferTime ?? 0,
    color: input.color ?? null,
  };
}

function normalizeTaskUpdateInput(input: any): Partial<Task> {
  const update: Partial<Task> = {};
  if (input.projectId !== undefined) update.projectId = input.projectId;
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description ?? null;
  if (input.moduleName !== undefined) update.moduleName = input.moduleName ?? null;
  if (input.startDate !== undefined) update.startDate = input.startDate ?? null;
  if (input.endDate !== undefined) update.endDate = input.endDate ?? null;
  if (input.duration !== undefined) update.duration = input.duration;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.status !== undefined) update.status = input.status;
  if (input.estimatedEffort !== undefined) update.estimatedEffort = input.estimatedEffort ?? null;
  if (input.bufferTime !== undefined) update.bufferTime = input.bufferTime ?? 0;
  if (input.color !== undefined) update.color = input.color ?? null;
  return update;
}

function normalizeTaskAssignmentCreateInput(input: any, taskId: number): Omit<TaskAssignment, "id"> {
  return {
    taskId,
    teamMemberId: input.teamMemberId,
    utilization: input.utilization ?? 100,
  };
}

function normalizeTaskDependencyCreateInput(input: any, taskId: number): Omit<TaskDependency, "id"> {
  return {
    taskId,
    dependsOnTaskId: input.dependsOnTaskId,
    type: input.type ?? "FS",
  };
}

function normalizeHolidayCreateInput(input: any, projectId: number): Omit<Holiday, "id"> {
  return {
    projectId,
    date: input.date,
    name: input.name,
    isGlobal: input.isGlobal ?? 0,
  };
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.auth?.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (req.auth?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  next();
}

function requireAuthUnlessPublic(req: any, res: any, next: any) {
  const fullPath = `${req.baseUrl || ""}${req.path || ""}`;
  const publicPaths = new Set<string>([
    api.auth.me.path,
    api.auth.setupStatus.path,
    api.auth.login.path,
    api.auth.logout.path,
    api.auth.forgotPasswordRequest.path,
    api.auth.forgotPasswordVerify.path,
    api.auth.forgotPasswordReset.path,
  ]);

  if (publicPaths.has(fullPath)) return next();
  if (req.method === "POST" && fullPath === api.users.create.path) return next();
  if (!req.auth?.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
}

function sanitizeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashPassword(password: string) {  
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, hashedPassword: string) {  
  const [salt, storedHash] = hashedPassword.split(":");
  if (!salt || !storedHash) return false;
  const coming_hash = crypto.scryptSync(password, salt, 64).toString("hex");
  if (coming_hash === storedHash){
    return true
  }
  return false
  
}

async function getLatestValidOtpRow(userId: number, otp: string) {
  const rows = await db
    .select()
    .from(passwordResetOtps)
    .where(
      and(
        eq(passwordResetOtps.userId, userId),
        eq(passwordResetOtps.otp, otp),
        isNull(passwordResetOtps.consumedAt),
        gt(passwordResetOtps.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(passwordResetOtps.id))
    .limit(1);
  return rows[0];
}

async function isValidOtp(phone: string, otp: string) {
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) return false;
  const row = await getLatestValidOtpRow(user.id, otp);
  return !!row;
}

async function sendSmsOtp(phone: string, message: string) {
  const provider = resolveSmsProvider();

  try {
    switch (provider) {
      case "textbelt":
        await sendViaTextbelt(phone, message);
        return;
      case "android_gateway":
        await sendViaAndroidGateway(phone, message);
        return;
      case "webhook":
        await sendViaWebhook(phone, message);
        return;
      default:
        console.log(`[SMS OTP FALLBACK] ${phone}: ${message}`);
        return;
    }
  } catch (error) {
    console.error(`[SMS OTP] Provider ${provider} failed. Falling back to console log.`, error);
    console.log(`[SMS OTP FALLBACK] ${phone}: ${message}`);
  }
}

function resolveSmsProvider(): "textbelt" | "android_gateway" | "webhook" | "console" {
  const explicit = (process.env.SMS_PROVIDER || "").trim().toLowerCase();
  if (explicit === "textbelt" || explicit === "android_gateway" || explicit === "webhook" || explicit === "console") {
    return explicit;
  }

  if (process.env.SMS_TEXTBELT_KEY) return "textbelt";
  if (process.env.SMS_ANDROID_GATEWAY_URL) return "android_gateway";
  if (process.env.SMS_WEBHOOK_URL) return "webhook";
  return "console";
}

async function sendViaTextbelt(phone: string, message: string) {
  const key = process.env.SMS_TEXTBELT_KEY || "textbelt";
  const response = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      phone,
      message,
      key,
    }),
  });

  const data = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `Textbelt request failed with status ${response.status}`);
  }
}

async function sendViaAndroidGateway(phone: string, message: string) {
  const gatewayUrl = process.env.SMS_ANDROID_GATEWAY_URL;
  if (!gatewayUrl) throw new Error("SMS_ANDROID_GATEWAY_URL is required for android_gateway provider");

  const token = process.env.SMS_ANDROID_GATEWAY_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone, message }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Android gateway failed (${response.status}): ${text || "No response body"}`);
  }
}

async function sendViaWebhook(phone: string, message: string) {
  const webhook = process.env.SMS_WEBHOOK_URL;
  if (!webhook) throw new Error("SMS_WEBHOOK_URL is required for webhook provider");

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Webhook SMS failed (${response.status}): ${text || "No response body"}`);
  }
}

function collectTimelineDates(projectStartDate: string, tasks: Array<{ startDate: string | null; endDate: string | null }>): Date[] {
  const start = new Date(projectStartDate);
  const taskEnds = tasks
    .filter((t) => t.endDate)
    .map((t) => new Date(t.endDate as string));
  const fallbackEnd = new Date(projectStartDate);
  fallbackEnd.setDate(fallbackEnd.getDate() + 30);
  const maxEnd = taskEnds.length > 0 ? taskEnds.reduce((a, b) => (a > b ? a : b)) : fallbackEnd;

  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= maxEnd) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function buildMemberEmojiMap(memberIds: number[]): Record<number, string> {
  const palette = ["🟦", "🟩", "🟨", "🟪", "🟫", "🟥", "⬛", "⬜"];
  return Object.fromEntries(memberIds.map((id, idx) => [id, palette[idx % palette.length]]));
}

function priorityIcon(priority: string): string {
  switch ((priority || "").toLowerCase()) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "low":
      return "🟢";
    default:
      return "🔵";
  }
}

function buildTaskCalendarMarker(
  memberIds: number[],
  utilizationPct: number,
  memberEmojiMap: Record<number, string>,
): string {
  if (utilizationPct > 100) return "🔥";
  if (memberIds.length === 0) return "⬜";
  if (memberIds.length === 1) return memberEmojiMap[memberIds[0]] || "🟦";
  return "🟪";
}

function barGraph(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const totalBlocks = 10;
  const filled = Math.round((clamped / 100) * totalBlocks);
  return `${"█".repeat(filled)}${"░".repeat(totalBlocks - filled)} ${clamped.toFixed(0)}%`;
}

function buildMemberIdleSummary(
  full: Awaited<ReturnType<typeof storage.getFullProject>> & { teamMembers: Array<{ id: number; name: string; role: string | null; maxCapacity: number }> },
  utilization: Array<{
    date: string;
    members: Array<{ memberId: number; utilization: number; isOverloaded: boolean }>;
  }>,
  totalDays: number,
) {
  return full.teamMembers.map((member) => {
    const memberDailyRows = utilization.map((day) => {
      const row = day.members.find((m) => m.memberId === member.id);
      return {
        utilization: row?.utilization ?? 0,
        isOverloaded: row?.isOverloaded ?? false,
      };
    });
    const idleDays = memberDailyRows.filter((d) => d.utilization === 0).length;
    const assignedDays = Math.max(0, totalDays - idleDays);
    const avgUtilization =
      memberDailyRows.length > 0
        ? memberDailyRows.reduce((sum, d) => sum + d.utilization, 0) / memberDailyRows.length
        : 0;
    const avgIdleCapacity = Math.max(0, member.maxCapacity - avgUtilization);
    const overloadedDays = memberDailyRows.filter((d) => d.isOverloaded).length;
    return {
      name: member.name,
      role: member.role || "N/A",
      idleDays,
      assignedDays,
      idlePct: totalDays > 0 ? (idleDays / totalDays) * 100 : 0,
      avgUtilization,
      avgIdleCapacity,
      overloadedDays,
    };
  });
}

function applyWorksheetStyling(ws: XLSX.WorkSheet, allHeaders: string[]) {
  if (!ws["!ref"]) return;

  const range = XLSX.utils.decode_range(ws["!ref"]);
  const sectionNames = new Set([
    "Project",
    "Legend",
    "Team Summary",
    "Tasks",
    "Daywise Utilization",
    "Team Graph Snapshot",
  ]);

  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "1F4E78" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "D9E1F2" } },
      bottom: { style: "thin", color: { rgb: "D9E1F2" } },
      left: { style: "thin", color: { rgb: "D9E1F2" } },
      right: { style: "thin", color: { rgb: "D9E1F2" } },
    },
  };

  const sectionStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "E2F0D9" } },
    font: { bold: true, color: { rgb: "1F4E78" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "B7C9E2" } },
      bottom: { style: "thin", color: { rgb: "B7C9E2" } },
      left: { style: "thin", color: { rgb: "B7C9E2" } },
      right: { style: "thin", color: { rgb: "B7C9E2" } },
    },
  };

  const labelStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "FFF2CC" } },
    font: { bold: true, color: { rgb: "7F6000" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "F2DC7D" } },
      bottom: { style: "thin", color: { rgb: "F2DC7D" } },
      left: { style: "thin", color: { rgb: "F2DC7D" } },
      right: { style: "thin", color: { rgb: "F2DC7D" } },
    },
  };

  // Style top column headers.
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = headerStyle;
  }

  // Style section markers and row/column label values.
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell || typeof cell.v !== "string") continue;

      if (sectionNames.has(cell.v)) {
        cell.s = sectionStyle;
        continue;
      }

      if (allHeaders.includes(cell.v)) {
        cell.s = labelStyle;
      }
    }
  }
}
