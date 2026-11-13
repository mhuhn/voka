import { When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

const listId="30000000-0000-4000-8000-000000000001";
const cardIds={
  go:"40000000-0000-4000-8000-000000000001",
  be:"40000000-0000-4000-8000-000000000002",
  choose:"40000000-0000-4000-8000-000000000003"
};

When("I start learning the open list",async function(this:VokaWorld){
  const request=this.page.waitForRequest(req=>
    new URL(req.url()).pathname==="/rest/v1/rpc/voka_begin_learning"
    && req.method()==="POST");
  await this.page.getByRole("button",{name:"Learn",exact:true}).click();
  expect((await request).postDataJSON()).toMatchObject({p_list_id:listId,p_timezone:expect.any(String)});
  await expect(this.page.locator(".v-learning")).toBeVisible();
});

Then("learning hides the list workspace and shows a question only",async function(this:VokaWorld){
  await expect(this.page.locator(".v-lists-pane")).toHaveCount(0);
  await expect(this.page.locator(".v-list-detail-pane")).toHaveCount(0);
  await expect(this.page.locator(".v-bottom-nav")).toHaveCount(0);
  await expect(this.page.locator(".v-learning-front")).toContainText("Infinitiv");
  await expect(this.page.locator(".v-learning-front")).toContainText("choose");
  await expect(this.page.locator(".v-learning-back")).toHaveAttribute("aria-hidden","true");
  await expect(this.page.getByRole("button",{name:"Reveal"})).toBeVisible();
  await expect(this.page.getByRole("button",{name:"Knew it"})).toHaveCount(0);
});

When("I reveal the learning card",async function(this:VokaWorld){
  await this.page.getByRole("button",{name:"Reveal"}).click();
});

Then("the answer flips into view with the matching label",async function(this:VokaWorld){
  await expect(this.page.locator(".v-learning-card-inner")).toHaveClass(/is-revealed/);
  await expect(this.page.locator(".v-learning-back")).toHaveAttribute("aria-hidden","false");
  await expect(this.page.locator(".v-learning-back")).toContainText("Englisch");
  await expect(this.page.locator(".v-learning-back")).toContainText("chose");
  await expect(this.page.getByRole("button",{name:"Knew it"})).toBeVisible();
  await expect(this.page.getByRole("button",{name:"Didn't know"})).toBeVisible();
  await expect(this.page.getByRole("button",{name:"Unsure"})).toBeVisible();
});

When("I correct and star the revealed card",async function(this:VokaWorld){
  await this.page.getByRole("button",{name:"Star card"}).click();
  await expect(this.page.getByRole("button",{name:"Remove star"})).toHaveAttribute("aria-pressed","true");
  await this.page.getByRole("button",{name:"Edit card"}).click();
  const dialog=this.page.getByRole("dialog",{name:"Edit card"});
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox",{name:"Infinitiv"}).fill("choose corrected");
  await dialog.getByRole("textbox",{name:"Englisch"}).fill("chose corrected");
  await dialog.getByRole("button",{name:"Save correction"}).click();
  await expect(dialog).toHaveCount(0);
  await expect(this.page.locator(".v-learning-back")).toContainText("chose corrected");
});

Then("all three answers save the rules and finish the list",async function(this:VokaWorld){
  // choose starts at 2 points -> known: 3 points, position 19.
  const grade1=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_grade_learning");
  await this.page.getByRole("button",{name:"Knew it"}).click();
  expect((await grade1).postDataJSON()).toEqual({
    p_query_id:"80000000-0000-4000-8000-000000000001",
    p_card_id:cardIds.choose,p_result:"known"
  });
  await expect(this.page.locator(".v-learning-front")).toContainText("be");
  await this.page.getByRole("button",{name:"Reveal"}).click();
  // be starts at 1 point -> unsure: retain 1 point, position 1.
  const grade2=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_grade_learning");
  await this.page.getByRole("button",{name:"Unsure"}).click();
  expect((await grade2).postDataJSON()).toMatchObject({p_card_id:cardIds.be,p_result:"unsure"});
  await expect(this.page.locator(".v-learning-front")).toContainText("go");
  await this.page.getByRole("button",{name:"Reveal"}).click();
  // go starts at 0 points -> unknown: 0 points, position 1.
  const grade3=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_grade_learning");
  await this.page.getByRole("button",{name:"Didn't know"}).click();
  expect((await grade3).postDataJSON()).toMatchObject({p_card_id:cardIds.go,p_result:"unknown"});
  await expect(this.page.locator(".v-learning")).toHaveCount(0);
  await expect(this.page.locator(".v-list-detail-pane")).toBeVisible();
  await expect(this.page.getByRole("button",{name:/Pause:.*(?:min|h) left/})).toBeDisabled();
  await expect(this.page.locator(".v-card-list .v-card-open")).toHaveCount(3);
  await expect(this.page.locator(".v-card-list .v-card-open").filter({hasText:"choose corrected"})).toContainText("3 P");
});

Then("the two-hour pause survives a page reload",async function(this:VokaWorld){
  const pause=this.page.getByRole("button",{name:/Pause:.*(?:min|h) left/});
  await expect(pause).toBeDisabled();
  await this.page.reload();
  await this.page.getByRole("button",{name:"Voka",exact:true}).click();
  await this.page.getByRole("button",{name:/Englisch/}).click();
  await this.page.getByRole("button",{name:/Irregular Verbs/}).click();
  await expect(this.page.getByRole("button",{name:/Pause:.*(?:min|h) left/})).toBeDisabled();
});

Then("stopping early retains the last result and leaves other cards due",async function(this:VokaWorld){
  await this.page.getByRole("button",{name:"Reveal"}).click();
  const grade=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_grade_learning");
  await this.page.getByRole("button",{name:"Knew it"}).click();
  expect((await grade).postDataJSON()).toMatchObject({p_card_id:cardIds.choose,p_result:"known"});
  const finished=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_finish_learning");
  await this.page.getByRole("button",{name:"Finish learning"}).click();
  expect((await finished).postDataJSON()).toEqual({p_query_id:"80000000-0000-4000-8000-000000000001"});
  await expect(this.page.locator(".v-learning")).toHaveCount(0);
  await expect(this.page.getByRole("button",{name:"Learn",exact:true})).toBeEnabled();
  await this.page.getByRole("button",{name:"Learn",exact:true}).click();
  await expect(this.page.locator(".v-learning-front")).toContainText("be");
});

Then("the list waits until tomorrow after a one-position delay",async function(this:VokaWorld){
  const button=this.page.getByRole("button",{name:"Paused until tomorrow"});
  await expect(button).toBeDisabled();
  await expect(this.page.locator(".v-list-detail-pane .v-progress")).toContainText("42 %");
});

When("I start the next permitted calendar-spaced round",async function(this:VokaWorld){
  const start=this.page.waitForRequest(req=>new URL(req.url()).pathname==="/rest/v1/rpc/voka_begin_learning");
  await this.page.getByRole("button",{name:"Learn",exact:true}).click();
  const payload=(await start).postDataJSON() as {p_list_id:string;p_timezone:string};
  expect(payload.p_list_id).toBe(listId);
  expect(payload.p_timezone).toBe("UTC");
  await expect(this.page.locator(".v-learning")).toBeVisible();
});

Then("the smallest active card position has been normalized to zero",async function(this:VokaWorld){
  await expect(this.page.locator(".v-learning-front")).toContainText("go");
  await expect(this.page.locator(".v-learning-session-name")).toContainText("1 of 1");
  await this.page.getByRole("button",{name:"Finish learning"}).click();
  await expect(this.page.locator(".v-learning")).toHaveCount(0);
});

Then("the paused learning button keeps a short underline under its text",async function(this:VokaWorld){
  const button=this.page.locator(".v-list-actions .v-learn-cta");
  await expect(button).toBeDisabled();
  const label=button.locator(".v-learn-cta-label");
  await expect(label).toContainText(/Pause:.*h left/);
  const visual=await button.evaluate(element=>{
    const text=element.querySelector(".v-learn-cta-label")!;
    const line=getComputedStyle(text,"::after");
    return {
      white:getComputedStyle(element).backgroundColor,
      black:getComputedStyle(element).color,
      textWidth:text.getBoundingClientRect().width,
      buttonWidth:element.getBoundingClientRect().width,
      lineWidth:parseFloat(line.width),
      lineColor:line.backgroundColor
    };
  });
  expect(visual.white).toBe("rgb(255, 255, 255)");
  expect(visual.black).toBe("rgb(16, 16, 16)");
  expect(visual.lineColor).toBe("rgb(255, 158, 0)");
  expect(visual.lineWidth).toBeGreaterThan(35);
  expect(visual.lineWidth).toBeLessThanOrEqual(76);
  expect(visual.lineWidth).toBeLessThan(visual.textWidth);
  expect(visual.lineWidth).toBeLessThan(visual.buttonWidth/2);
});
