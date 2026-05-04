// Shared frontend types for authentication data.
// They describe the user and login response shapes returned by the backend auth API.
export type User = {
  id: string;
  username: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt?: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};
