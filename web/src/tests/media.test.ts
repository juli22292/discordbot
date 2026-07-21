import { describe, expect, it } from "vitest";
import { combineMediaChunks, GUILD_MEDIA_CHUNK_SIZE, normalizeD1Blob, splitMediaBytes } from "../server/media";

describe("D1 guild media chunks", () => {
  it("splits and recombines media without changing bytes", () => {
    const source = new Uint8Array(GUILD_MEDIA_CHUNK_SIZE * 2 + 37);
    source.forEach((_, index) => {
      source[index] = index % 251;
    });

    const chunks = splitMediaBytes(source.buffer);
    expect(chunks).toHaveLength(3);
    const storedChunks = chunks.map((chunk) => Array.from(chunk));
    expect(Array.from(new Uint8Array(combineMediaChunks(storedChunks, source.byteLength)))).toEqual(Array.from(source));
  });

  it("accepts D1 blob arrays and ArrayBuffer views", () => {
    expect(Array.from(normalizeD1Blob([0, 127, 255]))).toEqual([0, 127, 255]);
    expect(Array.from(normalizeD1Blob(new Uint8Array([4, 5, 6])))).toEqual([4, 5, 6]);
  });

  it("rejects invalid or incomplete media data", () => {
    expect(() => normalizeD1Blob([1, -1, 300])).toThrow(/ungültige Byte-Werte/);
    expect(() => combineMediaChunks([[1, 2]], 3)).toThrow(/unvollständig/);
  });
});
