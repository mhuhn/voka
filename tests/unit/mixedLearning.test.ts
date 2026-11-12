import { describe, expect, it } from "vitest";
import { dueMixedLists } from "../../src/voka/mixedLearning";
import type { VokaData } from "../../src/voka/data";

const now=Date.parse("2026-11-12T10:00:00Z");
const base={groups:[],subjects:[],usage:[],learningStates:[]} as VokaData;
const list=(id:string,subject_id:string,tags:string[],paused:string|null=null)=>({
 id,user_id:"user",subject_id,tags,title:id,question_label:"Q",answer_label:"A",
 learn_both_directions:false,learning_paused_until:paused,
 last_learning_at:null,learning_timezone:"Europe/Berlin",created_at:"",updated_at:""
});
const card=(list_id:string,position:number,success_count:number)=>({
 id:Math.random().toString(),user_id:"user",list_id,question:"Q",answer:"A",
 marked:false,position,success_count,created_at:"",updated_at:""
});
describe("mixed-subject due card preview",()=>{
 it("uses the minimum position from incomplete cards and checks every tag",()=>{
  const data:VokaData={...base,
   lists:[list("english","e",["Unit 3","Verbs"]),list("math","m",["Unit 3"])],
   cards:[card("english",2,0),card("english",2,1),card("english",0,4),card("math",0,0)]
  };
  expect(dueMixedLists(data,["e","m"],["Unit 3"],now))
    .toEqual([{list_id:"english",subject_id:"e",count:2},{list_id:"math",subject_id:"m",count:1}]);
  expect(dueMixedLists(data,["e","m"],["Verbs","Unit 3"],now))
    .toEqual([{list_id:"english",subject_id:"e",count:2}]);
  expect(dueMixedLists(data,[],[],now)).toEqual([]);
 });
 it("honors both two-hour and calendar-day pauses without changing progress",()=>{
  const data:VokaData={...base,
   lists:[list("a","e",[],new Date(now+3_600_000).toISOString()),list("b","e",[])],
   cards:[card("a",0,0),card("b",2,1)],
   learningStates:[{list_id:"b",min_position:2,calendar_pause_until:new Date(now+86_400_000).toISOString()}]
  };
  expect(dueMixedLists(data,["e"],[],now)).toEqual([]);
  expect(dueMixedLists(data,["e"],[],now+2*86_400_000))
    .toEqual([{list_id:"a",subject_id:"e",count:1},{list_id:"b",subject_id:"e",count:1}]);
 });
});
