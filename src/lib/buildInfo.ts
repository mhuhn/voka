import { translations, type Language } from "./i18n";
export const version = __APP_VERSION__;
export const changedAt = __LAST_CODE_CHANGE__;

export function formatLastChange(iso: string, language: Language, now = new Date()): string {
  const changed = new Date(iso);
  if (Number.isNaN(changed.getTime())) return "–";
  const delta = now.getTime() - changed.getTime();
  if (delta >= 0 && delta < 3_600_000) {
    const minutes = Math.floor(delta / 60_000);
    return language === "de" ? "vor " + minutes + " min" : minutes + " min ago";
  }
  const locale = language === "de" ? "de-DE" : "en-GB";
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(changed);
  if (changed.getFullYear() === now.getFullYear() &&
      changed.getMonth() === now.getMonth() &&
      changed.getDate() === now.getDate()) {
    return translations[language].today + ", " + time;
  }
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(changed);
  return date + " " + time;
}
