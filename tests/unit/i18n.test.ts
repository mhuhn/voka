import { describe, expect, it } from "vitest";
import { preferredLanguage, translateError, translations } from "../../src/lib/i18n";
import { formatLastChange } from "../../src/lib/buildInfo";

describe("interface language", () => {
  it("uses the most preferred locale, not a later supported locale", () => {
    expect(preferredLanguage(["de-DE", "en-US"])).toBe("de");
    expect(preferredLanguage(["fr-FR", "de-DE"])).toBe("en");
    expect(preferredLanguage(["en-US", "de-DE"])).toBe("en");
    expect(preferredLanguage(["de-AT"])).toBe("de");
    expect(preferredLanguage(["fr-CA", "en-US"])).toBe("fr");
    expect(preferredLanguage(["nl-BE"])).toBe("nl");
    expect(preferredLanguage(["da-DK"])).toBe("da");
    expect(preferredLanguage(["it-CH"])).toBe("it");
  });
  it("provides translated profile actions in every language", () => {
    for (const locale of ["de", "en", "fr", "nl", "da", "it"] as const) {
      expect(translations[locale].signOut).toBeTruthy();
      expect(translations[locale].accounts).toBeTruthy();
      expect(translations[locale].add).toBeTruthy();
      expect(translations[locale].switchTo).toBeTruthy();
      expect(translations[locale].remove).toBeTruthy();
    }
    expect(translations.de.signOut).toBe("Abmelden");
    expect(translations.fr.signOut).toBe("Se déconnecter");
    expect(translations.nl.signOut).toBe("Uitloggen");
    expect(translations.da.signOut).toBe("Log ud");
    expect(translations.it.signOut).toBe("Esci");
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
    expect(formatLastChange("2026-11-12T14:37:00Z", "fr", reference)).toBe("il y a 23 min");
    expect(formatLastChange("2026-11-12T14:37:00Z", "nl", reference)).toBe("23 min geleden");
    expect(formatLastChange("2026-11-12T14:37:00Z", "da", reference)).toBe("for 23 min siden");
    expect(formatLastChange("2026-11-12T14:37:00Z", "it", reference)).toBe("23 min fa");
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
