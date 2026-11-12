import { describe, expect, it } from "vitest";
import {
  isCardDue,learningProgress,pauseMinutesLeft,pickReverseDirection,
  effectiveLearningPause,calendarPauseDay,
  MAX_LEARNING_POINTS,LEARNING_PAUSE_MINUTES
} from "../../src/voka/learning";

describe("Voka learning rules",()=>{
 it("considers only position-zero cards below four successful runs as due",()=>{
   expect(MAX_LEARNING_POINTS).toBe(4);
   expect(isCardDue({position:0,success_count:0})).toBe(true);
   expect(isCardDue({position:0,success_count:3})).toBe(true);
   expect(isCardDue({position:0,success_count:4})).toBe(false);
   expect(isCardDue({position:1,success_count:1})).toBe(false);
 });
 it("computes four-point progress and never exceeds 100%",()=>{
   expect(learningProgress([])).toBe(0);
   expect(learningProgress([{success_count:4},{success_count:4}])).toBe(100);
   expect(learningProgress([{success_count:1},{success_count:3}])).toBe(50);
   expect(learningProgress([{success_count:0},{success_count:2}])).toBe(25);
   // Five equal-weight cards: (0+1+1+3+4) / (5*4) = 45%.
   expect(learningProgress([0,1,1,3,4].map(success_count=>({success_count})))).toBe(45);
 });
 it("displays the remaining two-hour pause rounded upward to minutes",()=>{
   const now=Date.parse("2026-11-12T10:00:00Z");
   expect(LEARNING_PAUSE_MINUTES).toBe(120);
   expect(pauseMinutesLeft("2026-11-12T12:00:00Z",now)).toBe(120);
   expect(pauseMinutesLeft("2026-11-12T10:42:00Z",now)).toBe(42);
   expect(pauseMinutesLeft("2026-11-12T10:00:01Z",now)).toBe(1);
   expect(pauseMinutesLeft("2026-11-12T09:00:00Z",now)).toBe(0);
   expect(pauseMinutesLeft(null,now)).toBe(0);
 });
 it("chooses the later of the calendar and two-hour pause",()=>{
   const now=Date.parse("2026-11-16T17:00:00Z"); // Monday 18:00 Berlin
   expect(effectiveLearningPause("2026-11-16T19:00:00Z","2026-11-16T23:00:00Z",now))
    .toEqual({kind:"calendar",until:"2026-11-16T23:00:00Z"});
   expect(effectiveLearningPause("2026-11-16T19:00:00Z","2026-11-16T16:00:00Z",now))
    .toEqual({kind:"hours",minutes:120});
   expect(effectiveLearningPause("2026-11-16T16:00:00Z","2026-11-16T16:00:00Z",now))
    .toBeNull();
 });
 it("uses midnight in the session timezone including daylight-saving time",()=>{
   const monday=Date.parse("2026-11-16T17:00:00Z"); // Monday 18:00 Berlin
   expect(calendarPauseDay("2026-11-16T23:00:00Z","Europe/Berlin","de-DE",monday))
    .toEqual({tomorrow:true,weekday:"Dienstag"});
   expect(calendarPauseDay("2026-11-17T23:00:00Z","Europe/Berlin","de-DE",monday))
    .toEqual({tomorrow:false,weekday:"Mittwoch"});
   const beforeDst=Date.parse("2026-03-28T17:00:00Z");
   expect(calendarPauseDay("2026-03-29T22:00:00Z","Europe/Berlin","de-DE",beforeDst))
    .toEqual({tomorrow:false,weekday:"Montag"});
 });
 it("allows randomized reverse questioning only when enabled",()=>{
   expect(pickReverseDirection(false,()=>0.1)).toBe(false);
   expect(pickReverseDirection(true,()=>0.1)).toBe(true);
   expect(pickReverseDirection(true,()=>0.9)).toBe(false);
 });
});
