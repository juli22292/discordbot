export const GUILD_MEDIA_CHUNK_SIZE = 256 * 1024;

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
