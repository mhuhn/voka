import { authManager } from "./manager";

export interface VokaProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  is_default: boolean;
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
      const {data,error}=await client.from("profiles")
        .select("id,user_id,first_name,last_name,is_default").eq("user_id",userId)
        .order("created_at",{ascending:true});
      if(error)throw error;
      if(authManager.activeUser?.id!==userId)return;
      const profiles=(data||[]) as VokaProfile[];
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
  async create(firstName:string,lastName="") {
    const userId=authManager.activeUser?.id;
    const client=authManager.activeClient;
    if(!client||!userId)throw new Error("Sign in first");
    if(!firstName.trim())throw new Error("Profile name required");
    this.patch({busy:true,error:null});
    try{
      const {data,error}=await client.rpc("voka_create_profile",{p_first_name:firstName.trim(),p_last_name:lastName.trim()});
      if(error)throw error;
      await this.refresh(userId);
      if(typeof data==="string")this.select(data);
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
