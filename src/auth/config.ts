import { Capacitor } from "@capacitor/core";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
export const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
export const isConfigured = Boolean(supabaseUrl && supabaseKey);
export const isNative = Capacitor.isNativePlatform();
export const nativeRedirect = import.meta.env.VITE_NATIVE_REDIRECT_URL || "com.example.voka://auth/callback";

// GitHub Pages cannot rewrite /auth/callback to index.html.
// Use the actual published index URL as the redirect target on subpath builds.
export const webCallbackPath = import.meta.env.BASE_URL === "/"
  ? "/auth/callback"
  : import.meta.env.BASE_URL;

export function callbackUrl(flow?: "recovery"): string {
  const base = isNative ? nativeRedirect : new URL(webCallbackPath, window.location.origin).toString();
  if (!flow) return base;
  const url = new URL(base);
  url.searchParams.set("flow", flow);
  return url.toString();
}
