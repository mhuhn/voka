# Voka – vollständiger Tech-Stack und Dienste

**Stand:** 13. November 2026 · **Quelle der technischen Fakten:** `main`, `package.json`, Konfiguration, Anwendungscode, SQL-Migrationen und GitHub-Actions-Workflows. Diese Datei wird zusammen mit der App versioniert.

## 1. Systemüberblick

Voka ist eine Lernkarten-App mit **einer React-/TypeScript-Codebasis** für Web, installierbare PWA und native iOS-/Android-Apps über Capacitor.

```text
Browser / PWA / iPhone / iPad / Android
  └── React 19 + TypeScript + Tailwind CSS
        ├── Supabase Auth → E-Mail/Passwort, Apple-ID, optional Google OAuth
        ├── Supabase REST/RPC → PostgreSQL (RLS, Profile, Fächer, Listen, Karten, Lernstatus)
        └── Lokale UI-/Sessiondaten → Web Storage
GitHub (main + Pull Requests)
  ├── GitHub Actions → Build, Unit-/E2E-Tests, GitHub Pages
  ├── GitHub Actions (macOS) → Capacitor/Xcode → App Store Connect/TestFlight
  └── Renovate → Dependency-PRs
```

**Grundprinzip:** Supabase stellt Backend, Datenbank und Authentifizierung bereit. Der Web-Client wird statisch auf GitHub Pages veröffentlicht; ein eigener dauerhaft laufender Node.js-/Express-Server ist für Voka nicht erforderlich. App-Berechtigungen müssen serverseitig durch Datenbankregeln und RPCs durchgesetzt werden.

## 2. App-Technologien (Bibliotheken, Frameworks, Laufzeit)

| Technologie | Was ist das? | Einsatz in Voka | Warum gewählt / relevante Alternativen |
| --- | --- | --- | --- |
| **TypeScript 5.9** | Typisierte Erweiterung von JavaScript | Frontend, Komponenten, APIs, Build-Skripte | Gemeinsame Typen und frühere Fehlererkennung; weniger Fehlerpotenzial als reines JavaScript. |
| **React 19 / React DOM** | Deklaratives UI-Framework | Alle Screens, Formulare, Navigation und Lernansichten | Eine Codebasis über Web und native WebViews; gegenüber getrennten nativen Swift-/Kotlin-UIs geringerer Pflegeaufwand. |
| **Vite 7 + React-Plugin** | Entwicklungsserver und Build-Werkzeug | Lokale Entwicklung, optimierte statische Builds | Einfacher Build statischer Single-Page-Apps; weniger Server-/Framework-Komplexität als Next.js mit SSR, das Voka nicht benötigt. |
| **Node.js 22 + npm** | JavaScript-Werkzeuglaufzeit/Paketmanager | Installation, Build, Tests und GitHub Actions | Weit verbreitetes React-Ökosystem; gegenüber einer separaten Toolchain geringe Zusatzkomplexität. Node ist **nicht** der Produktions-Webserver. |
| **Tailwind CSS 4** | Utility-CSS-Framework | Layout, Styling, responsive Oberfläche | Schnelles, konsistentes Styling statt vollständig selbst geschriebener CSS-Infrastruktur; projektbezogene Styles bleiben in `src/styles.css` und `src/voka/voka.css`. |
| **shadcn-artige UI-Bausteine, Radix Label/Slot** | Kopierbare UI-Komponenten und zugängliche UI-Primitives | Buttons, Cards, Inputs, Labels in `src/components/ui` | Kontrollierbarer Quellcode und Barrierefreiheitsbausteine statt einer starren kompletten UI-Suite (z. B. MUI). |
| **Lucide React** | Open-Source-SVG-Icon-Bibliothek | Navigation, Aktionen, Lernbuttons | Einheitliche skalierbare Icons statt verschiedener Icon-Pakete oder eingebundener Rastergrafiken. |
| **class-variance-authority, clsx, tailwind-merge** | Helfer für CSS-Varianten und Klassen | UI-Komponenten mit Varianten | Weniger manuelle Konflikte beim Zusammenbauen von Tailwind-Klassen. |
| **Capacitor 8** | Verpackt Web-Code in native iOS-/Android-Projekte | Native App, Systembrowser, App-URL-Events, Deep Links | Maximale Wiederverwendung der PWA; gegenüber React Native/Expo oder Flutter weniger Neuentwicklung der UI. Nachteil: Rendering in WebViews statt nativer Controls. |
| **@capacitor/app, @capacitor/browser** | Native Capacitor-Plugins | OAuth-Rückleitung, App-Start und systemweiter Browser | Native Plattform-Integrationen bei weiterhin gemeinsamem Web-Code. |
| **vite-plugin-pwa + Workbox** | PWA-/Service-Worker-Werkzeuge | Manifest, App-Icons, Cache, installierbare Web-App, aktualisierte Assets | PWA mit wenig Handarbeit; gegenüber einem individuell geschriebenen Service Worker geringer Aufwand. Keine Garantie auf vollständige Offline-Funktionalität des Supabase-Backends. |
| **Browser Web Storage** | Lokale Browser-/WebView-Speicherung | Account-Auswahl, separate Supabase-Auth-Sessions, begrenzter temporärer Zustand | Einfacher Mehrkonto-Wechsel ohne zusätzliche lokale Datenbank; gegenüber Keychain/Keystore weniger stark gegen Zugriff auf entsperrte Geräte abgesichert. |
| **Web Audio / browserseitige Audioausgabe** | Web-Plattform-Funktion | Lern-Feedback-Töne (`feedbackAudio.ts`) | Keine separate Audio-SaaS notwendig. |
| **Eigene Internationalisierung** | Sprachtexte in TypeScript statt externer Plattform | Deutsch, Englisch, Französisch, Niederländisch, Dänisch, Italienisch | Für den kleinen App-Umfang schlanker als ein externes Übersetzungs-CMS oder eine große i18n-Plattform. |

**Wichtige Dateien:** `package.json`, `vite.config.ts`, `capacitor.config.ts`, `src/App.tsx`, `src/voka/`, `src/components/ui/`.

## 3. Backend, Datenhaltung und Sicherheit

| Dienst / Technik | Was ist das? | Verwendung | Auswahl / Alternativen |
| --- | --- | --- | --- |
| **Supabase (SaaS)** | Gehostete Backend-Plattform | Gemeinsames Backend für Voka und weitere Apps; Benutzerkonten, PostgreSQL, APIs | Gegenüber WorkOS **plus** separater Datenbank weniger Anbieter und Integrationsaufwand; gegenüber selbst gehostetem PostgreSQL/Auth weniger Betrieb. Gegenüber Firebase liegt relationales SQL/PostgreSQL näher am Voka-Datenmodell. |
| **Supabase PostgreSQL** | Relationale SQL-Datenbank | Voka-spezifische Tabellen (`voka_*`), Profile, Fächer, Listen, Karten, Lernstände, Streaks; SQL-Migrationen | Relationen, Constraints, Transaktionen und SQL-Auswertungen statt dokumentorientierter Speicherung in MongoDB/Firestore oder Google Drive. |
| **Supabase Auth** | Gehosteter Identity- und Session-Dienst | Registrierung, Anmeldung, E-Mail-Bestätigung, Passwort-Reset und OAuth | Bereits im Backend enthalten; ersetzt für diese Funktionen eine zusätzliche WorkOS-/Clerk-/Auth0-Schicht. |
| **supabase-js 2** | Client-SDK | Auth-Anfragen, Datensätze, gespeicherte Prozeduren/RPCs | Direkter Zugriff auf Supabase APIs ohne eigene REST-Clientbibliothek. |
| **PostgREST / Supabase Data API** | HTTP-API für Datenbankressourcen | Lesen/Schreiben der app-spezifischen Daten | Automatische API statt eines selbst betriebenen Express-/NestJS-Backends. |
| **PostgreSQL-Funktionen / RPCs** | Serverseitige SQL-Funktionen | Fachliche Transaktionen: Lernläufe, Bewertung, Import, Teilen, Profile | Wichtige Regeln bleiben serverseitig und sind nicht nur im manipulierbaren Client implementiert. |
| **Row Level Security (RLS)** | Datenbankseitige Zugriffsprüfung | Isoliert Daten zwischen Nutzern/Profilen/Apps entsprechend den Policies | Notwendig, da der Client einen öffentlichen Supabase-Schlüssel benutzt; sicherer als ausschließlich clientseitige Filter. |
| **Supabase Storage** | Objektspeicher von Supabase | **Für die Lernkarten-Daten nicht belegt** – diese liegen in PostgreSQL | Bei späteren größeren Dateien denkbar; nicht mit der Datenbank verwechseln. |

**Datenmodell:** Benutzeridentität und App-Rollen sind vom fachlichen Profil getrennt; Voka-Daten liegen profilbezogen. Profilerweiterungen, Listen/Karten, Lernhistorie und Streaks werden in den SQL-Migrationen unter `supabase/migrations/` gepflegt. Weitere Details: [VOKA_DATA_MODEL.md](VOKA_DATA_MODEL.md). Eine öffentliche/publishable Supabase-Key ist **kein Geheimnis**; Service-Role-Keys und private Credentials dürfen nicht in Client-Code gelangen.

## 4. Externe SaaS, Identitätsprovider, E-Mail und Domains

Die folgenden Einträge unterscheiden bewusst zwischen **aus Code/Workflows belegtem Einsatz**, **in Voka vorgesehenen Optionen** und **externen Kontokonfigurationen, die nicht im Git-Repository sichtbar sind**.

| Dienst | Was ist das? | Verwendung / nachweisbarer Status | Warum dieser Dienst / verglichene Alternativen |
| --- | --- | --- | --- |
| **GitHub** | Git-Hosting und Zusammenarbeit | **Aktiv**: Repository `mhuhn/voka`, langlebiger Branch `main`, PRs, Schutzregeln | Quellcode und Releases zentral; statt eines zusätzlichen GitLab-/Bitbucket-Repositories. |
| **GitHub Actions** | Verwaltete CI/CD-Ausführung | **Aktiv**: Build, Vitest, Playwright/Cucumber, Web-Deploy, iOS-Build und TestFlight-Upload | CI direkt beim Repository, GitHub-Secrets und gehostete macOS-Runner; statt separatem Jenkins, CircleCI oder Codemagic. |
| **GitHub Pages** | Statisches Webhosting | **Aktiv**: öffentliche PWA unter `https://mhuhn.github.io/voka/`, Deployment aus `main` | Kostengünstig für statische Assets, ohne eigenen Server; statt Vercel, Netlify, Cloudflare Pages oder eigenen Webservers. Supabase übernimmt dynamische APIs. |
| **Apple Developer Program** | Apple-Entwicklerkonto, Zertifikate, App IDs | **Aktiv im iOS-Publishing-Workflow**: Identität, Signierung und Provisioning der nativen App | Für die iOS-Verteilung notwendig, keine gleichwertige Apple-Plattform-Alternative. |
| **App Store Connect** | Apples Verwaltung für iOS-Apps und Uploads | **Aktiv**: automatisierter signierter IPA-Upload über App Store Connect API | Offizieller Weg zum Verteilen und Verwalten von iOS-Versionen. |
| **TestFlight** | Apples Beta-Test-Verteilung | **Aktiv**: die native iOS-App wurde über TestFlight veröffentlicht | Offizielle Installation/Testverteilung vor App-Store-Freigabe; gegenüber Ad-hoc-IPA-Verteilung einfacheres Tester-Management. |
| **Sign in with Apple / Apple-ID** | Externer OAuth-/Identity-Provider | **Im Code unterstützt**, Konfiguration über Supabase Auth und Apple Developer; tatsächliche Aktivierung im Supabase Dashboard hier nicht verifiziert | Bequemer Login ohne weiteres Voka-Passwort; Ergänzung zu E-Mail/Passwort. |
| **Google Sign-In / Google Cloud OAuth** | Google-Identity-Provider und OAuth-Client | **Im Code unterstützt, standardmäßig deaktiviert** (`VITE_GOOGLE_LOGIN_ENABLED=false`); Aktivierung nicht belegt | Optionales Single Sign-on; als Alternative zu manuellen Passwörtern, aber zusätzliche Google-OAuth-Konfiguration notwendig. |
| **Supabase Auth E-Mail-Versand** | Registrierung, Bestätigung, Passwort-Wiederherstellung | **Im Code aktiv**; die Auswahl des SMTP-/Transaktionsmail-Dienstes erfolgt außerhalb des Repositorys im Supabase-Dashboard | Zentraler Auth-E-Mail-Prozess statt selbst entwickeltem Mailserver. |
| **Resend** | Transaktions-E-Mail-API und SMTP-Anbieter | **Externe SMTP-Option / Einrichtung nicht im Repository nachweisbar**: für Supabase-Bestätigungs- und Recovery-Mails vorgesehen. Ob Resend produktiv angebunden und die Domain verifiziert ist, muss im Resend- und Supabase-Dashboard geprüft werden | Gegenüber persönlichem Gmail-SMTP für App-Transaktionsmails geeignet (Domain-Verifizierung, Zustellbarkeit, Mail-Logs, API/SMTP). Alternativen: Postmark, SendGrid, Amazon SES. |
| **Squarespace Domains** | Domainregistrar und DNS-Verwaltung | **Extern nach Nutzerangaben**: eine Domain wird bei Squarespace verwaltet. Die veröffentlichte Voka-Webadresse ist derzeit **GitHub Pages**, nicht nachweislich eine Squarespace-Custom-Domain | Bestehende Domainverwaltung weiterverwenden statt Registrar-Umzug; Alternativen: Cloudflare Registrar, IONOS, Porkbun. Domain-/DNS-Hosting ist nicht gleich Webhosting. |
| **Google Gmail** | Gehostetes E-Mail-Postfach | **Extern nach Nutzerangaben**: bestehender persönlicher Maildienst. Nicht als Vokas produktiver SMTP-Versender nachgewiesen | Weiterhin als Postfach nutzbar, Transaktionsmails vorzugsweise über spezialisierten SMTP-Anbieter. Alternativen: Google Workspace, Microsoft 365, iCloud Mail. |
| **Google Play Console** | Android-App-Verteilung | **Noch keine produktive Veröffentlichung im Repository belegt**; Capacitor-Android-Projekt kann erstellt werden | Bei späterer Play-Store-Veröffentlichung der offizielle Vertriebsweg; Alternative wäre nur Sideloading oder ein anderer Android-App-Store. |

**Wichtig zur Mailkette:** Typischer Pfad bei Einrichtung: Voka → Supabase Auth → im Supabase-Dashboard hinterlegter SMTP-Anbieter (z. B. Resend) → Postfach. DNS-SPF/DKIM-/Domain-Verifizierung liegt bei Domain-/DNS-Verwaltung. **Der aktuelle SMTP-Anbieter lässt sich nicht sicher aus dem Repository ablesen.** Die Wahl von Resend ist deshalb hier als vorgesehene Lösung, nicht als bestätigter produktiver Zustand dokumentiert.

## 5. Qualität, Deployment und Versionsverwaltung

| Werkzeug / Dienst | Funktion | Verwendung und Auswahl gegenüber Alternativen |
| --- | --- | --- |
| **Vitest 3 + jsdom** | Schnelle Unit-/Komponententests | Testet Fachlogik und Client-Helfer ohne Browser; näher am Vite-Stack als z. B. Jest mit zusätzlicher Konfiguration. |
| **Cucumber / Gherkin** | Lesbare Akzeptanzszenarien | `tests/features/`: Verhalten in fachlichen Given/When/Then-Schritten; für nachvollziehbare Anforderungen statt ausschließlich technisch formulierter Tests. |
| **Playwright** | Automatisierter Browser | E2E-Tests auf echten Browser-Engines, mit isolierten, gemockten Supabase-Antworten; gegenüber Selenium moderne Browserautomation mit guten Assertions. |
| **TypeScript-Check (`tsc --noEmit`)** | Statischer Typcheck | Teil von `npm run build`, ohne JavaScript-Ausgabe beim Check. |
| **GitHub branch protection / PRs** | Schutz der Hauptentwicklung | `main` als alleiniger langfristiger Branch, vorgeschriebener `verify`-Check; schützt vor fehlerhaften direkten Änderungen. |
| **Renovate** | Automatisierte Dependency-Update-PRs | Über `renovate.json` für `main`: gruppierte bzw. kontrollierte npm-Updates. Statt Dependabot gewählt, weil detaillierte Zeitpläne und Paketregeln konfiguriert sind; sensible Pakete bleiben manuell zu prüfen. |
| **GitHub-hosted macOS + Xcode** | Apple-Buildumgebung | Capacitor iOS wird im Workflow erzeugt und signiert, ohne lokalen Mac als Voraussetzung; Gegensatz zu selbst betriebenen macOS-Buildservern. |

**Releases sind getrennt:**

- **Web/PWA:** Merge/Push nach `main` → `.github/workflows/pages.yml` → Build für `/voka/` → GitHub Pages. VitePWA erzeugt Service Worker und Manifest.
- **iOS-Simulatorvalidierung:** Pull Requests mit nativen Änderungen → `.github/workflows/ios.yml` → unsigned Simulator-Build.
- **iOS-TestFlight-Veröffentlichung:** manuell gestarteter Workflow oder gepushter Tag `testflight-vX.Y.Z` → `.github/workflows/testflight.yml` → Signierung und App Store Connect. **Ein normales Web-Deployment aktualisiert TestFlight nicht.**
- **Android:** technisch über Capacitor vorgesehen, aber kein entsprechender produktiver Release-Workflow im aktuellen Repository dokumentiert.

Siehe auch [IOS_TESTFLIGHT.md](IOS_TESTFLIGHT.md), [NATIVE.md](NATIVE.md), [DEPENDENCY_UPDATES.md](DEPENDENCY_UPDATES.md) und [AUTH_SETUP.md](AUTH_SETUP.md).

## 6. Bewusst nicht verwendete oder nicht nachgewiesene Komponenten

- **WorkOS, Clerk, Auth0:** nicht Teil der aktuellen Auth-Implementierung; Supabase Auth übernimmt diese Aufgaben.
- **Google Drive, iCloud Drive oder MongoDB als primärer Datenspeicher:** nicht Bestandteil des aktuellen Voka-Datenpfads; stattdessen Supabase PostgreSQL.
- **Eigenes Backend auf VPS, Express oder Next.js-Server:** nicht notwendig für statische Web-Auslieferung und vorhandene Supabase-Funktionen.
- **Separater Analytics-/Crash-Reporting-SaaS:** keine Integration im überprüften Repository belegt.
- **Produktionstauglicher Google-Login, produktiver Resend-SMTP, eigene Custom-Domain, Android-Store-Release:** Konfiguration/Status außerhalb des Repositorys prüfen, bevor sie als produktiv bezeichnet werden.

## 7. Wartung und Entscheidungsgrundsätze

1. Bei Änderungen an Daten oder Zugriffskontrolle: SQL-Migrationen, RLS und RPC-Berechtigungen mitprüfen.
2. Bei Auth-Änderungen: Web-/Native-Callbacks und Provider-Konfiguration in Supabase, Apple/Google und Browser testen.
3. Bei Mailänderungen: SMTP-Konfiguration, Domain-Verifizierung, Vorlagen, SPF/DKIM und Zustellbarkeit separat prüfen – niemals Secrets committen.
4. Bei Releases: Web-Veröffentlichung und native TestFlight-Version getrennt versionieren.
5. Bei Dependency-Updates: Renovate-Regeln beachten und vor dem Merge Build, Unit-/E2E-Tests und bei Bedarf iOS-Simulatorlauf prüfen.

Die Begründungen in den Vergleichsspalten beschreiben die **technischen Vorteile und Kompromisse der aktuellen Architektur**. Sie sind keine nachträglich behaupteten historischen Auswahlprotokolle. Externe Konfigurationen können sich ohne Codeänderung ändern; entsprechende Einträge sollten nach Prüfung der Anbieter-Dashboards aktualisiert werden.
