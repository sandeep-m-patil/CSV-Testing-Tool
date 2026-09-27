"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface MeUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<{ user: MeUser }>("/api/auth/me"),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    await apiFetch<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    router.replace("/login");
  };
}