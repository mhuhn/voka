/**
 * Local, per-account avatar colors. The first color is randomly selected and saved
 * so a user retains their own visual identity after reloads and account switches.
 * Prefer an unused color for each additional account on this device.
 */
const STORAGE_KEY = "voka:user-avatar-colors:v1";
export const avatarPalette = [
  "#2563EB", "#9333EA", "#DB2777", "#E11D48", "#EA580C",
  "#B45309", "#0D9488", "#0F766E", "#16A34A", "#4F46E5",
  "#7C3AED", "#BE185D", "#0284C7", "#0891B2", "#65A30D",
  "#C2410C", "#6D28D9", "#0369A1", "#047857", "#9F1239"
] as const;

function pickNumber(upperBound: number): number {
  try {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0] % upperBound;
  } catch {
    return Math.floor(Math.random() * upperBound);
  }
}

export function getUserAvatarColor(userId: string): string {
  if (!userId) return avatarPalette[0];
  try {
    const previous: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const colors = previous && typeof previous === "object" && !Array.isArray(previous)
      ? previous as Record<string, unknown> : {};
    const existing = colors[userId];
    if (typeof existing === "string" && (avatarPalette as readonly string[]).includes(existing)) return existing;
    const used = new Set(Object.values(colors).filter(v => typeof v === "string"));
    const unused = avatarPalette.filter(color => !used.has(color));
    const choices: readonly string[] = unused.length ? unused : avatarPalette;
    const assigned = choices[pickNumber(choices.length)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({...colors, [userId]: assigned}));
    return assigned;
  } catch {
    // Fallback keeps a stable color when storage is blocked.
    let hash=2166136261;
    for (let i=0;i<userId.length;i++) hash=Math.imul(hash ^ userId.charCodeAt(i),16777619);
    return avatarPalette[(hash>>>0)%avatarPalette.length];
  }
}
