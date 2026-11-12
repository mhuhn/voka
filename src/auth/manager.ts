import { createClient, type Session, type SupabaseClient, type User, type Provider } from "@supabase/supabase-js";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isConfigured, isNative, supabaseKey, supabaseUrl, callbackUrl } from "./config";
import { REGISTRY_KEY, addAccount, readRegistry, removeAccount, selectAccount, type AccountRecord, type AccountRegistry } from "./registry";

export type AuthScreen = "login" | "register" | "forgot" | "reset";
export interface AuthSnapshot {
  registry: AccountRegistry;
  users: Record<string, User>;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  screen: AuthScreen;
  adding: boolean;
}

function labelFor(user: User) {
  const meta = user.user_metadata;
  return String(meta?.full_name || meta?.name || [meta?.first_name, meta?.last_name].filter(Boolean).join(" ") || user.email || "User");
}

export class AuthManager {
  private clients = new Map<string, SupabaseClient>();
  private pending: SupabaseClient | null = null;
  private listeners = new Set<() => void>();
  private state: AuthSnapshot = {
    registry: { accounts: [], activeId: null }, users: {}, loading: true, busy: false,
    error: null, message: null, screen: "login", adding: false
  };
  private callbackInProgress: Promise<void> | null = null;
  private initializePromise: Promise<void> | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  snapshot = () => this.state;
  private patch = (changes: Partial<AuthSnapshot>) => {
    this.state = { ...this.state, ...changes };
    this.listeners.forEach(fn => fn());
  };
  private persist = (registry: AccountRegistry) => {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    this.patch({ registry });
  };
  private makeClient = (key: string) => {
    if (!isConfigured) throw new Error("Supabase is not configured. See .env.example.");
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        storageKey: key,
        persistSession: true,
        autoRefreshToken: key !== "voka:pending",
        detectSessionInUrl: false,
        flowType: "pkce"
      }
    });
  };
  private accountClient = (id: string) => {
    let client = this.clients.get(id);
    if (!client) {
      client = this.makeClient("voka:session:" + id);
      client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          const users = { ...this.state.users };
          delete users[id];
          this.patch({ users });
        }
      });
      this.clients.set(id, client);
    }
    return client;
  };
  private pendingClient = () => this.pending ??= this.makeClient("voka:pending");
  get activeUser(): User | null {
    return this.state.users[this.state.registry.activeId || ""] || null;
  }

  initialize(): Promise<void> {
    return this.initializePromise ??= this.initializeInternal();
  }

  private async initializeInternal(): Promise<void> {
    try {
      const registry = readRegistry();
      this.patch({ registry });
      if (!isConfigured) return;
      const users: Record<string, User> = {};
      await Promise.all(registry.accounts.map(async account => {
        try {
          const { data: { user }, error } = await this.accountClient(account.id).auth.getUser();
          if (!error && user && user.id === account.id) users[account.id] = user;
        } catch { /* Keep account listed for explicit reauthentication or removal. */ }
      }));
      this.patch({ users });
      if (isNative) {
        await App.addListener("appUrlOpen", ({ url }) => {
          void this.processCallback(url).catch(error => this.patch({ error: toMessage(error) }));
        });
        const launch = await App.getLaunchUrl();
        if (launch?.url) await this.processCallback(launch.url);
      } else if (window.location.pathname === "/auth/callback") {
        await this.processCallback(window.location.href);
      }
    } catch (error) {
      this.patch({ error: toMessage(error) });
    } finally {
      this.patch({ loading: false });
    }
  }

  private async adopt(session: Session) {
    const user = session.user;
    const client = this.accountClient(user.id);
    const { data, error } = await client.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    if (error || !data.user) throw error || new Error("Session could not be saved.");
    const finalUser = data.user;
    const record: AccountRecord = { id: finalUser.id, email: finalUser.email || "", name: labelFor(finalUser) };
    this.persist(addAccount(this.state.registry, record));
    this.patch({
      users: { ...this.state.users, [finalUser.id]: finalUser },
      adding: false, screen: "login", error: null, message: null
    });
    // Never sign out the pending client: even a local sign-out revokes the copied
    // refresh token server-side. Drop only the temporary browser storage.
    localStorage.removeItem("voka:pending");
    this.pending = null;
  }

  private async acceptPendingSession() {
    const { data: { session }, error } = await this.pendingClient().auth.getSession();
    if (error) throw error;
    if (!session) throw new Error("No session returned.");
    await this.adopt(session);
  }

  setScreen(screen: AuthScreen) { this.patch({ screen, error: null, message: null }); }
  startAdding() { this.patch({ adding: true, screen: "login", error: null, message: null }); }
  cancelAdding() { this.patch({ adding: false, screen: "login", error: null, message: null }); }

  private async perform(task: () => Promise<void>) {
    if (this.state.busy) return;
    this.patch({ busy: true, error: null, message: null });
    try { await task(); }
    catch (error) { this.patch({ error: toMessage(error) }); }
    finally { this.patch({ busy: false }); }
  }

  login(email: string, password: string) {
    return this.perform(async () => {
      const { error } = await this.pendingClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      await this.acceptPendingSession();
    });
  }

  register(email: string, password: string, name: string) {
    return this.perform(async () => {
      const { data, error } = await this.pendingClient().auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: callbackUrl() }
      });
      if (error) throw error;
      if (data.session) await this.adopt(data.session);
      else this.patch({ message: "Check your email to confirm your address, then sign in." });
    });
  }

  forgot(email: string) {
    return this.perform(async () => {
      const { error } = await this.pendingClient().auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl("recovery")
      });
      if (error) throw error;
      this.patch({ message: "If an account exists for this email, a reset link has been sent." });
    });
  }

  resetPassword(password: string) {
    return this.perform(async () => {
      const { error } = await this.pendingClient().auth.updateUser({ password });
      if (error) throw error;
      await this.acceptPendingSession();
    });
  }

  oauth(provider: Provider) {
    return this.perform(async () => {
      const { data, error } = await this.pendingClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl(), skipBrowserRedirect: isNative }
      });
      if (error) throw error;
      if (isNative) {
        if (!data.url) throw new Error("OAuth provider did not return a URL.");
        await Browser.open({ url: data.url });
      }
    });
  }

  async processCallback(url: string) {
    if (this.callbackInProgress) return this.callbackInProgress;
    const promise = this.processCallbackInternal(url);
    this.callbackInProgress = promise;
    try { await promise; } finally { this.callbackInProgress = null; }
  }

  private async processCallbackInternal(value: string) {
    const url = new URL(value);
    if (!(url.pathname.endsWith("/auth/callback") || (url.host === "auth" && url.pathname === "/callback"))) return;
    const query = new URLSearchParams(url.search);
    const hash = new URLSearchParams(url.hash.slice(1));
    const errorText = query.get("error_description") || hash.get("error_description");
    if (errorText) {
      this.patch({ error: errorText });
    } else if (query.get("code")) {
      const { error } = await this.pendingClient().auth.exchangeCodeForSession(query.get("code")!);
      if (error) throw error;
      if (query.get("flow") === "recovery" || hash.get("type") === "recovery") {
        this.patch({ screen: "reset", adding: true });
      } else {
        await this.acceptPendingSession();
      }
    } else if (hash.get("access_token") && hash.get("refresh_token")) {
      // Compatibility with implicit redirects if the provider returns tokens instead of PKCE.
      const { data, error } = await this.pendingClient().auth.setSession({
        access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")!
      });
      if (error) throw error;
      if (hash.get("type") === "recovery") this.patch({ screen: "reset", adding: true });
      else if (data.session) await this.adopt(data.session);
    }
    if (isNative) {
      await Browser.close().catch(() => undefined);
    } else {
      window.history.replaceState({}, "", "/");
    }
  }

  async choose(id: string) {
    this.persist(selectAccount(this.state.registry, id));
    this.patch({ adding: false, screen: "login", error: null, message: null });
    try {
      const { data: { user }, error } = await this.accountClient(id).auth.getUser();
      if (error || !user) throw error || new Error("Session expired");
      this.patch({ users: { ...this.state.users, [id]: user } });
    } catch {
      const users = { ...this.state.users };
      delete users[id];
      this.patch({ users, error: "This account needs to sign in again. Remove it and add it again." });
    }
  }

  async logout(id: string) {
    await this.perform(async () => {
      // Scope 'local' removes only this device's session. Other accounts stay signed in.
      const client = this.accountClient(id);
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      const users = { ...this.state.users };
      delete users[id];
      this.clients.delete(id);
      this.persist(removeAccount(this.state.registry, id));
      this.patch({ users, adding: false, screen: "login" });
    });
  }

  async forget(id: string) {
    await this.perform(async () => {
      try { await this.accountClient(id).auth.signOut({ scope: "local" }); } catch { /* Expired local session */ }
      this.clients.delete(id);
      const users = { ...this.state.users };
      delete users[id];
      this.persist(removeAccount(this.state.registry, id));
      this.patch({ users });
    });
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export const authManager = new AuthManager();
