import { authManager } from "../auth/manager";

export interface SubjectGroup { id: string; user_id: string; title: string }
export interface Subject { id: string; user_id: string; group_id: string; title: string; emoji: string }
export interface VokaList { id: string; user_id: string; subject_id: string; title: string; tags: string[]; question_label: string; answer_label: string; learn_both_directions: boolean; updated_at: string; created_at: string }
export interface VokaCard { id: string; user_id: string; list_id: string; question: string; answer: string; marked: boolean; success_count: number; position: number; created_at: string; updated_at: string }
export interface Usage { list_id: string; user_id: string; last_used_at: string | null }
export interface VokaData { groups: SubjectGroup[]; subjects: Subject[]; lists: VokaList[]; cards: VokaCard[]; usage: Usage[] }
export const emptyData = (): VokaData => ({ groups: [], subjects: [], lists: [], cards: [], usage: [] });

function client() {
  const c = authManager.activeClient;
  if (!c) throw new Error("No active account");
  return c;
}
async function check<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const {data,error} = await promise;
  if (error) throw new Error(error.message);
  return data as T;
}
export async function loadVoka(): Promise<VokaData> {
  const c = client();
  await check(c.rpc("voka_initialize_defaults"));
  const [groups,subjects,lists,cards,usage] = await Promise.all([
    check<SubjectGroup[]>(c.from("voka_subjectgroups").select("*")),
    check<Subject[]>(c.from("voka_subjects").select("*")),
    check<VokaList[]>(c.from("voka_lists").select("*")),
    check<VokaCard[]>(c.from("voka_cards").select("*")),
    check<Usage[]>(c.from("voka_list_usage").select("*"))
  ]);
  return {groups,subjects,lists,cards,usage};
}
export async function insertGroup(title: string) { await check(client().from("voka_subjectgroups").insert({title})); }
export async function updateGroup(id:string,title:string) { await check(client().from("voka_subjectgroups").update({title}).eq("id",id)); }
export async function deleteGroup(id:string) { await check(client().from("voka_subjectgroups").delete().eq("id",id)); }
export async function insertSubject(group_id:string,title:string,emoji:string) { await check(client().from("voka_subjects").insert({group_id,title,emoji})); }
export async function updateSubject(id:string,title:string,emoji:string,group_id:string) { await check(client().from("voka_subjects").update({title,emoji,group_id}).eq("id",id)); }
export async function deleteSubject(id:string) { await check(client().from("voka_subjects").delete().eq("id",id)); }
export type ListInput = Pick<VokaList,"subject_id"|"title"|"tags"|"question_label"|"answer_label"|"learn_both_directions">;
export async function saveList(value:ListInput,id?:string) {
  const c=client();
  if(id) { await check(c.from("voka_lists").update(value).eq("id",id)); return id; }
  const row=await check<{id:string}>(c.from("voka_lists").insert(value).select("id").single());
  return row.id;
}
export async function deleteList(id:string) { await check(client().from("voka_lists").delete().eq("id",id)); }
export type CardInput = Pick<VokaCard,"list_id"|"question"|"answer"|"marked">;
export async function saveCard(value:CardInput,id?:string) {
  if(id) await check(client().from("voka_cards").update(value).eq("id",id));
  else await check(client().from("voka_cards").insert({...value,success_count:0,position:0}));
}
export async function markCard(id:string,marked:boolean) { await check(client().from("voka_cards").update({marked}).eq("id",id)); }
export async function deleteCard(id:string) { await check(client().from("voka_cards").delete().eq("id",id)); }
export function usageDate(data:VokaData, listId:string): number {
  const value=data.usage.find(u=>u.list_id===listId)?.last_used_at;
  return value?new Date(value).getTime():0;
}
export function subjectUsage(data:VokaData,subjectId:string):number {
  return Math.max(0,...data.lists.filter(l=>l.subject_id===subjectId).map(l=>usageDate(data,l.id)));
}
export function groupUsage(data:VokaData,groupId:string):number {
  return Math.max(0,...data.subjects.filter(s=>s.group_id===groupId).map(s=>subjectUsage(data,s.id)));
}
