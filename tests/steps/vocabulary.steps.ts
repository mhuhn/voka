import { When, Then } from "@cucumber/cucumber";
import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

Then("no bottom navigation or notification button is shown",async function(this:VokaWorld) {
  await expect(this.page.locator(".v-bottom-nav")).toHaveCount(0);
  await expect(this.page.getByRole("button",{name:"Notifications"})).toHaveCount(0);
});

Then("the list CSV download includes card IDs and both progress directions",async function(this:VokaWorld){
  const [download]=await Promise.all([
    this.page.waitForEvent("download"),
    this.page.getByRole("button",{name:"Export list as CSV"}).last().click()
  ]);
  expect(download.suggestedFilename()).toBe("Irregular Verbs.csv");
  const csv=await readFile((await download.path())!,"utf8");
  expect(csv).toContain("id,question,answer,marked,position,success_count,reverse_position,reverse_success_count");
  expect(csv).toContain('40000000-0000-4000-8000-000000000001');
  expect(csv).toContain('"go"');
  expect(csv).toContain('"went"');
  // Exports all cards, even the already learned/hidden ones.
  expect(csv).toContain('40000000-0000-4000-8000-000000000002');
});

When("I import CSV with one existing and one new card",async function(this:VokaWorld){
  const existing="40000000-0000-4000-8000-000000000001";
  let captured=false;
  await this.page.route("**/rest/v1/rpc/voka_import_cards_csv",async route=>{
    const body=route.request().postDataJSON() as {p_list_id:string;p_cards:Array<{id:string;question:string;reverse_position:number;reverse_success_count:number}>};
    expect(body.p_list_id).toBe("30000000-0000-4000-8000-000000000001");
    expect(body.p_cards).toHaveLength(2);
    expect(body.p_cards[0].id).toBe(existing);
    expect(body.p_cards[0].question).toBe("go updated");
    expect(body.p_cards[0].reverse_position).toBe(3);
    expect(body.p_cards[0].reverse_success_count).toBe(2);
    expect(body.p_cards[1].id).toBe("");
    captured=true;
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({added:1,updated:1}),
      headers:{"access-control-allow-origin":"*"}});
  });
  const csv=[
    "id,question,answer,marked,position,success_count,reverse_position,reverse_success_count",
    existing+",go updated,went,true,2,1,3,2",
    ",fresh,neu,false,0,0,0,0"
  ].join("\r\n");
  await this.page.locator('input[type="file"].v-csv-file-input').setInputFiles({
    name:"cards.csv",mimeType:"text/csv",buffer:Buffer.from(csv,"utf8")
  });
  await expect(this.page.getByText("CSV imported: 1 added, 1 updated.")).toBeVisible();
  expect(captured).toBe(true);
});

Then("the CSV importer updates one card and adds one card",async function(this:VokaWorld){
  await expect(this.page.getByText("CSV imported: 1 added, 1 updated.")).toBeVisible();
});

Then("CSV export and import buttons are visible in the phone list header",async function(this:VokaWorld){
  const header=this.page.locator(".v-heading .v-detail-header-actions");
  await expect(header.getByRole("button",{name:"Export list as CSV"})).toBeVisible();
  await expect(header.getByRole("button",{name:"Import CSV into list"})).toBeVisible();
  const bounds=await header.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(375);
});

When("the card API has no cards",async function(this:VokaWorld){
  await this.page.route("**/rest/v1/voka_cards*",async route=>{
    if(route.request().method()==="GET"){
      await route.fulfill({status:200,contentType:"application/json",body:"[]",headers:{"access-control-allow-origin":"*"}});
    }else await route.continue();
  });
});

Then("the list export button is disabled",async function(this:VokaWorld){
  await expect(this.page.getByRole("button",{name:"Export list as CSV"}).last()).toBeDisabled();
});

Then("the new list form suggests recent English tags and completes typed tags",async function(this:VokaWorld){
  await this.page.getByRole("button",{name:"Create list"}).click();
  const field=this.page.locator(".v-tag-field");
  await expect(field.getByText("Recently used")).toBeVisible();
  await expect(field.getByRole("button",{name:"Unit 3"})).toBeVisible();
  await expect(field.getByRole("button",{name:"Verben"})).toBeVisible();
  const input=field.getByRole("textbox",{name:"Tags"});
  await input.fill("Ve");
  await expect(field.getByRole("option",{name:"Verben"})).toBeVisible();
  await input.press("Enter");
  await expect(field.locator(".v-tag-row").getByRole("button",{name:/Verben/})).toBeVisible();
});

When("I return to vocabulary home", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: "Voka", exact: true }).click();
});

Then("I see subjects grouped on the home screen", async function (this: VokaWorld) {
  await expect(this.page.getByRole("heading", { name: "My subjects" })).toBeVisible();
  await expect(this.page.getByText("Sprachen", { exact: true })).toBeVisible();
  await expect(this.page.locator(".v-home").getByText("MINT", { exact: true })).toHaveCount(0);
  await expect(this.page.locator(".v-home").getByText("Sonstige", { exact: true })).toHaveCount(0);
});

When("I open the English subject", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: /Englisch/ }).click();
});

When("I open the irregular verbs list", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: /Irregular Verbs/ }).click();
});

Then("the list filters and sorting work", async function (this: VokaWorld) {
  await expect(this.page.getByText("2 Cards", { exact: true })).toBeVisible();
  const showLearned = this.page.getByRole("button", { name: "Show learned" });
  await expect(showLearned).toHaveAttribute("aria-pressed","false");
  await expect(this.page.locator(".v-card-list .v-card-open")).toHaveCount(2);
  await showLearned.click();
  await expect(this.page.getByText("3 Cards", { exact: true })).toBeVisible();
  await expect(this.page.locator(".v-card-list .v-card-open")).toHaveCount(3);
  await this.page.getByRole("button", { name: "Show Englisch" }).click();
  await expect(this.page.getByText("went", { exact: true })).toBeVisible();
  await this.page.getByRole("button", { name: "Only starred" }).click();
  await expect(this.page.getByText("1 Card", { exact: true })).toBeVisible();
  await this.page.getByRole("button", { name: "By points" }).click();
});

Then("I can open the card editor without editing progress", async function (this: VokaWorld) {
  await this.page.locator(".v-card-list .v-card-open").filter({hasText:"go"}).first().click();
  await expect(this.page.getByRole("heading", { name: "Edit card", exact: true })).toBeVisible();
  await expect(this.page.getByRole("textbox", { name: "Infinitiv" })).toHaveValue("go");
  await expect(this.page.getByRole("textbox", { name: "Englisch" })).toHaveValue("went");
  await expect(this.page.getByLabel(/Position/)).toHaveCount(0);
});

Then("the initial subject group order and tablet subjects are correct", async function (this: VokaWorld) {
  await expect(this.page.locator(".v-home .v-group-head strong")).toHaveText(["Sprachen"]);
  const languages = this.page.locator(".v-home .v-group").first().locator(".v-subject-scroll");
  await expect(languages.getByText("Englisch")).toBeVisible();
  await expect(languages.locator(".v-subject-row")).toHaveCount(1);
  await expect(languages.getByText("Französisch")).toHaveCount(0);
  const sizes = await languages.evaluate(element => ({
    content: element.scrollHeight, visible: element.clientHeight
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.visible + 1);
  await expect(this.page.getByRole("button", { name: "Add group" })).toHaveCount(0);
  await expect(this.page.getByRole("button", { name: "Manage subjects" })).toBeVisible();
});

Then("the list header is compact without properties or learning notices", async function (this: VokaWorld) {
  await expect(this.page.getByRole("heading", { name: /Irregular Verbs/ })).toBeVisible();
  await expect(this.page.locator(".v-heading-list-title .v-emoji")).toHaveText("🇬🇧");
  await expect(this.page.locator(".v-list-detail-pane").getByText("Irregular Verbs", { exact: true })).toHaveCount(1);
  await expect(this.page.locator(".v-list-detail-pane").getByText("Englisch", { exact: true })).toHaveCount(0);
  await expect(this.page.getByRole("heading", { name: "List properties" })).toHaveCount(0);
  await expect(this.page.getByText(/Learning points are managed automatically/)).toHaveCount(0);
});

Then("the tablet card editor opens to the right of the full list details", async function (this: VokaWorld) {
  const list = this.page.locator(".v-list-main");
  const editor = this.page.locator(".v-card-editor");
  await expect(list).toBeVisible();
  await expect(editor).toBeVisible();
  const listBox = await list.boundingBox();
  const editorBox = await editor.boundingBox();
  expect(listBox).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(editorBox!.x).toBeGreaterThan(listBox!.x + listBox!.width - 10);
  await expect(this.page.locator(".v-floating-star")).toHaveAttribute("aria-pressed", "true");
  await this.page.locator(".v-floating-star").click();
  await expect(this.page.locator(".v-floating-star")).toHaveAttribute("aria-pressed", "false");
  await expect(this.page.getByText(/Learning points are managed automatically/)).toHaveCount(0);
  await expect(this.page.locator(".v-card-editor .v-toggle")).toHaveCount(0);
});

Then("the language list form uses automatic labels", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: "Create list" }).click();
  const question = this.page.getByRole("textbox", { name: /Question label/ });
  const answer = this.page.getByRole("textbox", { name: /Answer label/ });
  await expect(question).toHaveValue("Deutsch");
  await expect(answer).toHaveValue("Englisch");
  await expect(answer).toHaveAttribute("readonly", "");
  await this.page.getByRole("combobox", { name: /Subject/ }).selectOption({label:"➗ Mathe"});
  await expect(question).toHaveValue("Question");
  await expect(answer).toHaveValue("Answer");
  await expect(answer).not.toHaveAttribute("readonly");
  await this.page.getByRole("combobox", { name: /Subject/ }).selectOption({label:"🇬🇧 Englisch"});
  await expect(question).toHaveValue("Deutsch");
  await expect(answer).toHaveValue("Englisch");
});

When("I switch to a phone-sized viewport", async function (this: VokaWorld) {
  await this.page.setViewportSize({width:375,height:667});
});

Then("the phone card editor stands alone with a floating star", async function (this: VokaWorld) {
  await expect(this.page.getByRole("heading", { name: "Edit card", exact: true })).toBeVisible();
  await expect(this.page.locator(".v-list-main")).toBeHidden();
  await expect(this.page.locator(".v-card-editor")).toBeVisible();
  await expect(this.page.locator(".v-floating-star")).toBeVisible();
  await expect(this.page.getByText(/Learning points are managed automatically/)).toHaveCount(0);
});

Then("the list detail is beside the complete subject list overview", async function (this: VokaWorld) {
  const overview=this.page.locator(".v-lists-pane");
  const details=this.page.locator(".v-list-detail-pane");
  await expect(overview).toBeVisible();
  await expect(details).toBeVisible();
  await expect(overview.getByRole("button",{name:/Irregular Verbs/})).toBeVisible();
  const a=await overview.boundingBox(),b=await details.boundingBox();
  expect(a).not.toBeNull();expect(b).not.toBeNull();
  expect(b!.x).toBeGreaterThan(a!.x+a!.width-12);
});

Then("the card editor occupies a third column", async function (this: VokaWorld) {
  const overview=this.page.locator(".v-lists-pane");
  const list=this.page.locator(".v-list-detail-pane");
  const editor=this.page.locator(".v-card-editor");
  await expect(overview).toBeVisible();
  await expect(list).toBeVisible();
  await expect(editor).toBeVisible();
  const a=await overview.boundingBox(),b=await list.boundingBox(),c=await editor.boundingBox();
  expect(a).not.toBeNull();expect(b).not.toBeNull();expect(c).not.toBeNull();
  expect(b!.x).toBeGreaterThan(a!.x+a!.width-12);
  expect(c!.x).toBeGreaterThan(b!.x+b!.width-12);
  await expect(this.page.getByRole("heading",{name:"Edit card",exact:true})).toBeVisible();
});

Then("the reverse-learning slider provides five levels", async function (this: VokaWorld) {
  const slider=this.page.getByRole("slider",{name:"Reverse questions"});
  await expect(slider).toBeVisible();
  await expect(slider).toHaveAttribute("min","0");
  await expect(slider).toHaveAttribute("max","100");
  await expect(slider).toHaveAttribute("step","25");
  await expect(slider).toHaveValue("0");
  for(const level of [25,50,75,100,0]){
    await this.page.getByRole("button",{name:level+" %",exact:true}).click();
    await expect(slider).toHaveValue(String(level));
  }
  await expect(this.page.getByRole("button",{name:"Learn in both directions"})).toHaveCount(0);
});

When("I switch to iPad landscape width", async function (this: VokaWorld) {
  await this.page.setViewportSize({width:1024,height:768});
});

When("I open list editing from its details", async function(this:VokaWorld){
 await this.page.locator(".v-pane-list-heading").getByRole("button",{name:"Edit list"}).click();
});

Then("the list editor stays beside the list overview", async function(this:VokaWorld){
 const overview=this.page.locator(".v-list-form-workspace .v-lists-pane");
 const editor=this.page.locator(".v-list-form-workspace .v-list-edit-pane");
 await expect(overview).toBeVisible(); await expect(editor).toBeVisible();
 await expect(overview.getByRole("button",{name:/Irregular Verbs/})).toBeVisible();
 await expect(editor.getByRole("textbox",{name:/Title/})).toHaveValue("Irregular Verbs");
 const a=await overview.boundingBox(), b=await editor.boundingBox();
 expect(a).not.toBeNull();expect(b).not.toBeNull();
 expect(b!.x).toBeGreaterThan(a!.x+a!.width-12);
});

When("I open the add-card form", async function(this:VokaWorld){
 await this.page.getByRole("button",{name:"Add card"}).click();
 await expect(this.page.locator(".v-card-editor")).toBeVisible();
});

Then("I can cancel a new card without saving it", async function(this:VokaWorld){
 const editor=this.page.locator(".v-card-editor");
 await editor.getByRole("textbox",{name:"Infinitiv"}).fill("never saved");
 await editor.getByRole("button",{name:"Cancel"}).click();
 await expect(editor).toHaveCount(0);
 await expect(this.page.locator(".v-card-list")).toBeVisible();
 await expect(this.page.getByText("never saved")).toHaveCount(0);
});

Then("the small phone has larger floating icon targets", async function(this:VokaWorld){
 const targets=this.page.locator(".v-floats .v-icon-button");
 await expect(targets).toHaveCount(1);
 for(const box of await targets.all()){
  const dims=await box.boundingBox();
  expect(dims).not.toBeNull();
  expect(dims!.width).toBeGreaterThanOrEqual(44);
  expect(dims!.height).toBeGreaterThanOrEqual(44);
 }
});

Then("the iPad uses comfortably sized touch controls and typography", async function(this:VokaWorld){
 const coarse=await this.page.evaluate(()=>window.matchMedia("(pointer:coarse)").matches);
 expect(coarse).toBe(true);
 const font=await this.page.locator(".v-app").evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 expect(font).toBeGreaterThanOrEqual(17);
 const floats=this.page.locator(".v-floats .v-icon-button");
 for(const b of await floats.all()){
  const dims=await b.boundingBox();
  expect(dims).not.toBeNull();
  expect(dims!.width).toBeGreaterThanOrEqual(48);
  expect(dims!.height).toBeGreaterThanOrEqual(48);
 }
 const firstAction=this.page.locator(".v-app .v-primary").first();
 const dims=await firstAction.boundingBox();
 expect(dims).not.toBeNull();
 expect(dims!.height).toBeGreaterThanOrEqual(50);
});


Then("the subject details offer no edit control", async function(this:VokaWorld){
 await expect(this.page.locator(".v-lists-pane").getByRole("button",{name:"Edit",exact:true})).toHaveCount(0);
 await expect(this.page.locator(".v-lists-pane .v-icon-button")).toHaveCount(0);
});

When("I open subject management", async function(this:VokaWorld){
 await this.page.getByRole("button",{name:"Manage subjects"}).click();
 await expect(this.page.getByRole("heading",{name:"Subject groups & subjects"})).toBeVisible();
});

Then("the management overview shows add actions without an editor", async function(this:VokaWorld){
 await expect(this.page.getByRole("dialog")).toHaveCount(0);
 await expect(this.page.locator(".v-manage-form")).toHaveCount(0);
 const groups=this.page.locator(".v-manage-group");
 await expect(groups).toHaveCount(3);
 for(const group of await groups.all()){
   await expect(group.getByRole("button",{name:"Add subject"})).toBeVisible();
 }
 await expect(this.page.locator(".v-manage").getByRole("button",{name:"Add group"})).toHaveCount(1);
});

When("I add a subject to the language group", async function(this:VokaWorld){
 const languages=this.page.locator(".v-manage-group").filter({hasText:"Sprachen"});
 await languages.getByRole("button",{name:"Add subject"}).click();
});

Then("the subject editor opens in a cancelable dialog with the correct group", async function(this:VokaWorld){
 const dialog=this.page.getByRole("dialog",{name:"Add subject"});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole("textbox",{name:/Title/})).toBeFocused();
 await expect(dialog.getByRole("combobox",{name:"Subject groups & subjects"}).locator("option:checked")).toHaveText("Sprachen");
 await dialog.getByRole("textbox",{name:/Title/}).fill("Temporary subject");
 await dialog.locator(".v-modal-actions").getByRole("button",{name:"Cancel"}).click();
 await expect(this.page.getByRole("dialog")).toHaveCount(0);
 await expect(this.page.getByRole("heading",{name:"Subject groups & subjects"})).toBeVisible();
 await this.page.locator(".v-manage-group").filter({hasText:"Sprachen"}).getByRole("button",{name:"Add subject"}).click();
 await expect(this.page.getByRole("dialog").getByRole("textbox",{name:/Title/})).toHaveValue("");
 await this.page.keyboard.press("Escape");
 await expect(this.page.getByRole("dialog")).toHaveCount(0);
});

Then("the group create and edit dialogs can be canceled", async function(this:VokaWorld){
 await this.page.locator(".v-manage").getByRole("button",{name:"Add group"}).click();
 let dialog=this.page.getByRole("dialog",{name:"Add group"});
 await expect(dialog).toBeVisible();
 await dialog.getByRole("textbox",{name:"Group name"}).fill("Not saved");
 await dialog.locator(".v-modal-actions").getByRole("button",{name:"Cancel"}).click();
 await expect(this.page.getByRole("dialog")).toHaveCount(0);
 await expect(this.page.getByText("Not saved",{exact:true})).toHaveCount(0);
 await this.page.locator(".v-manage-group").filter({hasText:"Sprachen"}).getByRole("button",{name:"Edit Sprachen"}).click();
 dialog=this.page.getByRole("dialog",{name:"Edit Group name"});
 await expect(dialog.getByRole("textbox",{name:"Group name"})).toHaveValue("Sprachen");
 await dialog.locator(".v-modal-actions").getByRole("button",{name:"Cancel"}).click();
 await this.page.locator(".v-manage-group").filter({hasText:"Sprachen"}).getByRole("button",{name:"Edit Englisch"}).click();
 dialog=this.page.getByRole("dialog",{name:"Edit Subject"});
 await expect(dialog.getByRole("textbox",{name:/Title/})).toHaveValue("Englisch");
 await dialog.locator(".v-modal-actions").getByRole("button",{name:"Cancel"}).click();
 await expect(this.page.getByRole("dialog")).toHaveCount(0);
});

Then("the list editor cancel button discards unsaved changes", async function(this:VokaWorld){
 const editor=this.page.locator(".v-list-edit-pane");
 await expect(editor).toBeVisible();
 await editor.getByRole("textbox",{name:/Title/}).fill("A title not saved");
 await editor.getByRole("button",{name:"Cancel",exact:true}).click();
 await expect(editor).toHaveCount(0);
 await expect(this.page.locator(".v-pane-list-heading")).toContainText("Irregular Verbs");
 await expect(this.page.getByText("A title not saved")).toHaveCount(0);
});

Then("a new subject is saved through its group dialog", async function(this:VokaWorld){
 const group=this.page.locator(".v-manage-group").filter({hasText:"Sprachen"});
 await group.getByRole("button",{name:"Add subject"}).click();
 const dialog=this.page.getByRole("dialog",{name:"Add subject"});
 await dialog.getByRole("textbox",{name:/Title/}).fill("Geschichte");
 await dialog.getByRole("textbox",{name:"Emoji"}).fill("📜");
 const requestPromise=this.page.waitForRequest(req=>
   new URL(req.url()).pathname==="/rest/v1/voka_subjects"&&req.method()==="POST");
 await dialog.getByRole("button",{name:"Save",exact:true}).click();
 const request=await requestPromise;
 const payload=request.postDataJSON() as {title:string;emoji:string;group_id:string};
 expect(payload.title).toBe("Geschichte");
 expect(payload.emoji).toBe("📜");
 expect(payload.group_id).toBe("10000000-0000-4000-8000-000000000001");
 await expect(this.page.getByRole("dialog")).toHaveCount(0);
 await expect(this.page.getByRole("heading",{name:"Subject groups & subjects"})).toBeVisible();
});

Then("an existing group is updated through the dialog", async function(this:VokaWorld){
 await this.page.locator(".v-manage-group").filter({hasText:"Sprachen"}).getByRole("button",{name:"Edit Sprachen"}).click();
 const dialog=this.page.getByRole("dialog",{name:"Edit Group name"});
 await dialog.getByRole("textbox",{name:"Group name"}).fill("Neue Sprachen");
 const requestPromise=this.page.waitForRequest(req=>
   new URL(req.url()).pathname==="/rest/v1/voka_subjectgroups"&&req.method()==="PATCH");
 await dialog.getByRole("button",{name:"Save",exact:true}).click();
 const request=await requestPromise;
 expect((request.postDataJSON() as {title:string}).title).toBe("Neue Sprachen");
 await expect(this.page.getByRole("dialog")).toHaveCount(0);
});

Then("cards sort by increasing position", async function (this: VokaWorld) {
  await this.page.getByRole("button",{name:"Show learned"}).click();
  const order=()=>this.page.locator(".v-card-list .v-card-question").allTextContents();
  await expect(this.page.getByRole("button",{name:"By position"})).toBeVisible();
  await this.page.getByRole("button",{name:"By position"}).click();
  expect(await order()).toEqual(["choose","go","be"]);
  await this.page.getByRole("button",{name:"Alphabetical"}).click();
  expect(await order()).toEqual(["be","choose","go"]);
  await this.page.getByRole("button",{name:"By points"}).click();
  expect(await order()).toEqual(["go","choose","be"]);
});

Then("the card editor uses its list's question and answer labels", async function (this: VokaWorld) {
  await this.page.locator(".v-card-list .v-card-open").filter({hasText:"go"}).first().click();
  const editor=this.page.locator(".v-card-editor");
  await expect(editor.getByRole("textbox",{name:"Infinitiv"})).toHaveValue("go");
  await expect(editor.getByRole("textbox",{name:"Englisch"})).toHaveValue("went");
  await editor.getByRole("button",{name:"Cancel"}).click();
  await this.page.getByRole("button",{name:"Add card"}).click();
  await expect(editor.getByRole("textbox",{name:"Infinitiv"})).toHaveValue("");
  await expect(editor.getByRole("textbox",{name:"Englisch"})).toHaveValue("");
});

Then("the language subject name suggests the matching flag", async function (this: VokaWorld) {
  const dlg=this.page.getByRole("dialog",{name:"Add subject"});
  const title=dlg.getByRole("textbox",{name:/Title/});
  const emoji=dlg.getByRole("textbox",{name:"Emoji"});
  const suggestions:[string,string][]=[
    ["Spanisch","🇪🇸"],["Italienisch","🇮🇹"],["Polnisch","🇵🇱"],
    ["Dänisch","🇩🇰"],["Portugiesisch","🇵🇹"],["Tschechisch","🇨🇿"],
    ["Schwedisch","🇸🇪"],["Russisch","🇷🇺"],["Chinesisch","🇨🇳"],
    ["Japanisch","🇯🇵"]
  ];
  for(const [name,icon] of suggestions) {
    await title.fill(name);
    await expect(emoji).toHaveValue(icon);
  }
  await emoji.fill("🎲");
  await title.fill("Spanisch");
  await expect(emoji).toHaveValue("🎲");
  await dlg.getByRole("button",{name:"Cancel",exact:true}).last().click();
});

Then("other school subjects suggest the matching emoji", async function (this: VokaWorld) {
  const group=this.page.locator(".v-manage-group").filter({hasText:"MINT"});
  await group.getByRole("button",{name:"Add subject"}).click();
  const dlg=this.page.getByRole("dialog",{name:"Add subject"});
  const title=dlg.getByRole("textbox",{name:/Title/});
  const emoji=dlg.getByRole("textbox",{name:"Emoji"});
  const suggestions:[string,string][]=[
    ["Geographie","🌍"],["Schwimmen","🏊"],["Medien","📰"],
    ["Sozialkunde","🏛️"],["Gesellschaftskunde","👥"],
    ["Politik","🗳️"],["Wirtschaft","📈"],
    ["Ethik","⚖️"],["Religion","🕊️"]
  ];
  for(const [name,icon] of suggestions){
    await title.fill(name);
    await expect(emoji).toHaveValue(icon);
  }
  await dlg.getByRole("button",{name:"Cancel",exact:true}).last().click();
});

Then("the German learned-card switch and card counts use the correct wording", async function(this:VokaWorld){
  const learned=this.page.getByRole("button",{name:"Gelernte anzeigen"});
  await expect(learned).toHaveAttribute("aria-pressed","false");
  await expect(this.page.locator(".v-list-count")).toHaveText("2 Karten");
  await learned.click();
  await expect(this.page.locator(".v-list-count")).toHaveText("3 Karten");
  await this.page.getByRole("button",{name:"Nur Markierte"}).click();
  await expect(this.page.locator(".v-list-count")).toHaveText("1 Karte");
  await expect(this.page.locator(".v-list-grid .v-list-row").first()).toContainText("3 Karten");
});

Then("the tablet list overview back arrow returns directly to My subjects",async function(this:VokaWorld){
  await expect(this.page.locator(".v-lists-pane")).toBeVisible();
  await expect(this.page.locator(".v-list-detail-pane")).toBeVisible();
  await this.page.locator(".v-heading").getByRole("button",{name:"Cancel"}).click();
  await expect(this.page.getByRole("heading",{name:"My subjects"})).toBeVisible();
  await expect(this.page.locator(".v-lists-pane")).toHaveCount(0);
  await expect(this.page.locator(".v-list-detail-pane")).toHaveCount(0);
});

Then("the main learning action uses a white background and short orange text underline",async function(this:VokaWorld){
  const button=this.page.locator(".v-home-learn");
  const label=button.locator(".v-learn-cta-label");
  await expect(button).toHaveClass(/v-learn-cta/);
  await expect(label).toHaveText("Learn");
  const visual=await button.evaluate(element=>{
    const style=getComputedStyle(element);
    const text=element.querySelector(".v-learn-cta-label")!;
    const underline=getComputedStyle(text,"::after");
    return {
      background:style.backgroundColor,
      foreground:style.color,
      fontWeight:getComputedStyle(text).fontWeight,
      lineColor:underline.backgroundColor,
      lineWidth:parseFloat(underline.width),
      lineHeight:parseFloat(underline.height),
      textWidth:text.getBoundingClientRect().width,
      accent:getComputedStyle(element.closest(".v-app")!).getPropertyValue("--v-orange").trim()
    };
  });
  expect(visual.background).toBe("rgb(255, 255, 255)");
  expect(visual.foreground).toBe("rgb(16, 16, 16)");
  expect(Number(visual.fontWeight)).toBeGreaterThanOrEqual(800);
  expect(visual.lineColor).toBe("rgb(255, 158, 0)");
  expect(visual.lineWidth).toBeLessThanOrEqual(76);
  expect(visual.lineWidth).toBeLessThan(visual.textWidth);
  expect(visual.lineHeight).toBeGreaterThanOrEqual(5);
  expect(visual.accent).toBe("#ff9e00");
});
