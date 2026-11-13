import type { VokaData } from "./data";
import { effectiveLearningPause, reverseMaxPoints, cardNextPosition } from "./learning";

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
    const cards=data.cards.filter(card=>card.list_id===list.id);
    const share=list.reverse_share??0;
    const min=Math.min(...cards.map(card=>cardNextPosition(card,share)));
    if(!Number.isFinite(min))return [];
    const reverseMax=reverseMaxPoints(share);
    const count=cards.reduce((sum,card)=>sum+
      Number(card.success_count<4&&card.position===min)+
      Number(reverseMax>0&&(card.reverse_success_count??0)<reverseMax&&(card.reverse_position??0)===min),0);
    return [{list_id:list.id,subject_id:list.subject_id,count}];
  });
}
