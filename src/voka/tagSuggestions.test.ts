import { describe,it,expect } from "vitest";
import { allSubjectTags,recentSubjectTags,matchingSubjectTags } from "./tagSuggestions";
import type { VokaList } from "./data";
const make=(id:string,subject_id:string,tags:string[],updated_at:string)=>({id,subject_id,tags,updated_at}) as VokaList;
const lists=[
 make("a","english",["verbs","old"],"2026-11-01T10:00:00Z"),
 make("b","math",["math-only"],"2026-11-13T08:00:00Z"),
 make("c","english",["past","verbs","irregular"],"2026-11-12T10:00:00Z")
];
describe("subject tag suggestions",()=>{
 it("uses only matching subject and most recently modified lists",()=>{
   expect(recentSubjectTags(lists,"english")).toEqual(["irregular","verbs","past"]);
 });
 it("deduplicates and filters case-insensitively",()=>{
   expect(allSubjectTags(lists,"english")).toEqual(["irregular","verbs","past","old"]);
   expect(matchingSubjectTags(lists,"english","IR",[])).toEqual(["irregular"]);
   expect(matchingSubjectTags(lists,"english","",["irregular","past"])).toEqual(["verbs","old"]);
 });
 it("suggests nothing for subjects without lists",()=>{
   expect(recentSubjectTags(lists,"french")).toEqual([]);
 });
});
