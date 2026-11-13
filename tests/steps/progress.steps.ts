import { Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

Then("the list overview shows the equally weighted 45-percent progress",async function(this:VokaWorld){
  const row=this.page.locator(".v-list-row").filter({hasText:"Irregular Verbs"});
  await expect(row.locator(".v-list-progress-label")).toContainText("45 %");
  await expect(row.getByRole("progressbar")).toHaveAttribute("aria-valuenow","45");
  await row.click();
  await expect(this.page.locator(".v-list-detail-pane .v-progress")).toContainText("45 %");
});
