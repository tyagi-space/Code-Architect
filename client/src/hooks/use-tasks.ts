import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertTask, type InsertTaskAssignment, type InsertTaskDependency } from "@shared/schema";

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: Omit<InsertTask, "projectId"> }) => {
      const url = buildUrl(api.tasks.create.path, { projectId });
      const res = await fetch(url, {
        method: api.tasks.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create task");
      return api.tasks.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, data }: { id: number; projectId: number; data: Partial<InsertTask> }) => {
      const url = buildUrl(api.tasks.update.path, { id });
      const res = await fetch(url, {
        method: api.tasks.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update task");
      return api.tasks.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      const url = buildUrl(api.tasks.delete.path, { id });
      const res = await fetch(url, { method: api.tasks.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}

export function useCreateTaskAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId, data }: { taskId: number; projectId: number; data: Omit<InsertTaskAssignment, "taskId"> }) => {
      const url = buildUrl(api.taskAssignments.create.path, { taskId });
      const res = await fetch(url, {
        method: api.taskAssignments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to assign task");
      return api.taskAssignments.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}

export function useDeleteTaskAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      const url = buildUrl(api.taskAssignments.delete.path, { id });
      const res = await fetch(url, { method: api.taskAssignments.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove assignment");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}

export function useCreateTaskDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, projectId, data }: { taskId: number; projectId: number; data: Omit<InsertTaskDependency, "taskId"> }) => {
      const url = buildUrl(api.taskDependencies.create.path, { taskId });
      const res = await fetch(url, {
        method: api.taskDependencies.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add dependency");
      return api.taskDependencies.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}

export function useGenerateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: number) => {
      const url = buildUrl(api.schedule.generate.path, { projectId });
      const res = await fetch(url, {
        method: api.schedule.generate.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate schedule");
      return api.schedule.generate.responses[200].parse(await res.json());
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: projectId })] });
    },
  });
}
