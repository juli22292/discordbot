import { describe, expect, it } from "vitest";
import {
  combineMediaChunks,
  detectImageMimeType,
  GUILD_MEDIA_CHUNK_SIZE,
  imageExtension,
  normalizeD1Blob,
  splitMediaBytes
} from "../server/media";

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

  it("detects supported image formats from their real file signatures", () => {
    expect(detectImageMimeType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer)).toBe("image/png");
    expect(detectImageMimeType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]).buffer)).toBe("image/jpeg");
    expect(detectImageMimeType(new TextEncoder().encode("GIF89a").buffer)).toBe("image/gif");
    expect(detectImageMimeType(new TextEncoder().encode("RIFF0000WEBP").buffer)).toBe("image/webp");
    expect(detectImageMimeType(new TextEncoder().encode("not-an-image").buffer)).toBeNull();
  });

  it("uses canonical extensions for detected image formats", () => {
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/gif")).toBe("gif");
    expect(imageExtension("image/webp")).toBe("webp");
  });
});
