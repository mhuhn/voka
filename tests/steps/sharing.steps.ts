import { When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

const sharedId="50000000-0000-4000-8000-000000000001";
const sourceId="30000000-0000-4000-8000-000000000001";

When("I open a shared-list invitation",async function(this:VokaWorld){
 await this.page.goto("http://127.0.0.1:5173/?importList="+sharedId);
});

When("I sign in to import as {string} with password {string}",async function(this:VokaWorld,email:string,password:string){
 await this.page.getByLabel("Email").fill(email);
 await this.page.getByLabel("Password").fill(password);
 await this.page.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(this.page.getByRole("dialog",{name:"Import shared list"})).toBeVisible();
});

Then("the app requires sign-in before importing the shared list",async function(this:VokaWorld){
 await expect(this.page.getByText("Sign in to import the shared vocabulary list.")).toBeVisible();
 await expect(this.page.getByRole("heading",{name:"Sign in"})).toBeVisible();
 await expect(this.page.getByRole("dialog")).toHaveCount(0);
});

Then("the shared-list import dialog appears with the source details",async function(this:VokaWorld){
 const modal=this.page.getByRole("dialog",{name:"Import shared list"});
 await expect(modal).toBeVisible();
 await expect(modal.getByText("Shared Verbs",{exact:true})).toBeVisible();
 await expect(modal.getByText("2 Cards",{exact:true})).toBeVisible();
 await expect(modal.getByRole("textbox",{name:"List title"})).toHaveValue("Shared Verbs");
 await expect(modal.getByRole("textbox",{name:/Tags/})).toHaveValue("Verben, Unit 7");
 await expect(modal.getByText("All imported cards start with 0 points and position 0.")).toBeVisible();
 await expect(modal.getByRole("combobox",{name:/Destination subject/})).toHaveValue("");
});

Then("I can import the shared list with my chosen subject title and tags",async function(this:VokaWorld){
 const modal=this.page.getByRole("dialog",{name:"Import shared list"});
 await modal.getByRole("combobox",{name:/Destination subject/}).selectOption("20000000-0000-4000-8000-000000000002");
 await modal.getByRole("textbox",{name:"List title"}).fill("My copy of verbs");
 await modal.getByRole("textbox",{name:/Tags/}).fill("revised, shared");
 const requestPromise=this.page.waitForRequest(req=>
  new URL(req.url()).pathname==="/rest/v1/rpc/voka_import_shared_list"&&req.method()==="POST"
 );
 await modal.getByRole("button",{name:"Import list"}).click();
 const request=await requestPromise;
 expect(request.postDataJSON()).toEqual({
  p_list_id:sharedId,p_subject_id:"20000000-0000-4000-8000-000000000002",
  p_title:"My copy of verbs",p_tags:["revised","shared"]
 });
 await expect(modal).toHaveCount(0);
 await expect(this.page.locator(".v-pane-list-heading")).toContainText("My copy of verbs");
 await expect(this.page.locator(".v-card-list .v-card-open")).toHaveCount(2);
 await expect(this.page.locator(".v-card-list .v-card-open").first().locator(".v-dots i.filled")).toHaveCount(0);
 await expect(this.page).not.toHaveURL(/importList=/);
});

Then("canceling the shared-list import leaves my lists untouched",async function(this:VokaWorld){
 const modal=this.page.getByRole("dialog",{name:"Import shared list"});
 await modal.getByRole("textbox",{name:"List title"}).fill("Discard this");
 await modal.getByRole("button",{name:"Cancel"}).last().click();
 await expect(modal).toHaveCount(0);
 await expect(this.page).not.toHaveURL(/importList=/);
 await expect(this.page.getByText("Discard this")).toHaveCount(0);
});

Then("the list share button calls the native share sheet with the list ID",async function(this:VokaWorld){
 await this.page.evaluate('Object.defineProperty(navigator,"share",{configurable:true,value:function(payload){window.__vokaShared=payload;return Promise.resolve();}})');
 await this.page.getByRole("button",{name:"More actions"}).click();
 await this.page.getByRole("button",{name:"Share",exact:true}).click();
 const payload=await this.page.evaluate(()=>(window as Window&{__vokaShared?:ShareData}).__vokaShared);
 expect(payload?.title).toBe("Irregular Verbs");
 const url=new URL(payload?.url||"");
 expect(url.origin).toBe("https://mhuhn.github.io");
 expect(url.pathname).toBe("/voka/");
 expect(url.searchParams.get("importList")).toBe(sourceId);
});

Then("sharing copies a usable link if no share sheet is supported",async function(this:VokaWorld){
 await this.page.evaluate('Object.defineProperty(navigator,"share",{configurable:true,value:undefined});Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:function(value){window.__vokaCopied=value;return Promise.resolve();}}})');
 await this.page.getByRole("button",{name:"More actions"}).click();
 await this.page.getByRole("button",{name:"Share",exact:true}).click();
 await expect(this.page.getByRole("status")).toContainText("Link copied");
 const link=await this.page.evaluate(()=>(window as Window&{__vokaCopied?:string}).__vokaCopied);
 expect(new URL(link||"").searchParams.get("importList")).toBe(sourceId);
});

When("I open a link to a missing shared list",async function(this:VokaWorld){
 await this.page.goto("http://127.0.0.1:5173/?importList=50000000-0000-4000-8000-000000000999");
});

Then("an unknown list cannot be imported",async function(this:VokaWorld){
 const modal=this.page.getByRole("dialog",{name:"Import shared list"});
 await expect(modal.getByRole("alert")).toContainText("This shared list was not found");
 await expect(modal.getByRole("button",{name:"Import list"})).toHaveCount(0);
 await modal.getByRole("button",{name:"Cancel"}).last().click();
 await expect(modal).toHaveCount(0);
});
