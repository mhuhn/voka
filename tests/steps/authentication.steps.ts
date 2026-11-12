import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "@playwright/test";
import type { VokaWorld } from "../support/world";

Given("I open the Voka app", async function (this: VokaWorld) {
  await this.page.goto("http://127.0.0.1:5173/");
  await expect(this.page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

When("I sign in as {string} with password {string}", async function (this: VokaWorld, email: string, password: string) {
  await this.page.getByLabel("Email").fill(email);
  await this.page.getByLabel("Password").fill(password);
  await this.page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(this.page.getByRole("heading", { name: "My profile" })).toBeVisible();
});

When("I open registration", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: "Register" }).click();
});

When("I register {string} with email {string} and password {string}", async function (this: VokaWorld, name: string, email: string, password: string) {
  await this.page.getByLabel("Name").fill(name);
  await this.page.getByLabel("Email").fill(email);
  await this.page.getByLabel("Password").fill(password);
  await this.page.getByRole("button", { name: "Create account" }).click();
});

Then("I see an email confirmation message", async function (this: VokaWorld) {
  await expect(this.page.getByRole("status")).toContainText("Check your email");
});

When("I open password reset", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: "Forgot password?" }).click();
});

When("I request a reset for {string}", async function (this: VokaWorld, email: string) {
  await this.page.getByLabel("Email").fill(email);
  await this.page.getByRole("button", { name: "Send reset link" }).click();
});

Then("I see a password reset message", async function (this: VokaWorld) {
  await expect(this.page.getByRole("status")).toContainText("reset link has been sent");
});

When("I sign out", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: "Sign out" }).click();
});

Then("I see the sign-in form", async function (this: VokaWorld) {
  await expect(this.page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

When("I add another user", async function (this: VokaWorld) {
  await this.page.getByRole("button", { name: "Add another user" }).click();
});

When("I switch to {string}", async function (this: VokaWorld, email: string) {
  await this.page.getByRole("button", { name: "Switch to " + email }).click();
});

When("I reload the app", async function (this: VokaWorld) {
  await this.page.reload();
  await expect(this.page.getByRole("heading", { name: "My profile" })).toBeVisible();
});

Then("I see the profile for {string}", async function (this: VokaWorld, email: string) {
  await expect(this.page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await expect(this.page.locator('[data-slot="card"]').first()).toContainText(email);
});

Then("I do not see the sign-in form", async function (this: VokaWorld) {
  await expect(this.page.getByRole("heading", { name: "Sign in" })).not.toBeVisible();
});
