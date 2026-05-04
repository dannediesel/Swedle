// API wrapper for authentication requests.
// These functions call the backend auth routes and give the rest of the frontend
// named functions instead of repeated fetch/apiRequest calls.
import { apiRequest } from "./client";
import type { LoginResponse, User } from "../types/auth";

export function registerUser(username: string, email: string, password: string) {
  return apiRequest<User>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export function loginUser(email: string, password: string) {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getCurrentUser() {
  return apiRequest<User>("/api/auth/me");
}
