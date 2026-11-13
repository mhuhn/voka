import { describe, expect, it } from "vitest";
import { feedbackNotes, type LearningSound } from "../../src/voka/feedbackAudio";

describe("quiet Voka learning feedback",()=>{
 it("uses four distinct, short, low-volume cues",()=>{
   const kinds:LearningSound[]=["known","unknown","unsure","complete"];
   for(const kind of kinds){
     const notes=feedbackNotes[kind];
     expect(notes.length).toBeGreaterThan(0);
     expect(notes.length).toBeLessThan(4);
     for(const note of notes){
       expect(note.gain).toBeGreaterThan(0);
       expect(note.gain).toBeLessThanOrEqual(0.025);
       expect(note.duration).toBeLessThanOrEqual(0.3);
       expect(note.frequency).toBeGreaterThan(120);
       expect(note.frequency).toBeLessThan(1200);
     }
   }
   expect(feedbackNotes.known[0].frequency).toBeLessThan(feedbackNotes.known[1].frequency);
   expect(feedbackNotes.unknown[0].frequency).toBeGreaterThan(feedbackNotes.unknown[1].frequency);
   expect(feedbackNotes.unsure).toHaveLength(1);
   expect(feedbackNotes.complete).toHaveLength(3);
   expect(feedbackNotes.complete.map(note=>note.frequency))
     .toEqual([...feedbackNotes.complete.map(note=>note.frequency)].sort((a,b)=>a-b));
 });
});