export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${body}`;
}

export async function first<T>(stmt: D1PreparedStatement): Promise<T | null> {
  const result = await stmt.first<T>();
  return result ?? null;
}

export async function all<T>(stmt: D1PreparedStatement): Promise<T[]> {
  const result = await stmt.all<T>();
  return result.results ?? [];
}

export function asJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
