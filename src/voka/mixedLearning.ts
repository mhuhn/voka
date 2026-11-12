import type { VokaData } from "./data";
import { effectiveLearningPause } from "./learning";

export interface MixedListCount {
  list_id:string;
  subject_id:string;
  count:number;
}

/**
 * Immediate, local preview of what can be studied today.
 * The SQL preview and start RPC are authoritative and apply identical rules.
 * Tags are a conjunction: every selected tag must belong to the list.
 */
export function dueMixedLists(
  data:VokaData,subjectIds:string[],tags:string[],now=Date.now()
):MixedListCount[] {
  const ids=new Set(subjectIds);
  return data.lists.flatMap(list=>{
    if(!ids.has(list.subject_id)||!tags.every(tag=>list.tags.includes(tag)))return [];
    const state=data.learningStates.find(item=>item.list_id===list.id);
    if(effectiveLearningPause(list.learning_paused_until,state?.calendar_pause_until,now))return [];
    const incomplete=data.cards.filter(card=>card.list_id===list.id&&card.success_count<4);
    if(!incomplete.length)return [];
    const min=Math.min(...incomplete.map(card=>card.position));
    return [{list_id:list.id,subject_id:list.subject_id,
      count:incomplete.filter(card=>card.position===min).length}];
  });
}
