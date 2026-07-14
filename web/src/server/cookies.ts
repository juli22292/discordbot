import type { Env } from "./types";

export const SESSION_COOKIE = "archive_session";
export const OAUTH_STATE_COOKIE = "archive_oauth_state";

export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=") ?? ""));
  }

  return cookies;
}

export function cookieHeader(
  name: string,
  value: string,
  env: Pick<Env, "APP_URL">,
  maxAgeSeconds: number
): string {
  const secure = env.APP_URL.startsWith("https://") ? "; Secure" : "";
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure.trim(),
    `Max-Age=${maxAgeSeconds}`
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearCookieHeader(name: string, env: Pick<Env, "APP_URL">): string {
  return cookieHeader(name, "", env, 0);
}
