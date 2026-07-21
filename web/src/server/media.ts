export const GUILD_MEDIA_CHUNK_SIZE = 256 * 1024;

export type SupportedImageMimeType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

const IMAGE_EXTENSIONS: Record<SupportedImageMimeType, "png" | "jpg" | "gif" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp"
};

export function detectImageMimeType(data: ArrayBuffer): SupportedImageMimeType | null {
  const bytes = new Uint8Array(data);

  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (bytes.length >= 6) {
    const gifHeader = String.fromCharCode(...bytes.slice(0, 6));
    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return "image/gif";
  }

  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function imageExtension(mimeType: SupportedImageMimeType): "png" | "jpg" | "gif" | "webp" {
  return IMAGE_EXTENSIONS[mimeType];
}

export function splitMediaBytes(data: ArrayBuffer): Uint8Array[] {
  const source = new Uint8Array(data);
  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < source.byteLength; offset += GUILD_MEDIA_CHUNK_SIZE) {
    chunks.push(source.slice(offset, Math.min(offset + GUILD_MEDIA_CHUNK_SIZE, source.byteLength)));
  }

  return chunks;
}

export function normalizeD1Blob(value: unknown): Uint8Array {
  if (Array.isArray(value)) {
    if (!value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)) {
      throw new Error("D1-Medienblock enthält ungültige Byte-Werte.");
    }
    return Uint8Array.from(value);
  }

  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
  }

  throw new Error("D1-Medienblock hat ein unbekanntes Format.");
}

export function combineMediaChunks(values: unknown[], expectedSize: number): ArrayBuffer {
  if (!Number.isInteger(expectedSize) || expectedSize < 0) {
    throw new Error("Ungültige erwartete Mediengröße.");
  }

  const chunks = values.map(normalizeD1Blob);
  const actualSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  if (actualSize !== expectedSize) {
    throw new Error(`D1-Medium ist unvollständig (${actualSize}/${expectedSize} Bytes).`);
  }

  const combined = new Uint8Array(actualSize);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined.buffer;
}
