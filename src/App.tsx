import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, Check, CircleUserRound, LogOut, Plus, UserRound, Users } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { authManager } from "./auth/manager";
import { isConfigured } from "./auth/config";
import { detectLanguage, translations, translateError, type Language } from "./lib/i18n";
import { changedAt, version, formatLastChange } from "./lib/buildInfo";
import VokaApp from "./voka/VokaApp";
import { getUserAvatarColor } from "./auth/userColors";

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

function Profile({ language }: { language: Language }) {
  const t = translations[language];
  const state = useSyncExternalStore(authManager.subscribe, authManager.snapshot);
  const activeId = state.registry.activeId;
  const user = authManager.activeUser;
  const account = state.registry.accounts.find(a => a.id === activeId);
  const activeAvatarColor = getUserAvatarColor(activeId || "");
  return <div className="v-profile space-y-5">
    <Card className="v-profile-card">
      <CardHeader>
        <div className="v-profile-avatar mb-3 flex size-14 items-center justify-center rounded-full" style={{color:activeAvatarColor,backgroundColor:activeAvatarColor+"20",border:"1px solid "+activeAvatarColor+"55"}}><UserRound size={32}/></div>
        <CardTitle>{t.profile}</CardTitle>
        <CardDescription>{t.active}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div><p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t.name}</p><p className="mt-1 font-medium">{account?.name || t.user}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t.email}</p><p className="mt-1 break-all font-medium">{user?.email || account?.email || ""}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t.userId}</p><p className="mt-1 break-all font-mono text-xs text-stone-600">{user?.id}</p></div>
        <Button variant="outline" className="v-profile-action w-full" disabled={state.busy || !activeId} onClick={() => activeId && void authManager.logout(activeId)}><LogOut size={16}/> {t.signOut}</Button>
      </CardContent>
    </Card>
    <Card className="v-profile-card">
      <CardHeader><CardTitle className="flex items-center gap-2"><Users size={18}/> {t.accounts}</CardTitle><CardDescription>{t.switchDescription}</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {state.registry.accounts.map(a => <div key={a.id} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2">
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" type="button" aria-label={t.switchTo + " " + a.email} onClick={() => void authManager.choose(a.id)}>
            <CircleUserRound size={26} className="shrink-0" style={{color:getUserAvatarColor(a.id)}}/>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{a.name}</span><span className="block truncate text-xs text-stone-500">{a.email}</span></span>
            {a.id === activeId && <Check size={18} className="ml-auto shrink-0" style={{color:getUserAvatarColor(a.id)}}/>}
          </button>
          {!state.users[a.id] && <button className="text-xs text-red-700 underline" onClick={() => void authManager.forget(a.id)} aria-label={t.remove + " " + a.email}>{t.remove}</button>}
        </div>)}
        <Button variant="outline" className="v-profile-action mt-3 w-full" onClick={() => authManager.startAdding()}><Plus size={16}/> {t.add}</Button>
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
  useEffect(() => {
    void authManager.initialize();
    const refresh = () => setLanguage(detectLanguage());
    window.addEventListener("languagechange", refresh);
    return () => window.removeEventListener("languagechange", refresh);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const user = authManager.activeUser;
  const showAuth = state.adding || !user || state.screen === "reset";
  useEffect(() => { setProfileOpen(false); }, [user?.id]);
  return <>{!state.loading && !showAuth && !profileOpen ? <VokaApp key={user.id} language={language} onProfile={() => setProfileOpen(true)}/> : <main className="v-auth-shell safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 sm:px-6">
    {profileOpen && !showAuth && <Button variant="ghost" className="v-profile-back mb-3 w-fit" onClick={() => setProfileOpen(false)}><ArrowLeft size={16}/> Voka</Button>}
    <Brand/>
    {!isConfigured && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t.config}</div>}
    {state.error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{translateError(state.error, language)}</div>}
    {state.message && <div role="status" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{state.message === "Check your email to confirm your address, then sign in." ? t.emailConfirmation : state.message === "If an account exists for this email, a reset link has been sent." ? t.resetSent : state.message}</div>}
    {state.loading ? <Card><CardContent className="p-8 text-center">{t.loading}</CardContent></Card> : showAuth ? <>
      {state.registry.accounts.length > 0 && !state.adding && !user && <Card className="mb-4"><CardHeader><CardTitle>{t.saved}</CardTitle></CardHeader><CardContent className="space-y-2">{state.registry.accounts.map(a => <div key={a.id} className="flex items-center justify-between gap-2"><button className="truncate text-sm underline" onClick={() => void authManager.choose(a.id)}>{a.email}</button><button className="text-xs text-red-700 underline" onClick={() => void authManager.forget(a.id)}>{t.remove}</button></div>)}</CardContent></Card>}
      <AuthForm language={language}/>
    </> : <Profile language={language}/>}
  </main>}<VersionFooter language={language}/></>;
}
