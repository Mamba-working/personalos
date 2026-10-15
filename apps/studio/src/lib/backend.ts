import "server-only";
export function backendUrl(path: string) {
  const base = new URL(process.env.CONTENT_API_URL || "http://127.0.0.1:3001");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Invalid content API URL");
  return new URL(`/api/v1/${path}`, base);
}
export async function publicGet<T>(path: string): Promise<T> {
  const response = await fetch(backendUrl(`public/${path}`), { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(response.status === 404 ? "NOT_FOUND" : "API_UNAVAILABLE");
  return response.json() as Promise<T>;
}
