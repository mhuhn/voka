import { describe, expect, it } from "vitest";
import {
  isCardDue,learningProgress,pauseMinutesLeft,pickReverseDirection,
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
 it("allows randomized reverse questioning only when enabled",()=>{
   expect(pickReverseDirection(false,()=>0.1)).toBe(false);
   expect(pickReverseDirection(true,()=>0.1)).toBe(true);
   expect(pickReverseDirection(true,()=>0.9)).toBe(false);
 });
});
