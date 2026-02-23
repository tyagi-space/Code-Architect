import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertHoliday } from "@shared/schema";

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: Omit<InsertHoliday, "projectId"> }) => {
      const url = buildUrl(api.holidays.create.path, { projectId });
      const res = await fetch(url, {
        method: api.holidays.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add holiday");
      return api.holidays.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      const url = buildUrl(api.holidays.delete.path, { id });
      const res = await fetch(url, { method: api.holidays.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete holiday");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}
