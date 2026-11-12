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

**Usage date:** `voka_list_usage` computes the latest of the card's `updated_at` and a query involving a card in the list. Group and subject usage are computed as maximum descendant list usage. A list with no edited/queried cards has no usage date. Groups, subjects, and lists are displayed newest-first, then alphabetically as the tie-breaker. A list with cards from several queries uses the latest relevant event, not its metadata update time.

The data migration creates the `voka_initialize_defaults()` RPC. Calling it for the first time for an authenticated eligible user creates:

- Sprachen: Englisch, Französisch, Latein, Griechisch
- MINT: Mathe, Informatik, Bio, Erdkunde, Physik, Chemie
- Sonstige: Kunst, Musik

Groups and subjects are fully editable/deletable after creation, without automatic recreation. `voka_settings` remembers initialization. There are no sample vocabulary lists or cards.

## Frontend navigation

`src/voka/VokaApp.tsx` provides home, subject lists, list detail, list create/edit, card create/edit, and subject/group management. `src/voka/data.ts` uses the same active authenticated Supabase client as the existing multi-account app. Switching accounts switches dataset; list data is never stored in a global browser cache.

Home groups show at most ~3 subjects at a time, scroll within the group to show more, and sort by usage. A subject opens all of its lists. A list shows its cards' questions, star marks, 0–3 point indicators, and optional answers. Independent filters can show only starred cards and/or only unlearned cards (score < 3); **Show unlearned starts off**. Sorting can be alphabetical (default) or fewest points first.

The Learn button is intentionally inert. Search, Statistics and Settings tabs are also placeholders. Query generation, scoring rules and positions remain part of the data model for a later implementation. The top-right semi-transparent floating buttons provide notifications (placeholder) and account profile (working). The existing registration, sign-in, switching, sign-out and password recovery flow is preserved behind the profile button.

On narrow screens the card editor is a full-screen view. In landscape/tablet layouts the current list's cards appear at left and the editor at right, using available width. Phone headers are compact and have no additional desktop-wide header row. The Voka wordmark is the first bottom tab.

## Operations

Deployments continue using the existing `react` branch workflow, with the public React application at <https://mhuhn.github.io/voka/react/>. Migrations are versioned under `supabase/migrations/`; they have already been applied to the existing `storage` project. App source edits trigger GitHub CI (TypeScript, unit, browser tests) before GitHub Pages deployment.

The Supabase Security Advisor also reports pre-existing notices concerning `voka_profiles` missing a policy, certain admin/security-definer routines, and leaked-password protection. These are unrelated to the newly created feature tables. Review them independently before broad production access.
