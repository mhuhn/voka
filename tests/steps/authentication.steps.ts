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

Given("my browser prefers German", async function (this: VokaWorld) {
  await this.page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["de-DE", "en-US"] });
    Object.defineProperty(navigator, "language", { configurable: true, get: () => "de-DE" });
  });
});

When("I open the Voka app in German", async function (this: VokaWorld) {
  await this.page.goto("http://127.0.0.1:5173/");
});

Then("I see the German sign-in form", async function (this: VokaWorld) {
  console.log("GERMAN TEST STATE", JSON.stringify({
    languages: await this.page.evaluate(() => navigator.languages),
    lang: await this.page.locator("html").getAttribute("lang"),
    body: (await this.page.locator("body").innerText()).slice(0, 900),
    url: this.page.url()
  }));
  await expect(this.page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  await expect(this.page.getByRole("button", { name: "Registrieren" })).toBeVisible();
  await expect(this.page.locator("html")).toHaveAttribute("lang", "de");
});

Then("Google login is hidden", async function (this: VokaWorld) {
  await expect(this.page.getByRole("button", { name: "Google" })).toHaveCount(0);
});

Then("I see the version in the bottom-left corner", async function (this: VokaWorld) {
  await expect(this.page.getByRole("contentinfo", { name: "Letzte Code-Änderung" })).toContainText(/v\d+\.\d+\.\d+ · /);
});
