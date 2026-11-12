import { describe, expect, it } from "vitest";
import { addAccount, readRegistry, removeAccount, selectAccount } from "../../src/auth/registry";

const alice = { id: "00000000-0000-4000-8000-000000000001", name: "Alice", email: "alice@example.test" };
const bob = { id: "00000000-0000-4000-8000-000000000002", name: "Bob", email: "bob@example.test" };

describe("account registry", () => {
  it("adds multiple users without replacing existing users", () => {
    const state = addAccount(addAccount({ accounts: [], activeId: null }, alice), bob);
    expect(state.accounts).toHaveLength(2);
    expect(state.activeId).toBe(bob.id);
    expect(selectAccount(state, alice.id).accounts).toHaveLength(2);
  });

  it("deduplicates repeat sign-in", () => {
    const state = addAccount(addAccount({ accounts: [], activeId: null }, alice), alice);
    expect(state.accounts).toEqual([alice]);
  });

  it("removes only the signed-out user and selects another", () => {
    const state = addAccount(addAccount({ accounts: [], activeId: null }, alice), bob);
    expect(removeAccount(state, bob.id)).toEqual({ accounts: [alice], activeId: alice.id });
  });

  it("rejects corrupted or untrusted persisted state", () => {
    const storage = { getItem: () => '{"accounts":[{"id":"not-uuid","email":"x","name":"x"}],"activeId":"fake"}' };
    expect(readRegistry(storage).accounts).toEqual([]);
  });

  it("restores active user from persisted accounts", () => {
    const data = { accounts: [alice, bob], activeId: alice.id };
    const storage = { getItem: () => JSON.stringify(data) };
    expect(readRegistry(storage)).toEqual(data);
  });

  it("does not allow selecting an unknown account", () => {
    expect(() => selectAccount({ accounts: [alice], activeId: alice.id }, bob.id)).toThrow("Unknown account");
  });
});
