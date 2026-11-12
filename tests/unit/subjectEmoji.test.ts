import { describe, expect, it } from "vitest";
import { suggestSubjectEmoji } from "../../src/voka/subjectEmoji";

describe("subject emoji suggestions", () => {
  it.each([
    ["Spanisch","🇪🇸"],["Italienisch","🇮🇹"],["Polnisch","🇵🇱"],
    ["Dänisch","🇩🇰"],["Portugiesisch","🇵🇹"],["Tschechisch","🇨🇿"],
    ["Schwedisch","🇸🇪"],["Russisch","🇷🇺"],["Chinesisch","🇨🇳"],
    ["Japanisch","🇯🇵"]
  ])("suggests %s for a language", (title, emoji) => {
    expect(suggestSubjectEmoji(title, "Sprachen")).toBe(emoji);
    expect(suggestSubjectEmoji(title, "Sonstige")).toBe(emoji);
    expect(suggestSubjectEmoji(title.toLocaleUpperCase("de-DE")," Sprachen ")).toBe(emoji);
  });

  it.each([
    ["Geographie","🌍"],["Schwimmen","🏊"],["Medien","📰"],
    ["Sozialkunde","🏛️"],["Gesellschaftskunde","👥"],
    ["Politik","🗳️"],["Wirtschaft","📈"],["Ethik","⚖️"],["Religion","🕊️"]
  ])("suggests %s across subject groups", (title, emoji) => {
    expect(suggestSubjectEmoji(title, "Sonstige")).toBe(emoji);
    expect(suggestSubjectEmoji(title, "MINT")).toBe(emoji);
  });

  it("does not suggest a special emoji for unknown names", () => {
    expect(suggestSubjectEmoji("Fantastik", "Sprachen")).toBeNull();
  });
});
