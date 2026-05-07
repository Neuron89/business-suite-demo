import { apiFetch } from "./client";

export interface AuthenticatedUser {
  user: string;
}

export async function login(
  username: string,
  password: string
): Promise<AuthenticatedUser> {
  const data = await apiFetch<AuthenticatedUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return data;
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser> {
  return apiFetch<AuthenticatedUser>("/auth/me");
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
}


