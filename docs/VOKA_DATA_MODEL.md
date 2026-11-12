# Voka vocabulary data model and UI

Voka extends the authentication-first React/Capacitor app. The original `main` branch and the `base-app-v0.3.0` template are preserved; this feature lives in `react`.

## Tables in shared Supabase project `storage`

All new tables are in PostgreSQL `public` and start with `voka_`. No Supabase **file Storage** buckets are required: these are relational data, not files.

| Object | Main columns | Relationship |
| --- | --- | --- |
| `voka_settings` | `user_id`, `initialized_at` | Auth user; prevents recreating intentionally deleted defaults |
| `voka_subjectgroups` | `id`, `user_id`, `title` | Each group belongs to an auth user |
| `voka_subjects` | `id`, `user_id`, `group_id`, `emoji`, `title` | Group (same user) |
| `voka_lists` | `id`, `user_id`, `subject_id`, `title`, `tags text[]`, `question_label`, `answer_label`, `learn_both_directions`, timestamps | Subject (same user) |
| `voka_cards` | `id`, `user_id`, `list_id`, `question`, `answer`, `marked`, `success_count`, `position`, timestamps | List (same user) |
| `voka_queries` | `id`, `user_id`, `started_at`, `finished_at` | An assessment event; can span multiple lists |
| `voka_query_cards` | `query_id`, `card_id`, `user_id`, `result`, `answered_at` | Assessment-to-card join; results: `unknown`, `known`, `unsure` |
| `voka_list_usage` | `list_id`, `user_id`, `last_used_at` | Security-invoker read-only usage view |

The existing `voka_profiles` table is part of the previously created account schema and is not modified.

Foreign keys combine the referenced record's ID **and its owner**; a user cannot associate their list with another user's subject, or insert someone else's card in a query. Deleting a group cascades through subjects, lists, cards and query-card memberships. Queries remain independent events, with query-card links deleted when cards are removed. All tables have RLS. Authenticated users are permitted to manipulate their own rows only when the shared `can_access_app('voka')` function allows it. The public anonymous PostgreSQL role has no data access; browser clients use only the publishable project key and the signed-in session. The user ID is not selected by the client.

Both `success_count` (0–3) and `position` (0–20) have database constraints. New cards start at zero. Neither progress nor position is editable in the initial UI. The learning implementation will own those values later.

**Usage date:** `voka_list_usage` computes the latest of the card's `updated_at` and a query involving a card in the list. Group and subject usage are computed as maximum descendant list usage. A list with no edited/queried cards has no usage date. Groups, subjects, and lists are displayed newest-first. If usage dates are equal, default groups appear in the order Sprachen, MINT, Sonstige, then other groups alphabetically. A list with cards from several queries uses the latest relevant event, not its metadata update time.

The data migration creates the `voka_initialize_defaults()` RPC. Calling it for the first time for an authenticated eligible user creates:

- Sprachen: Englisch, Französisch, Latein, Griechisch
- MINT: Mathe, Informatik, Bio, Erdkunde, Physik, Chemie
- Sonstige: Kunst, Musik

Groups and subjects are fully editable/deletable after creation, without automatic recreation. `voka_settings` remembers initialization. There are no sample vocabulary lists or cards.

**Language list labels:** New lists belonging to a subject in the group named `Sprachen` use `Deutsch` as their default question label and the subject name as their automatic answer label. The answer label is read-only in the UI. Postgres triggers synchronize language list answer labels whenever the subject is renamed and enforce the same value on list writes; existing language lists were aligned without changing custom question labels.

## Frontend navigation

`src/voka/VokaApp.tsx` provides home, subject lists, list detail, list create/edit, card create/edit, and subject/group management. `src/voka/data.ts` uses the same active authenticated Supabase client as the existing multi-account app. Switching accounts switches dataset; list data is never stored in a global browser cache.

Home groups show about three subjects at a time with internal scrolling on phones and narrow tablets. When at least three groups are displayed side by side, every subject is shown without internal scrolling. Adding groups is available only through Manage subjects. A subject opens all of its lists. A list shows its cards' questions, star marks, 0–3 point indicators, and optional answers. Independent filters can show only starred cards and/or only unlearned cards (score < 3); **Show unlearned starts off**. Sorting can be alphabetical (default) or fewest points first.

The Learn button is intentionally inert. Search, Statistics and Settings tabs are also placeholders. Query generation, scoring rules and positions remain part of the data model for a later implementation. The top-right semi-transparent floating buttons provide notifications (placeholder) and account profile (working). When editing a card, a floating star button appears to the left of the bell; its marking is saved with the card. The existing registration, sign-in, switching, sign-out and password recovery flow is preserved behind the profile button.

On narrow screens the card editor occupies a separate view. On landscape tablets, the list details remain in the left column and the card editor opens to the right, using the full workspace width. List details show the subject emoji beside the single top-level title, without the subject name, metadata panel or learning-points notice. Card editing also omits its learning-points notice. Phone headers are compact and have no additional desktop-wide header row. The Voka wordmark is the first bottom tab.

## Responsive workspace and account visual design

At viewport widths of 900 pixels or more (including a 1024-pixel iPad in landscape), the subject screen opens with its list overview on the left. Opening a list keeps that overview visible and displays the selected list in a second, adjacent pane. Opening or adding a card adds its editor as a third, right-hand pane without hiding either the list overview or the list details. The selected list remains highlighted. Each pane uses flexible proportions and the available screen width. Below 900 pixels the app retains its sequential, single-screen navigation.

The list editor offers the **Learn in both directions** option as a full-width, keyboard-accessible pressed/unpressed button rather than a switch. It uses the same width as the full-width title and subject fields.

Sign-in, registration, password recovery and password reset now use Voka's navy/blue palette, orange-underlined wordmark, rounded blue actions and matching form fields; existing account management, OAuth conditions and translations remain unchanged.

## Tablet list editing, icons and account colors

On a wide screen (>=900 CSS pixels), editing an existing list keeps the overview of every list for the subject visible on the left and puts the complete editable list form on the right. This does not apply to creating a new list, which still has its own form. An unsaved card draft now has an explicit **Cancel** action that returns to list detail without saving it.

Voka uses the previously generated blue flashcard icon from 3 November 2026: the existing `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` and `public/apple-touch-icon.png` match that artwork. `index.html` now explicitly declares the 180×180 Apple Touch icon, as well as iOS standalone metadata, so adding the PWA to the home screen uses the artwork. The PWA manifest's theme/background colors now match the navy/blue interface. Existing iOS home-screen shortcuts may need to be removed and re-added for iOS to replace a cached icon.

Each signed-in account receives an unused random avatar color selected from a 20-color palette, stored locally under `voka:user-avatar-colors:v1`. It stays stable after reloads and account switching **on that device**. The same color appears on the floating profile icon, on the profile badge, and beside the account in the account switcher. The profile UI no longer uses the earlier green action color. For touch devices at widths of 700 CSS pixels or above, including iPad portrait and landscape, the app increases type sizes and tap targets. On narrow iPhones, floating control hit areas are 43×43 CSS pixels.

## Subject management and cancellation

The subject detail page shows its lists without a subject edit icon. Subject and subject-group changes belong to **Manage subjects**. Its initial view contains only the subject-group cards and their subjects (no inline editor). Each group ends with an **Add subject** button that opens a modal with that group preselected; **Add group** appears after the subject-group cards. Tapping an existing subject or a group's edit icon opens the same modal in editing mode. Its Cancel button, close icon, Escape key, or backdrop close the dialog without saving; focus is returned to the original control. Saving and deleting keep the user on the subject management overview.

Both creation and editing of a vocabulary list now offer an explicit **Cancel** button, restoring the previous view without saving draft changes. The existing card editor Cancel button is unchanged.

## Subject emoji suggestions and list card controls

The subject management modal suggests an emoji as the subject title is entered: Spanish 🇪🇸, Italian 🇮🇹, Polish 🇵🇱, Danish 🇩🇰, Portuguese 🇵🇹, Czech 🇨🇿, Swedish 🇸🇪, Russian 🇷🇺, Chinese 🇨🇳, Japanese 🇯🇵 (for subjects in any group). For Geographie 🌍, Schwimmen 🏊, Medien 📰, Sozialkunde 🏛️, Gesellschaftskunde 👥, Politik 🗳️, Wirtschaft 📈, Ethik ⚖️, and Religion 🕊️, suggestions work in any subject group. Suggestions are triggered by typing or changing groups; a manually selected emoji is preserved. Saved emojis are unchanged when existing subjects are edited.

The authenticated home page **Meine Fächer** displays a subject only when at least one vocabulary list belongs to it, and omits groups with no such visible subjects. **Fächer verwalten** continues showing every group and subject, including empty ones.

Card add/edit labels use the current list's `question_label` and `answer_label` instead of the generic words Question/Answer. The answer visibility toggle likewise uses the list's answer label (for example, `Englisch anzeigen` in German). A third sorting control orders cards by ascending `position` (0–20), with the question text as a stable tie-breaker. Alphabetical sorting remains the default and point sorting remains available. No position editing is added to the UI.

## Sharing and importing lists

A list detail screen offers **Share**. On browsers/devices supporting `navigator.share`, this launches the native share sheet. Otherwise the app copies a web-app link to the clipboard; where clipboard access is unavailable it displays a selectable link. The generated URL contains `?importList=<list UUID>` under the current public app base (e.g., `https://mhuhn.github.io/voka/react/?importList=...`). The link contains no account identifiers or credentials.

**Receiving a link:** If there is no active account, the normal login or registration UI appears first with an explanatory message. The incoming list ID is preserved in session storage across Supabase/Apple/Google OAuth callback redirects. When an approved account is active, Voka fetches a safe preview, then opens a modal to choose the destination subject, edit the list's title and tags, and confirm or cancel. Cancel removes the pending link without creating data. A deleted or unknown source reports an error. Only a completed import changes the recipient's data.

**Supabase SQL migration:** `supabase/migrations/20261112214000_voka_list_sharing.sql` adds two narrowly scoped authenticated-only RPCs:

- `public.voka_get_shared_list(p_list_id uuid)` returns a JSON object with title, tags, question/answer labels, both-directions option, and question/answer/mark for each card. It excludes the owner's ID, card learning points, positions, query history, and other private data.
- `public.voka_import_shared_list(p_list_id uuid,p_subject_id uuid,p_title text,p_tags text[])` atomically creates a new owner-scoped list and copies its cards, preserving the text and marked flag but setting **success_count=0 and position=0** for every card. The new list must be assigned to a subject owned by the importing user.

The public RPCs are `SECURITY INVOKER` wrappers; the privileged implementations reside under the non-exposed `app_private` schema, as installed by `supabase/migrations/20261112214500_voka_sharing_private_implementations.sql`. These implementations enforce `auth.uid() is not null` and `public.can_access_app('voka')`, and both the public RPCs and private helpers deny execution to `anon`. The privileged implementation can read a list through an otherwise unguessable UUID without relaxing existing owner-only table RLS. Anyone with a valid share link **and a permitted signed-in Voka account** may import that list (bearer-link sharing). The links do not expire, and a source owner can invalidate them by deleting the source list. Revocation or expiration controls are not provided in this version. Direct table access across users remains denied. Existing learning progress and assessment histories are never imported.

## Learning sessions and the two-hour pause

**Voka 0.6.0** provides a focused learning view opened from the list detail screen. The list overview, list detail panes and bottom navigation are hidden while studying. At the start, the server randomly orders all cards in that list with `position = 0` and `success_count < 4`, records a `voka_queries` row, and enrolls each card in `voka_query_cards`. The front shows only the question text and its list-specific label. **Reveal** flips the card with a 3D animation to show the answer and its label. For lists with `learn_both_directions = true`, an individual card may be tested in either direction, chosen at random. The answer is never shown before Reveal.

After revealing, the user can toggle the card's star or correct its question/answer in a dialog without abandoning the learning round. An answer requires one of three evaluations, saved immediately by the transactional `voka_grade_learning` RPC:

| Result | New points | Initial position |
| --- | --- | --- |
| Not known (`unknown`) | `0` | `1` |
| Unsure (`unsure`) | unchanged | `1` |
| Known (`known`), originally 0 | `1` | `2` |
| Known, originally 1 | `2` | `6` |
| Known, originally 2 | `3` | `19` |
| Known, originally 3 | `4` | `19` |

`4` points completes a card. The unlearned filter and progress percentage now use the `0..4` scale, and cards display four point indicators. Previously earned `3`-point cards are still eligible until they reach four.

When the last due card (`position=0` and points under 4) has been graded, the server **decreases the position of every card in that list by one (minimum 0)**, closes the query and sets `voka_lists.learning_paused_until = now() + interval '2 hours'`. The list's Learn button is disabled with a live remaining-minute label, even after reloading or switching devices. After the pause, another round may start. If there are still no due cards, starting a round advances every position once more and begins another two-hour pause. The button is disabled for empty lists and for lists whose cards have all reached four points.

**Finish learning** ends the current query without reverting any prior results; only still-due cards are offered at the next start. Database authorization is enforced by existing owner-only RLS and `public.can_access_app('voka')`, and new `SECURITY INVOKER` RPCs validate ownership of the list, query, and card while serializing changes. Results and timestamps remain in `voka_queries` and `voka_query_cards`. The schema changes live in `supabase/migrations/20261112230000_voka_learning.sql` and the production syntax correction is recorded in `20261112230500_voka_learning_callable_fix.sql`.

## Calendar-day learning spacing and list progress (Voka 0.7.0)

The **two-hour cooldown remains in force** after the last card of a round. A second, calendar-based cooldown applies if the previous learning query was fewer calendar days ago than the **minimum position of the currently unlearned cards** (points below 4). The local calendar date and midnight boundary are based on the IANA timezone saved when that previous query began, not UTC or rolling 24-hour durations. For example, a Monday 18:00 query followed by minimum position 1 can be studied again Tuesday at 00:00; if the minimum is 2, Wednesday 00:00, and so forth. A new session may begin only when **both** restrictions have expired, and the button indicates the later restriction (e.g. `bis morgen pausiert` / `bis Mittwoch pausiert` or the remaining two-hour pause minutes).

At a permitted learning start, the backend first computes the smallest remaining unlearned-card position `k`, reduces **every card in that list** by `k` with a floor of 0, then selects all now-due unlearned cards in randomized order and creates a new `voka_queries` entry within the same transaction. Fully learned cards are not used in the minimum calculation, preventing a completed card parked at zero from blocking unfinished cards. The existing end-of-round position decrement of 1 still applies. Stopping early leaves the other due cards at position 0 and does not create a calendar-day delay while their minimum remains 0.

The migration `supabase/migrations/20261112233500_voka_calendar_learning_pause.sql` adds `last_learning_at` and `learning_timezone` to `voka_lists`, backfills the most recent earlier query timestamp from existing history, and adds the owner-RLS-aware, security-invoker `voka_list_learning_state` view. A new two-argument `voka_begin_learning(p_list_id,p_timezone)` requires a valid IANA timezone and enforces both cooldowns and the position normalization on the server; an authenticated compatibility wrapper preserves the old one-argument endpoint for installed PWAs. The frontend reads the calculated calendar threshold from the same database view, so device changes do not reset the pause.

**List progress** is the equally weighted sum of successful runs divided by four times the number of cards, displayed as a percentage and progress bar in every row of the subject's list overview. This is the same formula already used by the list detail page. For example, five cards with points `[0,1,1,3,4]` yield `9 / 20 = 45%`.

## Operations

Deployments continue using the existing `react` branch workflow, with the public React application at <https://mhuhn.github.io/voka/react/>. Migrations are versioned under `supabase/migrations/`; they have already been applied to the existing `storage` project. App source edits trigger GitHub CI (TypeScript, unit, browser tests) before GitHub Pages deployment.

The Supabase Security Advisor also reports pre-existing notices concerning `voka_profiles` missing a policy, certain admin/security-definer routines, and leaked-password protection. These are unrelated to the newly created feature tables. Review them independently before broad production access.
