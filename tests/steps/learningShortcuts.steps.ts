import { When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

Then("the list is grouped by position and shows only visual score dots",async function(this:VokaWorld){
  const cardList=this.page.locator(".v-card-list");
  await expect(this.page.locator(".v-sort .active")).toHaveText("By position");
  await expect(cardList.locator(".v-position-heading")).toHaveText(["Position 1","Position 3"]);
  await expect(cardList.locator(".v-card-open").first()).toContainText("choose");
  await expect(cardList.locator(".v-card-open").last()).toContainText("go");
  await expect(cardList.locator(".v-dots i")).toHaveCount(8);
  await expect(cardList.locator(".v-score-pair b")).toHaveCount(0);
  await expect(cardList.locator(".v-score-pair")).not.toContainText("P");
  await this.page.getByRole("checkbox",{name:"Show learned"}).check();
  await expect(cardList.locator(".v-position-heading")).toHaveText(["Position 1","Position 3","Learned"]);
  await this.page.getByRole("button",{name:"By points"}).click();
  await expect(cardList.locator(".v-position-heading")).toHaveCount(0);
  await this.page.getByRole("button",{name:"By position"}).click();
  await expect(cardList.locator(".v-position-heading")).toHaveCount(3);
});

Then("the filter switches and sorting controls share a compact row",async function(this:VokaWorld){
  const toolbar=this.page.locator(".v-filter-area");
  await expect(toolbar.locator(".v-filter-switches .v-toggle")).toHaveCount(3);
  const toggle=await toolbar.locator(".v-filter-switches").boundingBox();
  const sorting=await toolbar.locator(".v-sort").boundingBox();
  expect(toggle).not.toBeNull();
  expect(sorting).not.toBeNull();
  expect(Math.abs((toggle!.y+toggle!.height/2)-(sorting!.y+sorting!.height/2))).toBeLessThan(15);
});

Then("the grade controls are shown above marking and editing",async function(this:VokaWorld){
  const grade=this.page.locator(".v-learning-result-actions");
  const tools=this.page.locator(".v-learning-card-tools");
  await expect(grade).toBeVisible();
  await expect(tools).toBeVisible();
  const gradeBox=await grade.boundingBox(),toolBox=await tools.boundingBox();
  expect(gradeBox).not.toBeNull();expect(toolBox).not.toBeNull();
  expect(gradeBox!.y+gradeBox!.height).toBeLessThan(toolBox!.y+3);
});

When("I reveal the hidden card with Enter",async function(this:VokaWorld){
  await expect(this.page.getByRole("button",{name:"Reveal"})).toBeVisible();
  await this.page.evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
  await this.page.keyboard.press("Enter");
  await expect(this.page.getByRole("button",{name:"Knew it"})).toBeVisible();
});

When("I reveal the hidden card with Space",async function(this:VokaWorld){
  await this.page.evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
  await this.page.keyboard.press("Space");
  await expect(this.page.getByRole("button",{name:"Knew it"})).toBeVisible();
});

When("I grade the revealed card with Space",async function(this:VokaWorld){
  const pending=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_grade_learning_v2");
  await this.page.evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
  await this.page.keyboard.press("Space");
  expect((await pending).postDataJSON()).toMatchObject({p_reverse:false,p_result:"known"});
});

When("I grade the revealed card with Enter",async function(this:VokaWorld){
  const pending=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_grade_learning_v2");
  await this.page.evaluate(()=>(document.activeElement as HTMLElement|null)?.blur());
  await this.page.keyboard.press("Enter");
  expect((await pending).postDataJSON()).toMatchObject({p_reverse:false,p_result:"known"});
});

Then("the next learning question is shown",async function(this:VokaWorld){
  await expect(this.page.locator(".v-learning-front")).toContainText("be");
  await expect(this.page.getByRole("button",{name:"Reveal"})).toBeVisible();
});
Then("the third learning question is shown",async function(this:VokaWorld){
  await expect(this.page.locator(".v-learning-front")).toContainText("go");
  await expect(this.page.getByRole("button",{name:"Reveal"})).toBeVisible();
});

When("I skip the learning pause",async function(this:VokaWorld){
  const button=this.page.locator(".v-detail-header-actions").getByRole("button",{name:"Skip learning pause"});
  await expect(button).toBeEnabled();
  const request=this.page.waitForRequest(req=>
    new URL(req.url()).pathname==="/rest/v1/rpc/voka_skip_learning_pause");
  await button.click();
  expect((await request).postDataJSON()).toEqual({p_list_id:"30000000-0000-4000-8000-000000000001"});
});
Then("the next learning round is available immediately",async function(this:VokaWorld){
  await expect(this.page.getByRole("button",{name:"Learn",exact:true})).toBeEnabled();
  await this.page.getByRole("button",{name:"Learn",exact:true}).click();
  await expect(this.page.locator(".v-learning")).toBeVisible();
  await expect(this.page.locator(".v-learning-front")).toContainText("go");
});
