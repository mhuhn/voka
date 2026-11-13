import { describe,expect,it } from "vitest";
import {medalsFor,daysMissed,decayPoints} from "./streak";
describe("Profile streak — original Voka thresholds",()=>{
 it("uses exact medal boundaries",()=>{
  for(const [n,kind,count] of [[0,"wood",1],[2,"wood",1],[3,"bronze",1],[7,"bronze",1],[8,"silver",1],[14,"silver",1],[15,"gold",1],[27,"gold",1],[28,"gold",2],[41,"gold",2],[42,"gold",3],[70,"gold",5],[84,"gold",6]] as const){
   expect(medalsFor(n)).toEqual({kind,count});
  }
 });
 it("subtracts only full missed calendar days, including year changes",()=>{
  expect(daysMissed("2026-11-13","2026-11-13")).toBe(0);
  expect(daysMissed("2026-11-12","2026-11-13")).toBe(0);
  expect(daysMissed("2026-11-11","2026-11-13")).toBe(1);
  expect(daysMissed("2026-12-31","2027-01-03")).toBe(2);
 });
 it("subtracts 2 per missed day but never below zero",()=>{
  expect(decayPoints(10,2)).toEqual({n:6,lost:4});
  expect(decayPoints(1,2)).toEqual({n:0,lost:1});
  expect(decayPoints(0,10)).toEqual({n:0,lost:0});
 });
});