export interface AccountRecord {
  id: string;
  email: string;
  name: string;
}

export interface AccountRegistry {
  accounts: AccountRecord[];
  activeId: string | null;
}

export const REGISTRY_KEY = "voka:accounts:v1";
const EMPTY: AccountRegistry = { accounts: [], activeId: null };

export function readRegistry(storage: Pick<Storage, "getItem"> = localStorage): AccountRegistry {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(REGISTRY_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return { ...EMPTY, accounts: [] };
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.accounts)) return { ...EMPTY, accounts: [] };
    const unique = new Map<string, AccountRecord>();
    for (const entry of obj.accounts) {
      if (entry && typeof entry.id === "string" && /^[0-9a-f-]{36}$/i.test(entry.id) &&
        typeof entry.email === "string" && typeof entry.name === "string") {
        unique.set(entry.id, { id: entry.id, email: entry.email, name: entry.name });
      }
    }
    const accounts = [...unique.values()];
    const activeId = accounts.some(a => a.id === obj.activeId)
      ? String(obj.activeId) : (accounts[0]?.id ?? null);
    return { accounts, activeId };
  } catch {
    return { ...EMPTY, accounts: [] };
  }
}

export function addAccount(state: AccountRegistry, account: AccountRecord): AccountRegistry {
  return {
    activeId: account.id,
    accounts: [...state.accounts.filter(a => a.id !== account.id), account]
  };
}

export function removeAccount(state: AccountRegistry, id: string): AccountRegistry {
  const accounts = state.accounts.filter(a => a.id !== id);
  return {
    accounts,
    activeId: state.activeId === id ? accounts[0]?.id ?? null : state.activeId
  };
}

export function selectAccount(state: AccountRegistry, id: string): AccountRegistry {
  if (!state.accounts.some(a => a.id === id)) throw new Error("Unknown account");
  return { ...state, activeId: id };
}
