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
  await expect(this.page.getByRole("heading", { name: "Edit card" })).toBeVisible();
  await expect(this.page.getByRole("textbox", { name: /Question/ })).toHaveValue("go");
  await expect(this.page.getByRole("textbox", { name: /Answer/ })).toHaveValue("went");
  await expect(this.page.getByLabel(/Position/)).toHaveCount(0);
});
