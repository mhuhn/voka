/** Emoji suggestions for newly created Voka subjects. Users can override them. */
const languages: Record<string, string> = {
  "spanisch": "🇪🇸",
  "italienisch": "🇮🇹",
  "polnisch": "🇵🇱",
  "dänisch": "🇩🇰",
  "portugiesisch": "🇵🇹",
  "tschechisch": "🇨🇿",
  "schwedisch": "🇸🇪",
  "russisch": "🇷🇺",
  "chinesisch": "🇨🇳",
  "japanisch": "🇯🇵"
};

const otherSubjects: Record<string, string> = {
  "geographie": "🌍",
  "geografie": "🌍",
  "schwimmen": "🏊",
  "medien": "📰",
  "sozialkunde": "🏛️",
  "gesellschaftskunde": "👥",
  "politik": "🗳️",
  "wirtschaft": "📈",
  "ethik": "⚖️",
  "religion": "🕊️"
};

const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

/**
 * Language flags apply only inside the Sprachen group.
 * Other school subjects also receive suggestions in any group.
 */
export function suggestSubjectEmoji(title: string, groupTitle: string): string | null {
  const key = normalize(title);
  if (normalize(groupTitle) === "sprachen" && languages[key]) return languages[key];
  return otherSubjects[key] || null;
}
