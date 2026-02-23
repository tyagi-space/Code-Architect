import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertTeamMember } from "@shared/schema";

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: Omit<InsertTeamMember, "projectId"> }) => {
      const url = buildUrl(api.teamMembers.create.path, { projectId });
      const res = await fetch(url, {
        method: api.teamMembers.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add team member");
      return api.teamMembers.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      const url = buildUrl(api.teamMembers.delete.path, { id });
      const res = await fetch(url, { method: api.teamMembers.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete team member");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [buildUrl(api.projects.getFull.path, { id: variables.projectId })] });
    },
  });
}
