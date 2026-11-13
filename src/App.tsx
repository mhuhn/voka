import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, Check, LogOut, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { authManager } from "./auth/manager";
import { PROFILE_EMOJIS, profileEmoji, profileManager, profileName, validProfileEmoji } from "./auth/profiles";
import { isConfigured } from "./auth/config";
import { detectLanguage, translations, translateError, type Language } from "./lib/i18n";
import { changedAt, version, formatLastChange } from "./lib/buildInfo";
import VokaApp from "./voka/VokaApp";
import { getUserAvatarColor } from "./auth/userColors";
import { pendingSharedListId } from "./voka/sharing";

const googleEnabled = import.meta.env.VITE_GOOGLE_LOGIN_ENABLED === "true";

function Brand() {
  return <div className="v-auth-brand">
    <span className="v-auth-wordmark">Voka</span>
  </div>;
}

function AuthForm({ language }: { language: Language }) {
  const t = translations[language];
  const state = useSyncExternalStore(authManager.subscribe, authManager.snapshot);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const screen = state.screen;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (screen === "login") void authManager.login(email.trim(), password);
    if (screen === "register") void authManager.register(email.trim(), password, name.trim());
    if (screen === "forgot") void authManager.forgot(email.trim());
    if (screen === "reset") void authManager.resetPassword(password);
  };
  return (
    <Card className="v-auth-card">
      <CardHeader>
        {state.adding && <Button variant="ghost" className="mb-2 w-fit" onClick={() => authManager.cancelAdding()}><ArrowLeft size={16}/> {t.back}</Button>}
        <CardTitle>{screen === "login" ? t.signIn : screen === "register" ? t.createTitle : screen === "forgot" ? t.forgotTitle : t.resetTitle}</CardTitle>
        <CardDescription>{screen === "login" ? t.loginDescription : screen === "register" ? t.registerDescription : screen === "forgot" ? t.forgotDescription : t.resetDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          {screen === "register" && <div className="space-y-1.5"><Label htmlFor="name">{t.name}</Label><Input id="name" autoComplete="name" required value={name} onChange={e => setName(e.target.value)}/></div>}
          {screen !== "reset" && <div className="space-y-1.5"><Label htmlFor="email">{t.email}</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></div>}
          {screen !== "forgot" && <div className="space-y-1.5"><Label htmlFor="password">{screen === "reset" ? t.newPassword : t.password}</Label><Input id="password" type="password" autoComplete={screen === "login" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={e => setPassword(e.target.value)}/></div>}
          <Button className="v-auth-primary w-full" disabled={state.busy || !isConfigured} type="submit">{state.busy ? t.waiting : screen === "login" ? t.signIn : screen === "register" ? t.create : screen === "forgot" ? t.sendReset : t.savePassword}</Button>
        </form>
        {(screen === "login" || screen === "register") && <>
          <div className="relative my-6 text-center text-xs text-stone-400 before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-stone-200"><span className="relative bg-white px-3">{t.continueWith}</span></div>
          <div className={googleEnabled ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
            <Button className="v-auth-provider" variant="outline" disabled={state.busy || !isConfigured} onClick={() => void authManager.oauth("apple")}>Apple</Button>
            {googleEnabled && <Button className="v-auth-provider" variant="outline" disabled={state.busy || !isConfigured} onClick={() => void authManager.oauth("google")}>Google</Button>}
          </div>
        </>}
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          {screen === "login" && <><button type="button" className="v-auth-text-link" onClick={() => authManager.setScreen("register")}>{t.register}</button><button type="button" className="v-auth-text-link" onClick={() => authManager.setScreen("forgot")}>{t.forgot}</button></>}
          {(screen === "register" || screen === "forgot") && <button type="button" className="v-auth-text-link" onClick={() => authManager.setScreen("login")}>{t.backSignIn}</button>}
        </div>
      </CardContent>
    </Card>
  );
}

function Profile({ language, onClose }: { language: Language; onClose: () => void }) {
  const t=translations[language];
  const auth=useSyncExternalStore(authManager.subscribe,authManager.snapshot);
  const profiles=useSyncExternalStore(profileManager.subscribe,profileManager.snapshot);
  const user=authManager.activeUser;
  const [creating,setCreating]=useState(false);
  const [newName,setNewName]=useState("");
  const [newEmoji,setNewEmoji]=useState("");
  const [editing,setEditing]=useState(false);
  const [editName,setEditName]=useState("");
  const [editEmoji,setEditEmoji]=useState<string>("🙂");
  const labels:Record<Language,{profiles:string;switchProfile:string;newProfile:string;deleteProfile:string;lastProfile:string;name:string;emoji:string;edit:string;confirmDelete:string;create:string;save:string;cancel:string;loading:string}> = {
    de:{profiles:"Profile",switchProfile:"Profil wechseln",newProfile:"Neues Profil",deleteProfile:"Profil löschen",lastProfile:"Das letzte Profil kann nicht gelöscht werden.",name:"Profilname",emoji:"Profil-Emoji",edit:"Aktuelles Profil bearbeiten",confirmDelete:"Dieses Profil mit allen Fächern, Fachgruppen, Listen und Lernständen endgültig löschen?",create:"Profil anlegen",save:"Speichern",cancel:"Abbrechen",loading:"Profile laden …"},
    en:{profiles:"Profiles",switchProfile:"Switch profile",newProfile:"New profile",deleteProfile:"Delete profile",lastProfile:"The last profile cannot be deleted.",name:"Profile name",emoji:"Profile emoji",edit:"Edit current profile",confirmDelete:"Permanently delete this profile and all its subjects, lists and learning history?",create:"Create profile",save:"Save",cancel:"Cancel",loading:"Loading profiles…"},
    fr:{profiles:"Profils",switchProfile:"Changer de profil",newProfile:"Nouveau profil",deleteProfile:"Supprimer le profil",lastProfile:"Impossible de supprimer le dernier profil.",name:"Nom du profil",emoji:"Emoji du profil",edit:"Modifier le profil actuel",confirmDelete:"Supprimer définitivement ce profil et toutes ses données ?",create:"Créer le profil",save:"Enregistrer",cancel:"Annuler",loading:"Chargement des profils…"},
    nl:{profiles:"Profielen",switchProfile:"Profiel wisselen",newProfile:"Nieuw profiel",deleteProfile:"Profiel verwijderen",lastProfile:"Het laatste profiel kan niet worden verwijderd.",name:"Profielnaam",emoji:"Profiel-emoji",edit:"Huidig profiel bewerken",confirmDelete:"Dit profiel en alle gegevens definitief verwijderen?",create:"Profiel maken",save:"Opslaan",cancel:"Annuleren",loading:"Profielen laden…"},
    da:{profiles:"Profiler",switchProfile:"Skift profil",newProfile:"Ny profil",deleteProfile:"Slet profil",lastProfile:"Den sidste profil kan ikke slettes.",name:"Profilnavn",emoji:"Profil-emoji",edit:"Rediger aktuel profil",confirmDelete:"Slet profilen og alle dens data permanent?",create:"Opret profil",save:"Gem",cancel:"Annuller",loading:"Indlæser profiler…"},
    it:{profiles:"Profili",switchProfile:"Cambia profilo",newProfile:"Nuovo profilo",deleteProfile:"Elimina profilo",lastProfile:"L'ultimo profilo non può essere eliminato.",name:"Nome profilo",emoji:"Emoji del profilo",edit:"Modifica profilo attuale",confirmDelete:"Eliminare definitivamente questo profilo e tutti i dati?",create:"Crea profilo",save:"Salva",cancel:"Annulla",loading:"Caricamento profili…"}
  };
  const p=labels[language], active=profiles.profiles.find(profile=>profile.id===profiles.activeId);
  const hasMultiple=profiles.profiles.length>1;
  const suggestedEmoji=PROFILE_EMOJIS.find(emoji=>!profiles.profiles.some(profile=>profile.emoji===emoji))||"";
  const chosenNewEmoji=newEmoji||suggestedEmoji;
  const emojiTaken=(emoji:string,exceptId?:string)=>profiles.profiles.some(profile=>profile.id!==exceptId&&profile.emoji===emoji.trim().normalize("NFC"));
  const newEmojiError=!!chosenNewEmoji&&emojiTaken(chosenNewEmoji);
  const editEmojiError=!!editEmoji&&emojiTaken(editEmoji,active?.id);
  const create=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    try{await profileManager.create(newName,chosenNewEmoji);setCreating(false);setNewName("");setNewEmoji("");}
    catch{ /* Error is displayed within the profile page. */ }
  };
  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    try{await profileManager.updateCurrent(editName,editEmoji);setEditing(false);}
    catch{ /* Error is displayed within the profile page. */ }
  };
  const remove=async(id:string)=>{
    if(!hasMultiple||!window.confirm(p.confirmDelete))return;
    try{await profileManager.delete(id);setEditing(false);}catch{ /* Show server error. */ }
  };
  const openEditor=()=>{
    if(!active)return;
    setEditName(profileName(active));setEditEmoji(profileEmoji(active));
    setCreating(false);setEditing(true);
  };
  return <div className="v-profile">
    <Card className="v-profile-card">
      <CardHeader>
        <div className="v-profile-avatar mb-3 flex size-14 items-center justify-center rounded-full text-3xl" aria-hidden="true" style={{backgroundColor:getUserAvatarColor(user?.id||"")+"20"}}>{profileEmoji(active)}</div>
        <CardTitle>{active?profileName(active):t.profile}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1" disabled={profiles.busy||!active} onClick={openEditor}><Pencil size={16}/>{p.edit}</Button>
          <Button variant="outline" className="flex-1 text-red-700" disabled={profiles.busy||!hasMultiple||!active}
            title={!hasMultiple?p.lastProfile:p.deleteProfile}
            onClick={()=>active&&void remove(active.id)}><Trash2 size={16}/>{p.deleteProfile}</Button>
        </div>
        {editing&&active&&<form className="space-y-3 rounded-lg border border-stone-200 p-3" onSubmit={event=>void save(event)}>
          <div className="space-y-1"><Label htmlFor="profile-edit-name">{p.name}</Label><Input id="profile-edit-name" value={editName} onChange={event=>setEditName(event.target.value)} maxLength={120} required/></div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">{p.emoji}</legend>
            <Input aria-label={p.emoji} value={editEmoji} onChange={event=>setEditEmoji(event.target.value)} maxLength={64} placeholder="🐼" autoComplete="off"/>
            <div className="flex flex-wrap gap-2" aria-label={p.emoji+" – Vorschläge"}>
              {PROFILE_EMOJIS.map(emoji=><button key={emoji} type="button" className="flex size-10 items-center justify-center rounded-lg border text-2xl disabled:opacity-30"
                disabled={emojiTaken(emoji,active.id)}
                title={emojiTaken(emoji,active.id)?"Already assigned":emoji}
                aria-label={emoji} aria-pressed={editEmoji===emoji} onClick={()=>setEditEmoji(emoji)}>{emoji}</button>)}
            </div>
            {editEmojiError&&<p role="alert" className="text-sm text-red-700">Emoji already used by another profile</p>}
          </fieldset>
          <div className="flex gap-2"><Button type="submit" disabled={profiles.busy||!editName.trim()||!validProfileEmoji(editEmoji)||editEmojiError}>{p.save}</Button><Button type="button" variant="outline" onClick={()=>setEditing(false)}>{p.cancel}</Button></div>
        </form>}
        <div className="v-profile-email"><p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t.email}</p><p className="mt-1 break-all font-medium">{user?.email || ""}</p></div>
        <Button variant="outline" className="v-profile-action w-full" disabled={auth.busy || !user} onClick={()=>user&&void authManager.logout(user.id)}><LogOut size={16}/>{t.signOut}</Button>
      </CardContent>
    </Card>
    <Card className="v-profile-card">
      <CardHeader><CardTitle className="flex items-center gap-2"><Users size={18}/>{p.switchProfile}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {profiles.loading&&<p role="status">{p.loading}</p>}
        {profiles.error&&<p role="alert" className="text-sm text-red-700">{profiles.error}</p>}
        {profiles.profiles.filter(profile=>profile.id!==active?.id).map(profile=><div key={profile.id} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label={p.switchProfile+": "+profileName(profile)}
            onClick={()=>{profileManager.select(profile.id);setEditing(false);onClose();}}>
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center text-2xl">{profileEmoji(profile)}</span>
            <span className="block min-w-0 truncate text-sm font-semibold">{profileName(profile)}</span>
          </button>
        </div>)}
        {!creating?<Button variant="outline" className="v-profile-action w-full" disabled={profiles.busy} onClick={()=>{setEditing(false);setNewEmoji("");setCreating(true);}}><Plus size={16}/>{p.newProfile}</Button>:
        <form className="space-y-3" onSubmit={event=>void create(event)}>
          <div className="space-y-1"><Label htmlFor="profile-name">{p.name}</Label><Input id="profile-name" value={newName} onChange={event=>setNewName(event.target.value)} maxLength={120} required/></div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">{p.emoji}</legend>
            <Input aria-label={p.emoji} value={chosenNewEmoji} onChange={event=>setNewEmoji(event.target.value)} maxLength={64} placeholder="🐼" autoComplete="off" required/>
            <div className="flex flex-wrap gap-2" aria-label={p.emoji+" – Vorschläge"}>
              {PROFILE_EMOJIS.map(emoji=><button key={emoji} type="button" className="flex size-10 items-center justify-center rounded-lg border text-2xl disabled:opacity-30"
                disabled={emojiTaken(emoji)} title={emojiTaken(emoji)?"Already assigned":emoji}
                aria-label={emoji} aria-pressed={chosenNewEmoji===emoji} onClick={()=>setNewEmoji(emoji)}>{emoji}</button>)}
            </div>
            {newEmojiError&&<p role="alert" className="text-sm text-red-700">Emoji already used by another profile</p>}
          </fieldset>
          <div className="flex gap-2"><Button type="submit" disabled={profiles.busy||!newName.trim()||!validProfileEmoji(chosenNewEmoji)||newEmojiError}>{p.create}</Button><Button type="button" variant="outline" onClick={()=>setCreating(false)}>{p.cancel}</Button></div>
        </form>}
      </CardContent>
    </Card>
  </div>;
}

function VersionFooter({ language }: { language: Language }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return <footer aria-label={translations[language].change}
    className="pointer-events-none fixed bottom-0 left-0 z-10 max-w-full truncate px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-[10px] leading-tight text-stone-400/65 select-none">
    v{version} · {formatLastChange(changedAt, language, now)}
  </footer>;
}

export default function App() {
  const [language, setLanguage] = useState<Language>(detectLanguage);
  const [profileOpen, setProfileOpen] = useState(false);
  const t = translations[language];
  const state = useSyncExternalStore(authManager.subscribe, authManager.snapshot);
  const profileState = useSyncExternalStore(profileManager.subscribe, profileManager.snapshot);
  useEffect(() => {
    void authManager.initialize();
    const refresh = () => setLanguage(detectLanguage());
    window.addEventListener("languagechange", refresh);
    return () => window.removeEventListener("languagechange", refresh);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    // iOS/iPadOS Safari and Capacitor: suppress native pinch-to-zoom gestures.
    const appleTouchDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!appleTouchDevice) return;
    const preventPinchZoom = (event: Event) => event.preventDefault();
    document.addEventListener("gesturestart", preventPinchZoom, { passive: false });
    document.addEventListener("gesturechange", preventPinchZoom, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventPinchZoom);
      document.removeEventListener("gesturechange", preventPinchZoom);
    };
  }, []);
  const user = authManager.activeUser;
  useEffect(()=>{if(user?.id)void profileManager.refresh(user.id);else profileManager.reset();},[user?.id]);
  const showAuth = state.adding || !user || state.screen === "reset";
  const sharedLinkWaiting = Boolean(pendingSharedListId());
  const sharedLinkPrompt: Record<Language,string> = {
    de:"Melde dich an, um die geteilte Vokabelliste zu importieren.",
    en:"Sign in to import the shared vocabulary list.",
    fr:"Connectez-vous pour importer la liste de vocabulaire partagée.",
    nl:"Log in om de gedeelde woordenlijst te importeren.",
    da:"Log ind for at importere den delte ordliste.",
    it:"Accedi per importare la lista di vocaboli condivisa."
  };
  useEffect(() => { setProfileOpen(false); }, [user?.id]);
  return <>{!state.loading && !showAuth && !profileOpen && !profileState.loading && profileState.activeId ? <VokaApp key={user.id+":"+profileState.activeId} language={language} onProfile={() => setProfileOpen(true)}/> : <main className={profileOpen&&!showAuth?"v-profile-shell safe-top safe-bottom min-h-dvh w-full":"v-auth-shell safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 sm:px-6"}>
    {profileOpen && !showAuth && <header className="v-heading v-profile-heading"><button type="button" className="v-icon-button v-profile-back" aria-label={t.back} onClick={() => setProfileOpen(false)}><ArrowLeft size={22}/></button><h1>{({de:"Profil",en:"Profile",fr:"Profil",nl:"Profiel",da:"Profil",it:"Profilo"} as Record<Language,string>)[language]}</h1></header>}{(!profileOpen || showAuth)&&<Brand/>}
    {showAuth && sharedLinkWaiting && <div className="v-auth-import-hint" role="status">{sharedLinkPrompt[language]}</div>}
    {!isConfigured && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t.config}</div>}
    {state.error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{translateError(state.error, language)}</div>}
    {state.message && <div role="status" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{state.message === "Check your email to confirm your address, then sign in." ? t.emailConfirmation : state.message === "If an account exists for this email, a reset link has been sent." ? t.resetSent : state.message}</div>}
    {state.loading || (!showAuth && profileState.loading) ? <Card><CardContent className="p-8 text-center">{t.loading}</CardContent></Card> : showAuth ? <>
      <AuthForm language={language}/>
    </> : profileState.activeId ? <Profile language={language} onClose={()=>setProfileOpen(false)}/> : <Card><CardContent className="p-6"><p role="alert">{profileState.error || t.loading}</p><Button className="mt-4" onClick={()=>user&&void profileManager.refresh(user.id)}>{t.back}</Button></CardContent></Card>}
  </main>}<VersionFooter language={language}/></>;
}
