export type Language = "de" | "en";
export const translations = {
  en: {
    back: "Back to profile", signIn: "Sign in", createTitle: "Create an account",
    forgotTitle: "Reset your password", resetTitle: "Choose a new password",
    loginDescription: "Sign in to see your personal profile.",
    registerDescription: "Get started with Voka.",
    forgotDescription: "We will email you a password reset link.",
    resetDescription: "Enter your new password to continue.",
    name: "Name", email: "Email", password: "Password", newPassword: "New password",
    waiting: "Please wait…", create: "Create account", sendReset: "Send reset link",
    savePassword: "Save new password", continueWith: "or continue with",
    register: "Register", forgot: "Forgot password?", backSignIn: "Back to sign in",
    profile: "My profile", active: "Your currently active Voka account", user: "User",
    userId: "User ID", signOut: "Sign out", accounts: "Accounts",
    switchDescription: "Switch between signed-in users without entering a password.",
    switchTo: "Switch to", remove: "Remove", add: "Add another user",
    config: "Supabase configuration is missing. Set the public project URL and publishable key.",
    loading: "Loading your accounts…", saved: "Saved accounts",
    emailConfirmation: "Check your email to confirm your address, then sign in.",
    resetSent: "If an account exists for this email, a reset link has been sent.",
    expired: "This account needs to sign in again. Remove it and add it again.",
    unexpected: "An unexpected error occurred.", invalid: "Invalid login credentials.",
    notConfirmed: "Please confirm your email address first.",
    alreadyRegistered: "This email address is already registered.",
    shortPassword: "Password is too short.", rateLimit: "Too many attempts. Try again later.",
    today: "today", change: "Last code change", minutesAgo: "min ago"
  },
  de: {
    back: "Zurück zum Profil", signIn: "Anmelden", createTitle: "Konto erstellen",
    forgotTitle: "Passwort zurücksetzen", resetTitle: "Neues Passwort festlegen",
    loginDescription: "Melde dich an, um dein persönliches Profil zu sehen.",
    registerDescription: "Erstelle dein Voka-Konto.",
    forgotDescription: "Wir senden dir einen Link zum Zurücksetzen deines Passworts.",
    resetDescription: "Gib dein neues Passwort ein.",
    name: "Name", email: "E-Mail", password: "Passwort", newPassword: "Neues Passwort",
    waiting: "Bitte warten…", create: "Konto erstellen", sendReset: "Link senden",
    savePassword: "Passwort speichern", continueWith: "oder fortfahren mit",
    register: "Registrieren", forgot: "Passwort vergessen?", backSignIn: "Zurück zur Anmeldung",
    profile: "Mein Profil", active: "Dein aktuell aktives Voka-Konto", user: "Benutzer",
    userId: "Benutzer-ID", signOut: "Abmelden", accounts: "Konten",
    switchDescription: "Wechsle zwischen angemeldeten Benutzern ohne erneute Passworteingabe.",
    switchTo: "Wechseln zu", remove: "Entfernen", add: "Weiteren Benutzer hinzufügen",
    config: "Die Supabase-Konfiguration fehlt. Hinterlege Projekt-URL und öffentlichen Publishable Key.",
    loading: "Konten werden geladen…", saved: "Gespeicherte Konten",
    emailConfirmation: "Bestätige deine E-Mail-Adresse über den zugesandten Link und melde dich an.",
    resetSent: "Falls für diese E-Mail-Adresse ein Konto existiert, wurde ein Link zum Zurücksetzen gesendet.",
    expired: "Für dieses Konto ist eine erneute Anmeldung erforderlich. Entferne es und füge es erneut hinzu.",
    unexpected: "Ein unerwarteter Fehler ist aufgetreten.",
    invalid: "E-Mail-Adresse oder Passwort ist falsch.",
    notConfirmed: "Bitte bestätige zuerst deine E-Mail-Adresse.",
    alreadyRegistered: "Diese E-Mail-Adresse ist bereits registriert.",
    shortPassword: "Das Passwort ist zu kurz.", rateLimit: "Zu viele Versuche. Versuche es später erneut.",
    today: "heute", change: "Letzte Code-Änderung", minutesAgo: "min"
  }
} as const;

export function preferredLanguage(languages: readonly string[]): Language {
  return (languages[0] || "en").toLowerCase().split("-")[0] === "de" ? "de" : "en";
}
export function detectLanguage(): Language {
  // Capacitor WKWebView and Android WebView expose the device's OS preferences.
  return preferredLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);
}
export function translateError(message: string, language: Language): string {
  const text = message.toLowerCase();
  const t = translations[language];
  if (/invalid login credentials|invalid_grant|invalid credentials/.test(text)) return t.invalid;
  if (/email not confirmed/.test(text)) return t.notConfirmed;
  if (/already registered|user already exists/.test(text)) return t.alreadyRegistered;
  if (/password.*(short|characters|length)/.test(text)) return t.shortPassword;
  if (/rate limit|too many requests|email rate limit/.test(text)) return t.rateLimit;
  return language === "en" ? message : t.unexpected;
}
