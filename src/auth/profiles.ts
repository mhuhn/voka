import { authManager } from "./manager";

export interface VokaProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  emoji: string;
  is_default: boolean;
}
export const PROFILE_EMOJIS = ["🙂","😀","🐼","🦊","🐻","🐱","🐶","🐸","🦄","🐧","🐨","🐯","🦁","🐙","🐝","🦋","🌸","🌻","🌈","⭐","🚀","⚽","🎨","🎵","🧠","📚","🍀","🍕","🐢","🦉"] as const;
export function validProfileEmoji(input:string):boolean {
  const emoji=input.trim().normalize("NFC");
  if(!emoji||Array.from(emoji).length>32||/\s/u.test(emoji))return false;
  const segments=Array.from(new Intl.Segmenter(undefined,{granularity:"grapheme"}).segment(emoji));
  return segments.length===1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Presentation}\u20e3]/u.test(emoji);
}
export function availableEmoji(profiles:Pick<VokaProfile,"emoji">[],excludeId?:string,allProfiles?:VokaProfile[]):string {
  const used=new Set(profiles.filter((p,i)=>!excludeId||!allProfiles||allProfiles[i]?.id!==excludeId).map(p=>p.emoji));
  return PROFILE_EMOJIS.find(emoji=>!used.has(emoji))||"";
}
export function profileName(profile: VokaProfile): string {
  return profile.display_name?.trim() || [profile.first_name,profile.last_name].filter(Boolean).join(" ").trim() || "Profil";
}
export function profileEmoji(profile: VokaProfile | null | undefined): string {
  return profile?.emoji || "🙂";
}
export interface ProfileSnapshot {
  profiles: VokaProfile[];
  activeId: string | null;
  userId: string | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
}
const empty = ():ProfileSnapshot=>({profiles:[],activeId:null,userId:null,loading:true,busy:false,error:null});

class ProfileManager {
  private state:ProfileSnapshot=empty();
  private listeners=new Set<()=>void>();
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  snapshot=()=>this.state;
  private patch(changes:Partial<ProfileSnapshot>){
    this.state={...this.state,...changes};
    for(const listener of this.listeners)listener();
  }
  reset(){
    if(this.state.userId===null)return;
    this.patch(empty());
  }
  private storageKey(userId:string){return "voka:selected-profile:"+userId;}
  async refresh(userId:string) {
    const client=authManager.activeClient;
    if(!client || authManager.activeUser?.id!==userId){this.reset();return;}
    this.patch({loading:true,error:null});
    try{
      // Shared profiles contain identity; Voka-specific emojis live only in voka_profiles.
      // Provision missing extension rows for default/existing shared profiles on first use.
      const {error:ensureError}=await client.rpc("voka_ensure_profiles");
      if(ensureError)throw ensureError;
      const [shared,voka]=await Promise.all([
        client.from("profiles")
          .select("id,user_id,first_name,last_name,display_name,is_default").eq("user_id",userId)
          .order("created_at",{ascending:true}),
        client.from("voka_profiles").select("id,emoji").eq("user_id",userId)
      ]);
      if(shared.error)throw shared.error;
      if(voka.error)throw voka.error;
      if(authManager.activeUser?.id!==userId)return;
      const emojis=new Map((voka.data||[]).map(row=>[row.id,row.emoji]));
      const profiles=(shared.data||[]).map(row=>({
        ...row,emoji:emojis.get(row.id)||"🙂"
      })) as VokaProfile[];
      let preferred:string|null=null;
      try {preferred=localStorage.getItem(this.storageKey(userId));}catch{}
      const active=profiles.find(p=>p.id===preferred) || profiles.find(p=>p.id===this.state.activeId)
        || profiles.find(p=>p.is_default) || profiles[0];
      if(active){try{localStorage.setItem(this.storageKey(userId),active.id);}catch{}}
      this.patch({profiles,activeId:active?.id||null,userId,loading:false});
    }catch(e){if(authManager.activeUser?.id===userId)this.patch({loading:false,error:e instanceof Error?e.message:String(e)});}
  }
  select(id:string){
    const profile=this.state.profiles.find(profile=>profile.id===id);
    if(!profile)throw new Error("Profile not found");
    if(!this.state.userId)throw new Error("Sign in first");
    try{localStorage.setItem(this.storageKey(this.state.userId),id);}catch{}
    this.patch({activeId:id,error:null});
  }
  async create(name:string,emoji:string) {
    const userId=authManager.activeUser?.id;
    const client=authManager.activeClient;
    if(!client||!userId)throw new Error("Sign in first");
    if(!name.trim()||name.trim().length>120)throw new Error("Invalid profile name");
    if(!validProfileEmoji(emoji))throw new Error("Invalid profile emoji");
    if(this.state.profiles.some(p=>p.emoji===emoji.trim().normalize("NFC")))throw new Error("This emoji is already used by another profile");
    this.patch({busy:true,error:null});
    try{
      const {data,error}=await client.rpc("voka_create_profile_with_emoji",{p_name:name.trim(),p_emoji:emoji.trim().normalize("NFC")});
      if(error)throw error;
      await this.refresh(userId);
      if(typeof data==="string")this.select(data);
    }catch(e){this.patch({error:e instanceof Error?e.message:String(e)});throw e;}
    finally{this.patch({busy:false});}
  }
  async updateCurrent(name:string,emoji:string) {
    const userId=authManager.activeUser?.id;
    const current=this.activeProfile;
    if(!userId || !current)throw new Error("No active profile");

    if(!name.trim()||name.trim().length>120)throw new Error("Invalid profile name");
    if(!validProfileEmoji(emoji))throw new Error("Invalid profile emoji");
    if(this.state.profiles.some(p=>p.id!==current.id&&p.emoji===emoji.trim().normalize("NFC")))throw new Error("This emoji is already used by another profile");
    this.patch({busy:true,error:null});
    try{
      const {error}=await this.client.rpc("voka_update_profile",{
        p_profile_id:current.id,p_name:name.trim(),p_emoji:emoji.trim().normalize("NFC")
      });
      if(error)throw error;
      await this.refresh(userId);
    }catch(e){this.patch({error:e instanceof Error?e.message:String(e)});throw e;}
    finally{this.patch({busy:false});}
  }
  async delete(id:string){
    const userId=authManager.activeUser?.id;
    const client=authManager.activeClient;
    if(!client||!userId)throw new Error("Sign in first");
    if(this.state.profiles.length<=1)throw new Error("Cannot delete the last profile");
    if(!this.state.profiles.some(p=>p.id===id))throw new Error("Profile not found");
    this.patch({busy:true,error:null});
    try{
      const {error}=await client.rpc("voka_delete_profile",{p_profile_id:id});
      if(error)throw error;
      await this.refresh(userId);
    }catch(e){this.patch({error:e instanceof Error?e.message:String(e)});throw e;}
    finally{this.patch({busy:false});}
  }
  get activeProfile(){return this.state.profiles.find(p=>p.id===this.state.activeId)||null;}
  get client(){
    if(!this.state.activeId||this.state.userId!==authManager.activeUser?.id)throw new Error("No active profile");
    return authManager.clientForProfile(this.state.activeId);
  }
}
export const profileManager=new ProfileManager();
