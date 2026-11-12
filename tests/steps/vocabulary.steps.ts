import { When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

When("I return to vocabulary home", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: "Voka", exact: true }).click();
});

Then("I see subjects grouped on the home screen", async function (this: VokaWorld) {
  await expect(this.page.getByRole("heading", { name: "My subjects" })).toBeVisible();
  await expect(this.page.getByText("Sprachen", { exact: true })).toBeVisible();
  await expect(this.page.getByText("MINT", { exact: true })).toBeVisible();
  await expect(this.page.getByText("Sonstige", { exact: true })).toBeVisible();
});

When("I open the English subject", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: /Englisch/ }).click();
});

When("I open the irregular verbs list", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: /Irregular Verbs/ }).click();
});

Then("the list filters and sorting work", async function (this: VokaWorld) {
  await expect(this.page.getByText("3 Cards", { exact: true })).toBeVisible();
  const unlearned = this.page.getByRole("checkbox", { name: "Show unlearned" });
  await expect(unlearned).not.toBeChecked();
  await unlearned.check();
  await expect(this.page.getByText("2 Cards", { exact: true })).toBeVisible();
  await this.page.getByRole("checkbox", { name: "Show answers" }).check();
  await expect(this.page.getByText("went", { exact: true })).toBeVisible();
  await this.page.getByRole("checkbox", { name: "Only starred" }).check();
  await expect(this.page.getByText("1 Cards", { exact: true })).toBeVisible();
  await this.page.getByRole("button", { name: "By points" }).click();
});

Then("I can open the card editor without editing progress", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: /go.*0 P/ }).click();
  await expect(this.page.getByRole("heading", { name: "Edit card", exact: true })).toBeVisible();
  await expect(this.page.getByRole("textbox", { name: /Question/ })).toHaveValue("go");
  await expect(this.page.getByRole("textbox", { name: /Answer/ })).toHaveValue("went");
  await expect(this.page.getByLabel(/Position/)).toHaveCount(0);
});

Then("the initial subject group order and tablet subjects are correct", async function (this: VokaWorld) {
  await expect(this.page.locator(".v-home .v-group-head strong")).toHaveText(["Sprachen", "MINT", "Sonstige"]);
  const languages = this.page.locator(".v-home .v-group").first().locator(".v-subject-scroll");
  await expect(languages.getByText("Griechisch")).toBeVisible();
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
  await this.page.setViewportSize({width:390,height:844});
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

Then("the direction control is a full-width push button", async function (this: VokaWorld) {
  const button=this.page.getByRole("button",{name:"Learn in both directions"});
  const input=this.page.getByRole("textbox",{name:/Title/});
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed","false");
  await expect(this.page.getByRole("checkbox",{name:"Learn in both directions"})).toHaveCount(0);
  const b=await button.boundingBox(), i=await input.boundingBox();
  expect(b).not.toBeNull();expect(i).not.toBeNull();
  expect(Math.abs(b!.width-i!.width)).toBeLessThan(3);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed","true");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed","false");
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
 await editor.getByRole("textbox",{name:/Question/}).fill("never saved");
 await editor.getByRole("button",{name:"Cancel"}).click();
 await expect(editor).toHaveCount(0);
 await expect(this.page.locator(".v-card-list")).toBeVisible();
 await expect(this.page.getByText("never saved")).toHaveCount(0);
});

Then("the small phone has larger floating icon targets", async function(this:VokaWorld){
 const targets=this.page.locator(".v-floats .v-icon-button");
 await expect(targets).toHaveCount(2);
 for(const box of await targets.all()){
  const dims=await box.boundingBox();
  expect(dims).not.toBeNull();
  expect(dims!.width).toBeGreaterThanOrEqual(42);
  expect(dims!.height).toBeGreaterThanOrEqual(42);
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
