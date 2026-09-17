/** Live dashboard socket — always same origin (Vite proxy in dev, nginx in prod). */
export function dashboardWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/dashboard`;
}
