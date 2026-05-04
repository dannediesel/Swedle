import { useContext } from "react";
import { AuthContext } from "./authContextCore";

// Small helper hook so components do not have to import/use AuthContext directly.
export function useAuth() {
  const context = useContext(AuthContext);

  // This gives a clear error if a component calls useAuth outside <AuthProvider>.
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
