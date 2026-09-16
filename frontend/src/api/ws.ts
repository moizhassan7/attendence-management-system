/** Dashboard live socket. Dev talks to FastAPI :8000; Docker/nginx uses the page origin. */
export function dashboardWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (import.meta.env.DEV) {
    const host = window.location.hostname || "localhost";
    return `${protocol}//${host}:8000/ws/dashboard`;
  }
  return `${protocol}//${window.location.host}/ws/dashboard`;
}
