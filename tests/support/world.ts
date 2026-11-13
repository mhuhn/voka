import { Before, After, setDefaultTimeout, World } from "@cucumber/cucumber";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "@playwright/test";

setDefaultTimeout(30_000);

const users = [
  { id: "00000000-0000-4000-8000-000000000001", email: "alice@example.test", name: "Alice" },
  { id: "00000000-0000-4000-8000-000000000002", email: "bob@example.test", name: "Bob" }
];

function userPayload(user: typeof users[number]) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: user.name },
    identities: []
  };
}

function makeToken(user: typeof users[number]) {
  const b64 = (part: unknown) => Buffer.from(JSON.stringify(part)).toString("base64url");
  return b64({ alg: "HS256", typ: "JWT" }) + "." + b64({
    iss: "https://localhost/auth/v1", sub: user.id, aud: "authenticated",
    role: "authenticated", email: user.email, exp: Math.floor(Date.now() / 1000) + 3600
  }) + ".test-signature";
}

function json(data: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(data), headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } };
}

export class VokaWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
}

Before(async function (this: VokaWorld, { pickle }) {
  this.browser = await chromium.launch({ headless: true });
  const locales: Record<string, string> = {
    "@de": "de-DE", "@fr": "fr-FR", "@nl": "nl-NL",
    "@da": "da-DK", "@it": "it-IT"
  };
  const locale = pickle.tags.map(tag => locales[tag.name]).find(Boolean) ?? "en-US";
  const sampleData = pickle.tags.some(tag => tag.name === "@voka");
  const reverseData = pickle.tags.some(tag => tag.name === "@reverse");
  const learningData = pickle.tags.some(tag => tag.name === "@learning") || reverseData;
  const calendarBlocked = pickle.tags.some(tag => tag.name === "@calendar-blocked");
  const calendarReady = pickle.tags.some(tag => tag.name === "@calendar-ready");
  const progressCase = pickle.tags.some(tag => tag.name === "@progress");
  const mixedData = pickle.tags.some(tag => tag.name === "@mixed");
  const touchTablet = pickle.tags.some(tag => tag.name === "@touch");
  this.context = await this.browser.newContext({ locale, ...(touchTablet ? {hasTouch:true,viewport:{width:1180,height:820}} : {}) });
  this.page = await this.context.newPage();
  let importedList: Record<string,unknown> | null = null;
  let importedCards: Record<string,unknown>[] = [];
  let learningPausedUntil:string|null=null;
  let pauseSkipped=false;
  let lastLearningAt:string|null=calendarBlocked?new Date().toISOString():calendarReady?new Date(Date.now()-10*86_400_000).toISOString():null;
  const learningTimezone="UTC";
  let activeLearningQuery:string|null=null;
  const gradedLearningIds=new Set<string>();
  let learningCards=[
    {id:"40000000-0000-4000-8000-000000000001",user_id:users[0].id,
     list_id:"30000000-0000-4000-8000-000000000001",question:"go",answer:"went",
     marked:true,success_count:0,position:0,reverse_success_count:0,reverse_position:0,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
    {id:"40000000-0000-4000-8000-000000000002",user_id:users[0].id,
     list_id:"30000000-0000-4000-8000-000000000001",question:"be",answer:"was/were",
     marked:false,success_count:1,position:0,reverse_success_count:0,reverse_position:0,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
    {id:"40000000-0000-4000-8000-000000000003",user_id:users[0].id,
     list_id:"30000000-0000-4000-8000-000000000001",question:"choose",answer:"chose",
     marked:false,success_count:2,position:0,reverse_success_count:0,reverse_position:0,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"}
  ];

  if(reverseData)learningCards=[learningCards[0]];
  if(calendarBlocked||calendarReady){
    const firstPosition=calendarBlocked?1:4;
    learningCards=[
      {...learningCards[0],position:firstPosition,success_count:0},
      {...learningCards[1],position:firstPosition+2,success_count:1},
      {...learningCards[2],position:0,success_count:4}
    ];
  }
  const nextCalendarPause=()=>{
    const active=learningCards.filter(c=>c.success_count<4);
    const min=active.length?Math.min(...active.map(c=>c.position)):null;
    if(!lastLearningAt||min===null)return null;
    const last=new Date(lastLearningAt);
    const until=new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth(),last.getUTCDate()+min));
    return until.toISOString();
  };

  const englishListId="30000000-0000-4000-8000-000000000001";
  const mathListId="30000000-0000-4000-8000-000000000002";
  const extraListId="30000000-0000-4000-8000-000000000003";
  const mixedPaused=new Set<string>();
  let mixedQueryId:string|null=null;
  let mixedCardIds:string[]=[];
  const gradedMixed=new Set<string>();
  const mixedLists=[
    {id:mathListId,user_id:users[0].id,subject_id:"20000000-0000-4000-8000-000000000002",
      title:"Mathe Übungen",tags:["Verben","Unit 3"],question_label:"Aufgabe",answer_label:"Lösung",
      learn_both_directions:false,reverse_share:0,learning_paused_until:null,last_learning_at:null,learning_timezone:"UTC",
      created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
    {id:extraListId,user_id:users[0].id,subject_id:"20000000-0000-4000-8000-000000000002",
      title:"Nicht passende Tags",tags:["Verben"],question_label:"Aufgabe",answer_label:"Lösung",
      learn_both_directions:false,reverse_share:0,learning_paused_until:null,last_learning_at:null,learning_timezone:"UTC",
      created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"}
  ];
  const mixedCards=[
    {id:"40000000-0000-4000-8000-000000000003",user_id:users[0].id,list_id:englishListId,
      question:"choose",answer:"chose",marked:false,success_count:1,position:1,
      created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
    {id:"40000000-0000-4000-8000-000000000010",user_id:users[0].id,list_id:mathListId,
      question:"2 + 2",answer:"4",marked:false,success_count:0,position:0,
      created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
    {id:"40000000-0000-4000-8000-000000000011",user_id:users[0].id,list_id:extraListId,
      question:"not due for selected tags",answer:"excluded",marked:false,success_count:0,position:0,
      created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"}
  ];
  const mixedListSet=()=>[
    {id:englishListId,subject_id:"20000000-0000-4000-8000-000000000001",title:"Irregular Verbs",tags:["Verben","Unit 3"]},
    ...mixedLists
  ];
  const selectedMixedLists=(subjects:string[],tags:string[])=>mixedListSet()
    .filter(l=>subjects.includes(l.subject_id)&&tags.every(tag=>l.tags.includes(tag))&&!mixedPaused.has(l.id));
  const mixedDue=(listId:string)=>{const cards=mixedCards.filter(c=>c.list_id===listId&&c.success_count<4);
    const min=Math.min(...cards.map(c=>c.position));
    return Number.isFinite(min)?cards.filter(c=>c.position===min):[];};
  const sharedId="50000000-0000-4000-8000-000000000001";
  const importedId="60000000-0000-4000-8000-000000000001";
  const sharedCards=[
    {question:"walk",answer:"walked",marked:true},
    {question:"write",answer:"wrote",marked:false}
  ];


  const profilesByUser=new Map(users.map(u=>[u.id,[{id:u.id,user_id:u.id,first_name:u.name,last_name:"",is_default:true,created_at:"2026-01-01T00:00:00Z"}]]));
  let nextProfile=10;
  const signedInUser=(request:ReturnType<Route["request"]>)=>{
    try{
      const bearer=(request.headers()["authorization"]||"").replace(/^Bearer\\s+/i,"");
      const claims=JSON.parse(Buffer.from(bearer.split(".")[1],"base64url").toString("utf8")) as {sub:string};
      return users.find(u=>u.id===claims.sub)||users[0];
    }catch{return users[0];}
  };
  await this.page.route("http://127.0.0.1:54321/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
        "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-voka-profile-id"
      } });
      return;
    }

    if (path === "/auth/v1/token" && method === "POST") {
      const body = request.postDataJSON() as { email?: string; password?: string };
      const found = users.find(u => u.email === body.email);
      if (!found || body.password !== "correct-password") {
        await route.fulfill(json({ msg: "Invalid login credentials", error: "invalid_grant" }, 400));
        return;
      }
      await route.fulfill(json({
        access_token: makeToken(found),
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "refresh-" + found.id,
        user: userPayload(found)
      }));
      return;
    }

    if (path === "/auth/v1/user" && method === "GET") {
      // Validate the JWT originally issued by the mock, rather than generating
      // a new JWT: its time-dependent exp claim changes between requests.
      const bearer = (request.headers()["authorization"] || "").replace(/^Bearer\s+/i, "");
      let sub: string | undefined;
      try {
        const [header, payload, signature] = bearer.split(".");
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
          sub?: string; exp?: number;
        };
        if (header && signature === "test-signature" &&
            typeof claims.exp === "number" && claims.exp > Date.now() / 1000) {
          sub = claims.sub;
        }
      } catch { /* Malformed mock JWT */ }
      const found = users.find(u => u.id === sub);
      await route.fulfill(found ? json(userPayload(found)) : json({ msg: "Invalid JWT" }, 401));
      return;
    }

    if (path === "/auth/v1/signup" && method === "POST") {
      const body = request.postDataJSON() as { email: string };
      const found = users.find(u => u.email === body.email) ?? users[0];
      await route.fulfill(json({ user: userPayload(found), session: null }));
      return;
    }

    if (path === "/auth/v1/recover" && method === "POST") {
      await route.fulfill(json({}));
      return;
    }

    if (path === "/auth/v1/logout" && method === "POST") {
      await route.fulfill(json({}));
      return;
    }

    if(path==="/rest/v1/profiles"&&method==="GET"){
      await route.fulfill(json(profilesByUser.get(signedInUser(request).id)||[]));return;
    }
    if(path==="/rest/v1/rpc/voka_create_profile"&&method==="POST"){
      const user=signedInUser(request),body=request.postDataJSON() as {p_first_name:string;p_last_name:string};
      const id="a0000000-0000-4000-8000-"+String(nextProfile++).padStart(12,"0");
      profilesByUser.get(user.id)?.push({id,user_id:user.id,first_name:body.p_first_name,last_name:body.p_last_name||"",is_default:false,created_at:"2026-11-13T00:00:00Z"});
      await route.fulfill(json(id));return;
    }
    if(path==="/rest/v1/rpc/voka_delete_profile"&&method==="POST"){
      const user=signedInUser(request),body=request.postDataJSON() as {p_profile_id:string};
      const records=profilesByUser.get(user.id)||[];
      if(records.length<=1){await route.fulfill(json({message:"Cannot delete the last profile"},400));return;}
      const idx=records.findIndex(p=>p.id===body.p_profile_id);
      if(idx<0){await route.fulfill(json({message:"Profile not owned"},403));return;}
      const [removed]=records.splice(idx,1);
      if(removed.is_default)records[0].is_default=true;
      await route.fulfill(json(null));return;
    }
    if (path === "/rest/v1/rpc/voka_initialize_defaults" && method === "POST") {
      await route.fulfill(json(null));
      return;
    }
    if(mixedData&&path==="/rest/v1/rpc/voka_preview_mixed_learning_v2"&&method==="POST"){
      const body=request.postDataJSON() as {p_subject_ids:string[];p_tags:string[]};
      const selected=selectedMixedLists(body.p_subject_ids,body.p_tags);
      const lists=selected.map(l=>({list_id:l.id,subject_id:l.subject_id,count:mixedDue(l.id).length}));
      await route.fulfill(json({total:lists.reduce((sum,l)=>sum+l.count,0),lists}));return;
    }
    if(mixedData&&path==="/rest/v1/rpc/voka_begin_mixed_learning_v2"&&method==="POST"){
      const body=request.postDataJSON() as {p_subject_ids:string[];p_tags:string[];p_timezone:string};
      const selected=selectedMixedLists(body.p_subject_ids,body.p_tags)
        .sort((a,b)=>a.subject_id.localeCompare(b.subject_id)||a.title.localeCompare(b.title));
      mixedCardIds=[];
      for(const l of selected){
        const due=mixedDue(l.id);
        if(!due.length)continue;
        const min=Math.min(...due.map(c=>c.position));
        for(const card of mixedCards.filter(c=>c.list_id===l.id))card.position=Math.max(0,card.position-min);
        mixedCardIds.push(...mixedCards.filter(c=>c.list_id===l.id&&c.position===0&&c.success_count<4).map(c=>c.id));
      }
      mixedQueryId=mixedCardIds.length?"80000000-0000-4000-8000-000000000099":null;
      gradedMixed.clear();
      await route.fulfill(json(mixedCardIds.length?{query_id:mixedQueryId,cards:mixedCardIds.map(id=>({id,reverse:false}))}:{cards:[]}));return;
    }
    if(mixedData&&path==="/rest/v1/rpc/voka_grade_mixed_learning_v2"&&method==="POST"){
      const body=request.postDataJSON() as {p_query_id:string;p_card_id:string;p_result:"known"|"unknown"|"unsure"};
      const card=mixedCards.find(c=>c.id===body.p_card_id);
      if(!card||body.p_query_id!==mixedQueryId||gradedMixed.has(card.id)){
        await route.fulfill(json({message:"Invalid mixed grade"},400));return;
      }
      gradedMixed.add(card.id);
      const points=card.success_count;
      if(body.p_result==="known"){card.success_count=Math.min(4,points+1);card.position=points===0?2:points===1?6:19;}
      else if(body.p_result==="unknown"){card.success_count=0;card.position=1;} else card.position=1;
      const success_count=card.success_count,position=card.position;
      let paused_until:null|string=null;
      if(!mixedCards.some(c=>c.list_id===card.list_id&&c.success_count<4&&c.position===0)){
        mixedPaused.add(card.list_id);
        for(const c of mixedCards.filter(c=>c.list_id===card.list_id))c.position=Math.max(0,c.position-1);
        paused_until=new Date(Date.now()+120*60_000).toISOString();
      }
      const finished=gradedMixed.size===mixedCardIds.length;
      if(finished)mixedQueryId=null;
      await route.fulfill(json({success_count,position,finished,paused_until}));return;
    }
    if(mixedData&&path==="/rest/v1/rpc/voka_finish_learning"&&method==="POST"){
      mixedQueryId=null;
      await route.fulfill(json(null));return;
    }
    if(learningData&&path==="/rest/v1/rpc/voka_skip_learning_pause"&&method==="POST"){
      const body=request.postDataJSON() as {p_list_id:string};
      if(body.p_list_id!==englishListId){await route.fulfill(json({message:"Access denied"},403));return;}
      learningPausedUntil=null;
      pauseSkipped=true;
      await route.fulfill(json(null));return;
    }
    if(learningData && path==="/rest/v1/rpc/voka_begin_learning_v2" && method==="POST"){
      const body=request.postDataJSON() as {p_list_id:string;p_timezone?:string};
      const unlearned=learningCards.filter(c=>c.success_count<4);
      if(!unlearned.length){
        await route.fulfill(json({all_learned:true,cards:[]}));return;
      }
      const dayUntil=nextCalendarPause();
      if(!pauseSkipped&&((learningPausedUntil && Date.parse(learningPausedUntil)>Date.now()) ||
         (dayUntil && Date.parse(dayUntil)>Date.now()))){
        await route.fulfill(json({paused_until:learningPausedUntil,calendar_pause_until:dayUntil,cards:[]}));return;
      }
      const min=Math.min(...unlearned.map(c=>c.position));
      if(min>0)for(const card of learningCards)card.position=Math.max(0,card.position-min);
      const due=learningCards.filter(c=>c.position===0&&c.success_count<4);
      const reverseDue=reverseData?learningCards.filter(c=>c.reverse_position===0&&c.reverse_success_count<1):[];
      lastLearningAt=new Date().toISOString();
      pauseSkipped=false;
      if(!body.p_timezone){
        await route.fulfill(json({message:"Timezone required"},400));return;
      }
      activeLearningQuery="80000000-0000-4000-8000-000000000001";
      gradedLearningIds.clear();
      await route.fulfill(json({
        query_id:activeLearningQuery,
        cards:[...due.map(c=>({id:c.id,reverse:false})).reverse(),...reverseDue.map(c=>({id:c.id,reverse:true}))]
      }));
      return;
    }
    if(learningData && path==="/rest/v1/rpc/voka_grade_learning_v2" && method==="POST"){
      const body=request.postDataJSON() as {p_query_id:string;p_card_id:string;p_reverse:boolean;p_result:string};
      const card=learningCards.find(c=>c.id===body.p_card_id);
      const key=body.p_card_id+":"+body.p_reverse;
      if(!card||body.p_query_id!==activeLearningQuery||
          (body.p_reverse?card.reverse_position:card.position)!==0||gradedLearningIds.has(key)){
        await route.fulfill(json({message:"Card orientation is not due"},400));return;
      }
      gradedLearningIds.add(key);
      if(body.p_reverse){
        const before=card.reverse_success_count;
        card.reverse_success_count=body.p_result==="known"?Math.min(1,before+1):body.p_result==="unknown"?0:before;
        card.reverse_position=body.p_result==="known"?10:1;
      }else{
        const before=card.success_count;
        if(body.p_result==="known"){
          card.success_count=Math.min(4,before+1);
          card.position=before===0?2:before===1?6:19;
        }else if(body.p_result==="unknown"){card.success_count=0;card.position=1;}
        else card.position=1;
      }
      const finished=learningCards.every(c=>
        (c.position!==0||c.success_count>=4)&&
        (!reverseData||c.reverse_position!==0||c.reverse_success_count>=1)
      );
      const position=body.p_reverse?card.reverse_position:card.position;
      const success_count=body.p_reverse?card.reverse_success_count:card.success_count;
      if(finished){
        for(const entry of learningCards){
          entry.position=Math.max(0,entry.position-1);
          entry.reverse_position=Math.max(0,entry.reverse_position-1);
        }
        learningPausedUntil=new Date(Date.now()+120*60_000).toISOString();
        activeLearningQuery=null;
      }
      await route.fulfill(json({success_count,position,reverse:body.p_reverse,finished,paused_until:learningPausedUntil}));
      return;
    }
    if(learningData && path==="/rest/v1/rpc/voka_finish_learning" && method==="POST"){
      activeLearningQuery=null;
      await route.fulfill(json(null));return;
    }
    if(learningData && path==="/rest/v1/voka_cards" && method==="PATCH"){
      const cardId=url.searchParams.get("id")?.replace("eq.","");
      const card=learningCards.find(c=>c.id===cardId);
      const values=request.postDataJSON() as Record<string,unknown>;
      if(card){
        if(typeof values.question==="string")card.question=values.question;
        if(typeof values.answer==="string")card.answer=values.answer;
        if(typeof values.marked==="boolean")card.marked=values.marked;
      }
      await route.fulfill(json(null,204));return;
    }
    if (path === "/rest/v1/rpc/voka_get_shared_list" && method === "POST") {
      const body=request.postDataJSON() as {p_list_id:string};
      await route.fulfill(json(body.p_list_id===sharedId ? {
        id:sharedId,title:"Shared Verbs",tags:["Verben","Unit 7"],
        question_label:"Infinitiv",answer_label:"Simple Past",
        learn_both_directions:true,cards:sharedCards
      } : null));
      return;
    }
    if (path === "/rest/v1/rpc/voka_import_shared_list" && method === "POST") {
      const body=request.postDataJSON() as {p_list_id:string;p_subject_id:string;p_title:string;p_tags:string[]};
      if(body.p_list_id!==sharedId){
        await route.fulfill(json({message:"Shared list not found"},404));return;
      }
      importedList={
        id:importedId,user_id:users[0].id,subject_id:body.p_subject_id,
        title:body.p_title,tags:body.p_tags,question_label:"Infinitiv",
        answer_label:body.p_subject_id==="20000000-0000-4000-8000-000000000001"?"Englisch":"Simple Past",
        learn_both_directions:true,created_at:"2026-11-12T10:00:00Z",updated_at:"2026-11-12T10:00:00Z"
      };
      importedCards=sharedCards.map((card,i)=>({
        id:"70000000-0000-4000-8000-00000000000"+(i+1),
        list_id:importedId,user_id:users[0].id,...card,position:0,success_count:0,
        created_at:"2026-11-12T10:00:00Z",updated_at:"2026-11-12T10:00:00Z"
      }));
      await route.fulfill(json(importedId));return;
    }
    if (path.startsWith("/rest/v1/voka_") && method === "GET") {
      const fixtures: Record<string, unknown[]> = {
        voka_subjectgroups: [
          {id:"10000000-0000-4000-8000-000000000001",user_id:users[0].id,title:"Sprachen"},
          {id:"10000000-0000-4000-8000-000000000002",user_id:users[0].id,title:"MINT"},
          {id:"10000000-0000-4000-8000-000000000003",user_id:users[0].id,title:"Sonstige"}
        ],
        voka_subjects: [
          {id:"20000000-0000-4000-8000-000000000001",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000001",title:"Englisch",emoji:"🇬🇧"},
          {id:"20000000-0000-4000-8000-000000000003",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000001",title:"Französisch",emoji:"🇫🇷"},
          {id:"20000000-0000-4000-8000-000000000004",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000001",title:"Latein",emoji:"🏛️"},
          {id:"20000000-0000-4000-8000-000000000005",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000001",title:"Griechisch",emoji:"🇬🇷"},
          {id:"20000000-0000-4000-8000-000000000002",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000002",title:"Mathe",emoji:"➗"}
        ],
        voka_lists: [
          {id:"30000000-0000-4000-8000-000000000001",user_id:users[0].id,subject_id:"20000000-0000-4000-8000-000000000001",title:"Irregular Verbs",tags:["Verben","Unit 3"],question_label:"Infinitiv",answer_label:"Englisch",learn_both_directions:reverseData||(!learningData&&!mixedData),reverse_share:reverseData?25:0,learning_paused_until:mixedData&&mixedPaused.has(englishListId)?new Date(Date.now()+120*60_000).toISOString():learningPausedUntil,learning_pause_skipped:pauseSkipped,last_learning_at:lastLearningAt,learning_timezone:learningTimezone,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
          ...(importedList?[importedList]:[]),
          ...(mixedData?mixedLists.map(l=>({...l,learning_paused_until:mixedPaused.has(l.id)?new Date(Date.now()+120*60_000).toISOString():null})):[])
        ],
        voka_cards: mixedData ? mixedCards : progressCase ? [0,1,1,3,4].map((success_count,i)=>({
          id:"90000000-0000-4000-8000-00000000000"+(i+1),
          user_id:users[0].id,list_id:"30000000-0000-4000-8000-000000000001",
          question:"Progress word "+(i+1),answer:"Answer "+(i+1),
          marked:false,success_count,position:i,
          created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"
        })) : learningData ? [...learningCards, ...importedCards] : [
          {id:"40000000-0000-4000-8000-000000000001",user_id:users[0].id,list_id:"30000000-0000-4000-8000-000000000001",question:"go",answer:"went",marked:true,success_count:0,position:3,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
          {id:"40000000-0000-4000-8000-000000000002",user_id:users[0].id,list_id:"30000000-0000-4000-8000-000000000001",question:"be",answer:"was/were",marked:false,success_count:4,position:6,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
          {id:"40000000-0000-4000-8000-000000000003",user_id:users[0].id,list_id:"30000000-0000-4000-8000-000000000001",question:"choose",answer:"chose",marked:false,success_count:1,position:1,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
          ...importedCards
        ],
        voka_list_usage: [],
        voka_list_learning_state: [{list_id:"30000000-0000-4000-8000-000000000001",min_position:learningData?Math.min(...learningCards.filter(c=>c.success_count<4).map(c=>c.position)):1,calendar_pause_until:learningData&&!pauseSkipped?nextCalendarPause():null},
          ...(mixedData?mixedLists.map(l=>({list_id:l.id,min_position:Math.min(...mixedCards.filter(c=>c.list_id===l.id).map(c=>c.position)),calendar_pause_until:null})):[])]
      };
      const user=signedInUser(request);
      // The mocked Data API enforces isolation by the explicit selected profile header.
      const selected=request.headers()["x-voka-profile-id"] || user.id;
      const owner=profilesByUser.get(user.id)?.some(p=>p.id===selected);
      const sameDefaultProfile=selected===user.id;
      await route.fulfill(json(sampleData && owner && sameDefaultProfile
        ? fixtures[path.split("/").pop() || ""] || [] : []));
      return;
    }
    if (path.startsWith("/rest/v1/voka_") && ["POST","PATCH","DELETE"].includes(method)) {
      await route.fulfill(json(null, 204));
      return;
    }

    await route.fulfill(json({ error: "Unsupported mock endpoint: " + method + " " + path }, 404));
  });
});

After(async function (this: VokaWorld) {
  await this.context?.close();
  await this.browser?.close();
});
