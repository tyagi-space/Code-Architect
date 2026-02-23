import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

type AuthUser = {
  id: number;
  fullName: string;
  username: string;
  phone: string;
  role: string;
};

type SetupStatus = {
  hasUsers: boolean;
  canBootstrap: boolean;
  canManageUsers: boolean;
};

export function useCurrentUser() {
  return useQuery<AuthUser | null>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load user");
      return api.auth.me.responses[200].parse(await res.json());
    },
    staleTime: 0,
  });
}

export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: [api.auth.setupStatus.path],
    queryFn: async () => {
      const res = await fetch(api.auth.setupStatus.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load setup status");
      return api.auth.setupStatus.responses[200].parse(await res.json());
    },
    staleTime: 0,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || "Invalid username or password");
      }
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.auth.me.path] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to logout");
      return api.auth.logout.responses[200].parse(await res.json());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      await queryClient.clear();
    },
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      return api.users.list.responses[200].parse(await res.json());
    },
    enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      fullName: string;
      username: string;
      phone: string;
      password: string;
      role: "admin" | "manager" | "user";
    }) => {
      const res = await fetch(api.users.create.path, {
        method: api.users.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || "Failed to create user");
      }
      return api.users.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.users.list.path] }),
  });
}

export function useForgotPasswordRequest() {
  return useMutation({
    mutationFn: async (data: { phone: string }) => {
      const res = await fetch(api.auth.forgotPasswordRequest.path, {
        method: api.auth.forgotPasswordRequest.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to request OTP");
      return api.auth.forgotPasswordRequest.responses[200].parse(await res.json());
    },
  });
}

export function useForgotPasswordVerify() {
  return useMutation({
    mutationFn: async (data: { phone: string; otp: string }) => {
      const res = await fetch(api.auth.forgotPasswordVerify.path, {
        method: api.auth.forgotPasswordVerify.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Invalid or expired OTP");
      return api.auth.forgotPasswordVerify.responses[200].parse(await res.json());
    },
  });
}

export function useForgotPasswordReset() {
  return useMutation({
    mutationFn: async (data: { phone: string; otp: string; newPassword: string }) => {
      const res = await fetch(api.auth.forgotPasswordReset.path, {
        method: api.auth.forgotPasswordReset.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reset password");
      return api.auth.forgotPasswordReset.responses[200].parse(await res.json());
    },
  });
}
