import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingSharedList, isSharedListId, pendingSharedListId, shareUrlForList
} from "../../src/voka/sharing";

const id="50000000-0000-4000-8000-000000000001";

describe("Voka share links",()=>{
  beforeEach(()=>{
    sessionStorage.clear();
    window.history.replaceState({},"","/");
  });

  it("creates an app link with a list ID, not a local development URL",()=>{
    const url=new URL(shareUrlForList(id));
    expect(url.origin).toBe("https://mhuhn.github.io");
    expect(url.pathname).toBe("/voka/");
    expect(url.searchParams.get("importList")).toBe(id);
  });

  it("retains a valid inbound link through an OAuth callback",()=>{
    window.history.replaceState({},"","/?importList="+id);
    expect(pendingSharedListId()).toBe(id);
    window.history.replaceState({},"","/auth/callback?code=fake");
    expect(pendingSharedListId()).toBe(id);
    clearPendingSharedList();
    expect(pendingSharedListId()).toBeNull();
    expect(sessionStorage.getItem("voka:pending-shared-list")).toBeNull();
  });

  it("does not allow malformed IDs to be submitted as SQL UUIDs",()=>{
    expect(isSharedListId(id)).toBe(true);
    expect(isSharedListId("not-a-uuid")).toBe(false);
    expect(isSharedListId("../../../secrets")).toBe(false);
  });
});
