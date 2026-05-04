// Base address for the Express backend during local development.
const API_BASE_URL = "http://localhost:3000";

// Shared helper for calling the backend.
// T describes the response type the caller expects back from the API.
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // The login flow stores the JWT in localStorage.
  // If a token exists, protected backend routes can verify it through the Authorization header.
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      // Most requests in this app send or receive JSON.
      "Content-Type": "application/json",

      // Add Authorization only when the user is logged in.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),

      // Let individual requests override or add headers if needed.
      ...options.headers,
    },
  });

  // The backend returns JSON for both successful responses and error responses.
  const data = await response.json();

  // Convert non-2xx HTTP responses into thrown errors so UI code can handle them in catch blocks.
  if (!response.ok) {
    throw new Error(data.error || "API request failed");
  }

  // Cast the parsed JSON to the expected response type.
  return data;
}
