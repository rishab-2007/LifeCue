const API_BASE_URL = "http://127.0.0.1:8000";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("lifecue_token");

  const headers = new Headers(options.headers || {});

  // JSON requests ke liye Content-Type
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // JWT token protected API requests mein bhejo
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Session invalid ya expired ho toh user ko login par bhejo
  if (response.status === 401) {
    localStorage.removeItem("lifecue_token");
    localStorage.removeItem("lifecue_user");

    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }

  return response;
}