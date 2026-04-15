const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  portfolio: () => fetchJSON("/portfolio"),
  beta: () => fetchJSON("/beta"),
  goals: () => fetchJSON("/goals"),
};
