import type { Env } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64Url(buffer);
}

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const data = typeof value === "string" ? textEncoder.encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptJson(value: unknown, secret: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await aesKey(secret);
  const payload = textEncoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptJson<T>(value: string, secret: string): Promise<T> {
  const [version, ivPart, ciphertextPart] = value.split(".");
  if (version !== "v1" || !ivPart || !ciphertextPart) {
    throw new Error("Ungültige verschlüsselte Daten.");
  }

  const key = await aesKey(secret);
  const iv = toArrayBuffer(fromBase64Url(ivPart));
  const ciphertext = toArrayBuffer(fromBase64Url(ciphertextPart));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(textDecoder.decode(plaintext)) as T;
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function verifyInternalBotRequest(
  request: Request,
  env: Pick<Env, "INTERNAL_BOT_API_SECRET" | "BOT_EVENT_NONCES">,
  bodyText: string
): Promise<void> {
  if (!env.INTERNAL_BOT_API_SECRET) {
    throw new Error("Interne Bot-Authentifizierung ist nicht konfiguriert.");
  }

  const timestamp = request.headers.get("x-bot-timestamp") ?? "";
  const nonce = request.headers.get("x-bot-nonce") ?? "";
  const signature = request.headers.get("x-bot-signature") ?? "";

  if (!/^\d{10,13}$/.test(timestamp) || nonce.length < 16 || !/^[a-f0-9]{64}$/i.test(signature)) {
    throw new Error("Interne Signatur fehlt oder ist ungültig.");
  }

  const timestampMs = timestamp.length === 13 ? Number(timestamp) : Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new Error("Interne Signatur ist abgelaufen.");
  }

  const nonceKey = `bot:${nonce}`;
  const existingNonce = await env.BOT_EVENT_NONCES.get(nonceKey);
  if (existingNonce) {
    throw new Error("Interne Signatur wurde bereits verwendet.");
  }

  const url = new URL(request.url);
  const bodyHash = await sha256Hex(bodyText);
  const message = `${request.method.toUpperCase()}\n${url.pathname}${url.search}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const expected = await hmacHex(env.INTERNAL_BOT_API_SECRET, message);

  if (!equalString(expected, signature.toLowerCase())) {
    throw new Error("Interne Signatur ist falsch.");
  }

  await env.BOT_EVENT_NONCES.put(nonceKey, "1", { expirationTtl: 300 });
}
