import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, Check, CircleUserRound, LogOut, Plus, UserRound, Users } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { authManager } from "./auth/manager";
import { isConfigured } from "./auth/config";

function Brand() {
  return <div className="mb-8 flex items-center justify-center gap-3">
    <div className="flex size-11 items-center justify-center rounded-xl bg-[#19452d] text-xl font-extrabold text-white">V</div>
    <span className="text-2xl font-bold tracking-tight">Voka</span>
  </div>;
}

function AuthForm() {
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
    <Card>
      <CardHeader>
        {state.adding && <Button variant="ghost" className="mb-2 w-fit" onClick={() => authManager.cancelAdding()}><ArrowLeft size={16}/> Back to profile</Button>}
        <CardTitle>{screen === "login" ? "Sign in" : screen === "register" ? "Create an account" : screen === "forgot" ? "Reset your password" : "Choose a new password"}</CardTitle>
        <CardDescription>{screen === "login" ? "Sign in to see your personal profile." : screen === "register" ? "Get started with Voka." : screen === "forgot" ? "We will email you a password reset link." : "Enter your new password to continue."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          {screen === "register" && <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" autoComplete="name" required value={name} onChange={e => setName(e.target.value)}/></div>}
          {screen !== "reset" && <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></div>}
          {screen !== "forgot" && <div className="space-y-1.5"><Label htmlFor="password">{screen === "reset" ? "New password" : "Password"}</Label><Input id="password" type="password" autoComplete={screen === "login" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={e => setPassword(e.target.value)}/></div>}
          <Button className="w-full" disabled={state.busy || !isConfigured} type="submit">{state.busy ? "Please wait…" : screen === "login" ? "Sign in" : screen === "register" ? "Create account" : screen === "forgot" ? "Send reset link" : "Save new password"}</Button>
        </form>
        {(screen === "login" || screen === "register") && <>
          <div className="relative my-6 text-center text-xs text-stone-400 before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-stone-200"><span className="relative bg-white px-3">or continue with</span></div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={state.busy || !isConfigured} onClick={() => void authManager.oauth("apple")}>Apple</Button>
            <Button variant="outline" disabled={state.busy || !isConfigured} onClick={() => void authManager.oauth("google")}>Google</Button>
          </div>
        </>}
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          {screen === "login" && <><button type="button" className="font-medium text-green-800 underline" onClick={() => authManager.setScreen("register")}>Register</button><button type="button" className="font-medium text-green-800 underline" onClick={() => authManager.setScreen("forgot")}>Forgot password?</button></>}
          {(screen === "register" || screen === "forgot") && <button type="button" className="font-medium text-green-800 underline" onClick={() => authManager.setScreen("login")}>Back to sign in</button>}
        </div>
      </CardContent>
    </Card>
  );
}

function Profile() {
  const state = useSyncExternalStore(authManager.subscribe, authManager.snapshot);
  const activeId = state.registry.activeId;
  const user = authManager.activeUser;
  const account = state.registry.accounts.find(a => a.id === activeId);
  return <div className="space-y-5">
    <Card>
      <CardHeader>
        <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-green-50 text-green-900"><UserRound size={30}/></div>
        <CardTitle>My profile</CardTitle>
        <CardDescription>Your currently active Voka account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div><p className="text-xs font-medium uppercase tracking-wide text-stone-500">Name</p><p className="mt-1 font-medium">{account?.name || "User"}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wide text-stone-500">Email</p><p className="mt-1 break-all font-medium">{user?.email || account?.email || ""}</p></div>
        <div><p className="text-xs font-medium uppercase tracking-wide text-stone-500">User ID</p><p className="mt-1 break-all font-mono text-xs text-stone-600">{user?.id}</p></div>
        <Button variant="outline" className="w-full" disabled={state.busy || !activeId} onClick={() => activeId && void authManager.logout(activeId)}><LogOut size={16}/> Sign out</Button>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Users size={18}/> Accounts</CardTitle><CardDescription>Switch between signed-in users without entering a password.</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {state.registry.accounts.map(a => <div key={a.id} className="flex items-center gap-2 rounded-lg border border-stone-200 p-2">
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" type="button" aria-label={"Switch to " + a.email} onClick={() => void authManager.choose(a.id)}>
            <CircleUserRound size={26} className="shrink-0 text-green-800"/>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{a.name}</span><span className="block truncate text-xs text-stone-500">{a.email}</span></span>
            {a.id === activeId && <Check size={18} className="ml-auto shrink-0 text-green-800"/>}
          </button>
          {!state.users[a.id] && <button className="text-xs text-red-700 underline" onClick={() => void authManager.forget(a.id)} aria-label={"Remove " + a.email}>Remove</button>}
        </div>)}
        <Button variant="outline" className="mt-3 w-full" onClick={() => authManager.startAdding()}><Plus size={16}/> Add another user</Button>
      </CardContent>
    </Card>
  </div>;
}

export default function App() {
  const state = useSyncExternalStore(authManager.subscribe, authManager.snapshot);
  useEffect(() => { void authManager.initialize(); }, []);
  const user = authManager.activeUser;
  const showAuth = state.adding || !user || state.screen === "reset";
  return <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 sm:px-6">
    <Brand/>
    {!isConfigured && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Supabase configuration is missing. Copy .env.example to .env.local and set the publishable key.</div>}
    {state.error && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{state.error}</div>}
    {state.message && <div role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">{state.message}</div>}
    {state.loading ? <Card><CardContent className="p-8 text-center">Loading your accounts…</CardContent></Card> : showAuth ? <>
      {state.registry.accounts.length > 0 && !state.adding && !user && <Card className="mb-4"><CardHeader><CardTitle>Saved accounts</CardTitle></CardHeader><CardContent className="space-y-2">{state.registry.accounts.map(a => <div key={a.id} className="flex items-center justify-between gap-2"><button className="truncate text-sm underline" onClick={() => void authManager.choose(a.id)}>{a.email}</button><button className="text-xs text-red-700 underline" onClick={() => void authManager.forget(a.id)}>Remove</button></div>)}</CardContent></Card>}
      <AuthForm/>
    </> : <Profile/>}
    <footer className="mt-8 text-center text-xs text-stone-400">Voka</footer>
  </main>;
}
