import { createContext } from "react";
import type { User } from "../types/auth";

// The values that every component can read from the auth context.
// This keeps login state in one shared place instead of passing props through the app.
export type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

// The context starts as undefined so useAuth can detect missing AuthProvider usage.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
