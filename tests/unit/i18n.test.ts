import { describe, expect, it } from "vitest";
import { preferredLanguage, translateError } from "../../src/lib/i18n";
import { formatLastChange } from "../../src/lib/buildInfo";

describe("interface language", () => {
  it("uses the most preferred locale, not a later supported locale", () => {
    expect(preferredLanguage(["de-DE", "en-US"])).toBe("de");
    expect(preferredLanguage(["fr-FR", "de-DE"])).toBe("en");
    expect(preferredLanguage(["en-US", "de-DE"])).toBe("en");
    expect(preferredLanguage(["de-AT"])).toBe("de");
  });
  it("localizes common Supabase authentication errors", () => {
    expect(translateError("Invalid login credentials", "de")).toBe("E-Mail-Adresse oder Passwort ist falsch.");
    expect(translateError("Email not confirmed", "de")).toBe("Bitte bestätige zuerst deine E-Mail-Adresse.");
  });
});

describe("last code change label", () => {
  const reference = new Date("2026-11-12T15:00:00Z");
  it("uses relative minutes for changes less than one hour old", () => {
    expect(formatLastChange("2026-11-12T14:37:00Z", "de", reference)).toBe("vor 23 min");
    expect(formatLastChange("2026-11-12T14:59:00Z", "en", reference)).toBe("1 min ago");
  });
  it("shows today's local time after one hour", () => {
    const now = new Date(2026, 10, 12, 16, 0);
    const then = new Date(2026, 10, 12, 14, 0);
    expect(formatLastChange(then.toISOString(), "de", now)).toContain("heute,");
  });
  it("shows a date if the change is not today", () => {
    const now = new Date(2026, 10, 12, 16, 0);
    const then = new Date(2026, 10, 11, 19, 0);
    expect(formatLastChange(then.toISOString(), "de", now)).toContain("11.11.2026");
  });
});
