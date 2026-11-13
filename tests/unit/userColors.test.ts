import { beforeEach, describe, expect, it } from "vitest";
import { avatarPalette, getUserAvatarColor } from "../../src/auth/userColors";

describe("account avatar colors", () => {
  beforeEach(() => localStorage.clear());

  it("gives each local account a distinct, reusable color", () => {
    const alice=getUserAvatarColor("00000000-0000-4000-8000-000000000001");
    const bob=getUserAvatarColor("00000000-0000-4000-8000-000000000002");
    expect(avatarPalette).toContain(alice);
    expect(avatarPalette).toContain(bob);
    expect(alice).not.toBe(bob);
    expect(getUserAvatarColor("00000000-0000-4000-8000-000000000001")).toBe(alice);
    expect(getUserAvatarColor("00000000-0000-4000-8000-000000000002")).toBe(bob);
  });

  it("retains avatar colors after persisting and can recover invalid storage", () => {
    const id="00000000-0000-4000-8000-000000000001";
    const color=getUserAvatarColor(id);
    expect(JSON.parse(localStorage.getItem("voka:user-avatar-colors:v1")||"{}")[id]).toBe(color);
    localStorage.setItem("voka:user-avatar-colors:v1","not json");
    expect(avatarPalette).toContain(getUserAvatarColor(id));
  });
});
