import { Then, When } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

Then("the list detail shows separate reverse learning points",async function(this:VokaWorld){
  const row=this.page.locator(".v-card-list .v-card-open").first();
  await expect(row.locator(".v-reverse-score")).toBeVisible();
  await expect(row.locator(".v-reverse-dots i")).toHaveCount(1);
  await expect(row.locator(".v-reverse-score i.filled")).toHaveCount(0);
  await expect(this.page.locator(".v-detail-progress")).toHaveAttribute("aria-valuenow","0");
});

Then("the normal orientation is first",async function(this:VokaWorld){
  const front=this.page.locator(".v-learning-front");
  await expect(front).toContainText("Infinitiv");
  await expect(front).toContainText("go");
  await expect(this.page.locator(".v-learning-session-name")).toContainText("Irregular Verbs");
  await expect(this.page.locator(".v-learning-progress-label")).toContainText("0 / 2");
  await expect(this.page.locator(".v-learning-points")).toContainText("0 / 4");
});

Then("the revealed answer has a clear light-blue background",async function(this:VokaWorld){
  const face=this.page.locator(".v-learning-back");
  await expect(face).toHaveAttribute("aria-hidden","false");
  const bg=await face.evaluate(element=>getComputedStyle(element).backgroundColor);
  expect(bg).toBe("rgb(210, 234, 255)");
});

When("I grade the normal orientation as known",async function(this:VokaWorld){
  const request=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_grade_learning_v2");
  await this.page.getByRole("button",{name:"Knew it"}).click();
  expect((await request).postDataJSON()).toMatchObject({p_reverse:false,p_result:"known"});
});

Then("the reverse orientation of the same card follows",async function(this:VokaWorld){
  await expect(this.page.locator(".v-learning-front")).toContainText("Englisch");
  await expect(this.page.locator(".v-learning-front")).toContainText("went");
  await expect(this.page.locator(".v-learning-points")).toContainText("0 / 1");
});

When("I grade the reverse orientation as known",async function(this:VokaWorld){
  const request=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_grade_learning_v2");
  await this.page.getByRole("button",{name:"Knew it"}).click();
  expect((await request).postDataJSON()).toMatchObject({p_reverse:true,p_result:"known"});
  await expect(this.page.locator(".v-learning")).toHaveCount(0);
});

Then("the two independent score tracks are updated",async function(this:VokaWorld){
  const row=this.page.locator(".v-card-list .v-card-open").first();
  await expect(row.locator(".v-dots i.filled")).toHaveCount(1);
  await expect(row.locator(".v-reverse-score i.filled")).toHaveCount(1);
  await expect(this.page.locator(".v-detail-progress")).toHaveAttribute("aria-valuenow","40");
});

Then("the new list inherits its subject's reverse percentage",async function(this:VokaWorld){
  await this.page.getByRole("button",{name:"Create list"}).click();
  const slider=this.page.getByRole("slider",{name:"Reverse questions"});
  await expect(slider).toHaveValue("25");
});
