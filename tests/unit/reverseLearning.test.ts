import { describe, expect, it } from "vitest";
import {
 reverseMaxPoints,learningProgress,isCardLearned,cardTotalPoints,cardNextPosition,
 REVERSE_LEVELS
} from "../../src/voka/learning";

describe("Voka reverse learning progress and scheduling",()=>{
 const card=(forward:number,reverse:number,position=0,reversePosition=0)=>({
   success_count:forward,reverse_success_count:reverse,position,reverse_position:reversePosition
 });
 it("supports exactly five reverse levels and max point counts",()=>{
   expect(REVERSE_LEVELS).toEqual([0,25,50,75,100]);
   for(const [level,max] of [[0,0],[25,1],[50,2],[75,3],[100,4]]){
     expect(reverseMaxPoints(level)).toBe(max);
   }
 });
 it("a 25-percent reverse level means 80/20 weighting",()=>{
   expect(learningProgress([card(4,0)],25)).toBe(80);
   expect(learningProgress([card(0,1)],25)).toBe(20);
   expect(learningProgress([card(4,1)],25)).toBe(100);
   expect(learningProgress([card(2,0),card(4,1)],25)).toBe(70);
 });
 it("a 50/75/100 level offers 2/3/4 reverse learning points",()=>{
   expect(learningProgress([card(4,0)],50)).toBe(67);
   expect(learningProgress([card(4,0)],75)).toBe(57);
   expect(learningProgress([card(4,0)],100)).toBe(50);
   expect(learningProgress([card(4,4)],100)).toBe(100);
 });
 it("caps reverse contribution after lowering a level",()=>{
   expect(cardTotalPoints(card(3,4),25)).toBe(4);
   expect(learningProgress([card(3,4)],25)).toBe(80);
 });
 it("a card is learned only if both active directions have finished",()=>{
   expect(isCardLearned(card(4,0),0)).toBe(true);
   expect(isCardLearned(card(4,0),25)).toBe(false);
   expect(isCardLearned(card(4,1),25)).toBe(true);
   expect(isCardLearned(card(3,4),100)).toBe(false);
 });
 it("finds the earliest outstanding position across both tracks",()=>{
   expect(cardNextPosition(card(2,0,7,3),25)).toBe(3);
   expect(cardNextPosition(card(4,0,0,10),25)).toBe(10);
   expect(cardNextPosition(card(4,1,0,24),25)).toBe(Infinity);
   expect(cardNextPosition(card(4,0,0,10),0)).toBe(Infinity);
 });
});
