import { describe,expect,it } from "vitest";
import { CARD_CSV_COLUMNS,exportCardsCsv,parseCardsCsv } from "./cardCsv";
import type { VokaCard } from "./data";

const card:VokaCard={
 id:"40000000-0000-4000-8000-000000000001",
 user_id:"00000000-0000-4000-8000-000000000001",
 list_id:"30000000-0000-4000-8000-000000000001",
 question:'hello, "world"\nagain',answer:'äöü, "oui"',marked:true,
 position:19,success_count:3,reverse_position:24,reverse_success_count:4,
 created_at:"2026-01-01T00:00:00Z",updated_at:"2026-01-01T00:00:00Z"
};
describe("Voka CSV",()=>{
 it("round-trips all columns including quoted commas and newlines",()=>{
   const csv=exportCardsCsv([card]);
   expect(csv.startsWith("\ufeff"+CARD_CSV_COLUMNS.join(","))).toBe(true);
   const [parsed]=parseCardsCsv(csv);
   for(const name of CARD_CSV_COLUMNS)expect(parsed[name]).toEqual(card[name]);
 });
 it("accepts reordered columns and new cards without ID",()=>{
   const fields=[...CARD_CSV_COLUMNS];
   const header=[...fields].reverse();
   const csv=header.join(",")+"\n"+header.map(x=>x==="id"?"":String(card[x])).map(x=>'"'+x.replace(/"/g,'""')+'"').join(",")+"\n";
   expect(parseCardsCsv(csv)[0].id).toBe("");
 });
 it("rejects malformed values and duplicate IDs",()=>{
   const valid=exportCardsCsv([card]);
   expect(()=>parseCardsCsv(valid.replace('"19"','"99"'))).toThrow();
   expect(()=>parseCardsCsv(valid+valid.split("\r\n")[1]+"\r\n")).toThrow(/repeated card ID/);
   expect(()=>parseCardsCsv(valid.replace('"true"','"yes"'))).toThrow();
 });
 it("rejects incomplete, unclosed and extra columns",()=>{
   expect(()=>parseCardsCsv("id,question\n1,2")).toThrow();
   expect(()=>parseCardsCsv(CARD_CSV_COLUMNS.join(",")+'\n"unfinished')).toThrow();
   expect(()=>parseCardsCsv(CARD_CSV_COLUMNS.join(",")+'\n1,2')).toThrow();
 });
 it("exports even an empty list with the required header",()=>{
   expect(parseCardsCsv(exportCardsCsv([]))).toEqual([]);
 });
});
