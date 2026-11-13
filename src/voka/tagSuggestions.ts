import type { VokaList } from "./data";

export function allSubjectTags(lists:VokaList[],subjectId:string):string[] {
  const result:string[]=[],seen=new Set<string>();
  for(const list of lists.filter(l=>l.subject_id===subjectId)
    .sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)||b.id.localeCompare(a.id))){
    // New tags are appended last by the editor.
    for(const value of [...list.tags].reverse()){
      const tag=value.trim();
      const key=tag.toLocaleLowerCase();
      if(tag&&!seen.has(key)){seen.add(key);result.push(tag);}
    }
  }
  return result;
}
export const recentSubjectTags=(lists:VokaList[],subjectId:string):string[]=>
  allSubjectTags(lists,subjectId).slice(0,3);
export function matchingSubjectTags(lists:VokaList[],subjectId:string,query:string,selected:string[]):string[]{
  const q=query.trim().toLocaleLowerCase(),existing=new Set(selected.map(s=>s.toLocaleLowerCase()));
  return allSubjectTags(lists,subjectId)
    .filter(tag=>!existing.has(tag.toLocaleLowerCase())&&(!q||tag.toLocaleLowerCase().startsWith(q)))
    .slice(0,8);
}
