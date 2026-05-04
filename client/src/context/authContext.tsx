import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "../types/auth";
import { getCurrentUser, loginUser } from "../api/authApi";
import { AuthContext } from "./authContextCore";

type AuthProviderProps = {
  children: ReactNode;
};

// AuthProvider wraps the app and stores the current login state.
// Components inside it can call useAuth() to access user, login, logout, and refreshUser.
export function AuthProvider({ children }: AuthProviderProps) {
  // null means no user is currently logged in.
  const [user, setUser] = useState<User | null>(null);

  // Used while checking whether an already-saved token still belongs to a valid user.
  const [isLoading, setIsLoading] = useState(true);

  // Re-check the logged-in user from the backend.
  // This is useful on page reload, because React state disappears but localStorage remains.
  async function refreshUser() {
    const token = localStorage.getItem("token");

    // No token means the frontend has no saved login session.
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      // /api/auth/me verifies the token and returns the current user's profile.
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      // If the token is expired or invalid, remove it and treat the user as logged out.
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  // Log in through the backend, store the returned JWT, and update context state.
  async function login(email: string, password: string) {
    const result = await loginUser(email, password);
    localStorage.setItem("token", result.token);
    setUser(result.user);
  }

  // Logging out is client-side for now: remove the token and clear the user state.
  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  // Run once when the provider mounts so a page refresh keeps the user logged in.
  useEffect(() => {
    refreshUser();
  }, []);

  // Make auth state and auth actions available to the rest of the React app.
  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
