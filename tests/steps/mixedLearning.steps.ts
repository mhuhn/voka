import { When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

When("I open the multi-subject learning selector",async function(this:VokaWorld){
  await this.page.locator(".v-home").getByRole("button",{name:"Learn",exact:true}).click();
  await expect(this.page.locator(".v-mixed-picker")).toBeVisible();
});

Then("the live count uses selected subjects and every selected tag",async function(this:VokaWorld){
  const picker=this.page.locator(".v-mixed-picker");
  await expect(picker.locator(".v-mixed-card-count strong")).toHaveText("0");
  await picker.getByRole("checkbox",{name:/Englisch/}).check();
  await expect(picker.locator(".v-mixed-card-count strong")).toHaveText("1");
  await picker.getByRole("checkbox",{name:/Mathe/}).check();
  await expect(picker.locator(".v-mixed-card-count strong")).toHaveText("3");
  await picker.getByRole("checkbox",{name:"Verben"}).check();
  const requestPromise=this.page.waitForRequest(req=>
     new URL(req.url()).pathname==="/rest/v1/rpc/voka_preview_mixed_learning" &&
     (req.postDataJSON() as {p_tags:string[]}).p_tags.length===2);
  await picker.getByRole("checkbox",{name:"Unit 3"}).check();
  await expect(picker.locator(".v-mixed-card-count strong")).toHaveText("2");
  const request=await requestPromise;

  expect((request.postDataJSON() as {p_tags:string[]}).p_tags.slice().sort()).toEqual(["Unit 3","Verben"]);
});

When("I start learning the selected subjects and tags",async function(this:VokaWorld){
  const request=this.page.waitForRequest(req=>
    new URL(req.url()).pathname==="/rest/v1/rpc/voka_begin_mixed_learning");
  await this.page.locator(".v-mixed-picker").getByRole("button",{name:"Start learning"}).click();
  expect((await request).postDataJSON()).toMatchObject({
    p_subject_ids:[
      "20000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000002"
    ],
    p_tags:["Verben","Unit 3"],
    p_timezone:expect.any(String)
  });
  await expect(this.page.locator(".v-learning")).toBeVisible();
});

Then("the learning session processes the subjects in order with a transition",async function(this:VokaWorld){
  await expect(this.page.locator(".v-learning-front")).toContainText("choose");
  await this.page.getByRole("button",{name:"Reveal"}).click();
  await this.page.getByRole("button",{name:"Knew it"}).click();
  const overlay=this.page.locator(".v-learning-transition");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("Mathe");
  await expect(overlay).toBeHidden();
  await expect(this.page.locator(".v-learning-front")).toContainText("2 + 2");
  await expect(this.page.locator(".v-learning-front")).toContainText("Aufgabe");
  await this.page.getByRole("button",{name:"Reveal"}).click();
  await expect(this.page.locator(".v-learning-back")).toContainText("Lösung");
  await this.page.getByRole("button",{name:"Unsure"}).click();
  await expect(this.page.locator(".v-learning")).toHaveCount(0);
  await expect(this.page.getByRole("heading",{name:"My subjects"})).toBeVisible();
});

Then("the share control is a small round heading button",async function(this:VokaWorld){
  const button=this.page.locator(".v-detail-header-actions").getByRole("button",{name:"Share"});
  await expect(button).toBeVisible();
  const size=await button.boundingBox();
  expect(size).not.toBeNull();
  expect(size!.width).toBeLessThanOrEqual(49);
  expect(size!.height).toBeLessThanOrEqual(49);
  await expect(this.page.locator(".v-list-actions .v-share-button")).toHaveCount(0);
});

Then("Enter moves to the answer and saves a new card while staying in the editor",async function(this:VokaWorld){
  const editor=this.page.locator(".v-card-editor");
  const question=editor.getByRole("textbox",{name:"Infinitiv"});
  const answer=editor.getByRole("textbox",{name:"Englisch"});
  await question.fill("first input");
  await question.press("Enter");
  await expect(answer).toBeFocused();
  await answer.fill("first output");
  const sent=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/voka_cards"&&req.method()==="POST");
  await answer.press("Enter");
  expect((await sent).postDataJSON()).toMatchObject({question:"first input",answer:"first output",success_count:0,position:0});
  await expect(question).toBeFocused();
  await expect(question).toHaveValue("");
  await expect(answer).toHaveValue("");
  await question.fill("second input");
  await question.press("Enter");
  await answer.fill("second output");
  const second=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/voka_cards"&&req.method()==="POST");
  await answer.press("Enter");
  expect((await second).postDataJSON()).toMatchObject({question:"second input",answer:"second output"});
  await expect(question).toBeFocused();
  await expect(editor).toBeVisible();
});

Then("the tablet overview back arrow returns straight to My subjects",async function(this:VokaWorld){
  await expect(this.page.locator(".v-card-editor")).toBeVisible();
  await this.page.locator(".v-heading").getByRole("button",{name:"Cancel"}).click();
  await expect(this.page.getByRole("heading",{name:"My subjects"})).toBeVisible();
  await expect(this.page.locator(".v-lists-pane")).toHaveCount(0);
});

When("I open the first card for tablet navigation",async function(this:VokaWorld){
  await this.page.locator(".v-card-list .v-card-open").first().click();
  await expect(this.page.locator(".v-card-editor")).toBeVisible();
});
