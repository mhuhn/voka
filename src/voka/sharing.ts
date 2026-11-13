import { profileManager } from "../auth/profiles";

const LINK_PARAMETER = "importList";
const SESSION_KEY = "voka:pending-shared-list";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SharedListCard {
  question: string;
  answer: string;
  marked: boolean;
}
export interface SharedList {
  id: string;
  title: string;
  tags: string[];
  question_label: string;
  answer_label: string;
  learn_both_directions: boolean;
  reverse_share: number;
  cards: SharedListCard[];
}

/** Always share the public web app, not the native/localhost Capacitor URL. */
export function shareUrlForList(id: string): string {
  const loc = window.location;
  const web = (loc.protocol === "https:" || loc.protocol === "http:")
    && loc.hostname !== "localhost" && loc.hostname !== "127.0.0.1";
  const base = web
    ? new URL(import.meta.env.BASE_URL, loc.origin)
    : new URL(import.meta.env.VITE_PUBLIC_APP_URL || "https://mhuhn.github.io/voka/");
  base.searchParams.set(LINK_PARAMETER, id);
  return base.toString();
}

/**
 * Store an incoming link across an OAuth redirect, which normally replaces the
 * callback URL. Keep a bad ID so the app can show an explicit error instead of
 * silently ignoring a malformed link.
 */
export function pendingSharedListId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get(LINK_PARAMETER);
  try {
    if (fromUrl !== null) {
      sessionStorage.setItem(SESSION_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return fromUrl;
  }
}

export function isSharedListId(id: string): boolean {
  return UUID.test(id);
}

export function clearPendingSharedList(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* blocked storage */ }
  const url = new URL(window.location.href);
  url.searchParams.delete(LINK_PARAMETER);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

function activeClient() {
  return profileManager.client;
}

export async function fetchSharedList(id: string): Promise<SharedList | null> {
  if (!isSharedListId(id)) return null;
  const {data,error} = await activeClient().rpc("voka_get_shared_list",{p_list_id:id});
  if (error) throw new Error(error.message);
  return data as SharedList | null;
}

/** Atomic server-side copy; cards' position and successful runs reset to zero. */
export async function importSharedList(
  id: string, subjectId: string, title: string, tags: string[]
): Promise<string> {
  if (!isSharedListId(id)) throw new Error("Invalid shared list ID");
  const {data,error} = await activeClient().rpc("voka_import_shared_list",{
    p_list_id:id,
    p_subject_id:subjectId,
    p_title:title,
    p_tags:tags
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string") throw new Error("Import did not return a list ID");
  return data;
}
