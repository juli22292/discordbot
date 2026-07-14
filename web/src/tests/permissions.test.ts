import { describe, expect, it } from "vitest";
import { canManageGuild, permissionLabel } from "../server/permissions";

describe("Discord permission bitfield checks", () => {
  it("allows guild owners", () => {
    expect(canManageGuild({ owner: true, permissions: "0" })).toBe(true);
    expect(permissionLabel({ owner: true, permissions: "0" })).toBe("Owner");
  });

  it("allows administrators", () => {
    expect(canManageGuild({ owner: false, permissions: "8" })).toBe(true);
    expect(permissionLabel({ owner: false, permissions: "8" })).toBe("Administrator");
  });

  it("allows manage guild permission", () => {
    expect(canManageGuild({ owner: false, permissions: "32" })).toBe(true);
    expect(permissionLabel({ owner: false, permissions: "32" })).toBe("Manage Guild");
  });

  it("rejects unprivileged and malformed bitfields", () => {
    expect(canManageGuild({ owner: false, permissions: "1024" })).toBe(false);
    expect(canManageGuild({ owner: false, permissions: "not-a-number" })).toBe(false);
  });
});
