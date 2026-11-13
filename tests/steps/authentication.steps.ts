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
  await this.page.locator(".v-floats button").last().click();
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

When("I create a profile named {string}", async function(this:VokaWorld,name:string) {
  await this.page.getByRole("button",{name:"New profile"}).click();
  await this.page.getByRole("textbox",{name:"First name"}).fill(name);
  await this.page.getByRole("button",{name:"Create profile"}).click();
  await expect(this.page.getByRole("button",{name:"Switch profile: "+name})).toBeVisible();
});

Then("I can switch to the profile named {string}", async function(this:VokaWorld,name:string) {
  await expect(this.page.getByRole("button",{name:"Switch profile: "+name})).toBeVisible();
});

When("I switch to the profile named {string}", async function(this:VokaWorld,name:string) {
  await this.page.getByRole("button",{name:"Switch profile: "+name}).click();
  await expect(this.page.locator(".v-home")).toBeVisible();
});

Then("I can delete the profile named {string}", async function(this:VokaWorld,name:string) {
  this.page.once("dialog",dialog=>void dialog.accept());
  await this.page.getByRole("button",{name:"Delete profile: "+name}).click();
  await expect(this.page.getByRole("button",{name:"Switch profile: "+name})).toHaveCount(0);
});

Then("I cannot delete the last profile", async function(this:VokaWorld) {
  await expect(this.page.getByRole("button",{name:/Delete profile:/})).toBeDisabled();
});

When("I return to Voka from the profile page", async function(this:VokaWorld) {
  await this.page.getByRole("button",{name:"Voka",exact:true}).click();
});

When("I open the profile page", async function(this:VokaWorld) {
  await this.page.locator(".v-floats button").last().click();
});

Then("no lists from the default profile are visible", async function(this:VokaWorld) {
  await expect(this.page.getByRole("button",{name:/Irregular Verbs/})).toHaveCount(0);
  await expect(this.page.getByRole("button",{name:/Englisch/})).toHaveCount(0);
});

Then("the original lists are visible again", async function(this:VokaWorld) {
  await expect(this.page.getByRole("button",{name:/Englisch/})).toBeVisible();

When("I reload the app", async function (this: VokaWorld) {
  await this.page.reload();
  await this.page.locator(".v-floats button").last().click();
  await expect(this.page.getByRole("heading", { name: "My profile" })).toBeVisible();
});

Then("I see the profile for {string}", async function (this: VokaWorld, email: string) {
  if (!(await this.page.getByRole("heading", { name: "My profile" }).isVisible())) await this.page.locator(".v-floats button").last().click();
  await expect(this.page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await expect(this.page.locator('[data-slot="card"]').first()).toContainText(email);
});

Then("I do not see the sign-in form", async function (this: VokaWorld) {
  await expect(this.page.getByRole("heading", { name: "Sign in" })).not.toBeVisible();
});

Given("my browser prefers German", async function (this: VokaWorld) {
  expect((await this.page.evaluate(() => navigator.language)).toLowerCase()).toMatch(/^de/);
});

When("I open the Voka app in German", async function (this: VokaWorld) {
  await this.page.goto("http://127.0.0.1:5173/");
});

Then("I see the German sign-in form", async function (this: VokaWorld) {
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

Given("I open the Voka app in the current locale", async function (this: VokaWorld) {
  await this.page.goto("http://127.0.0.1:5173/");
});

When("I sign in using the current locale as {string} with password {string}", async function (this: VokaWorld, email: string, password: string) {
  const locale = await this.page.locator("html").getAttribute("lang");
  const labels: Record<string, { email: string; password: string; signIn: string }> = {
    de: { email: "E-Mail", password: "Passwort", signIn: "Anmelden" },
    fr: { email: "E-mail", password: "Mot de passe", signIn: "Se connecter" },
    nl: { email: "E-mail", password: "Wachtwoord", signIn: "Inloggen" },
    da: { email: "E-mail", password: "Adgangskode", signIn: "Log ind" },
    it: { email: "E-mail", password: "Password", signIn: "Accedi" }
  };
  const label = labels[locale || ""];
  if (!label) throw new Error("Unexpected locale: " + locale);
  await this.page.getByLabel(label.email).fill(email);
  await this.page.getByLabel(label.password).fill(password);
  await this.page.getByRole("button", { name: label.signIn, exact: true }).click();
  await this.page.locator(".v-floats button").last().click();
});

Then("the profile heading is {string}", async function (this: VokaWorld, title: string) {
  await expect(this.page.getByRole("heading", { name: title })).toBeVisible();
});

Then("the profile sign-out button is {string}", async function (this: VokaWorld, label: string) {
  await expect(this.page.getByRole("button", { name: label, exact: true })).toBeVisible();
  await expect(this.page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
});

Then("the account section heading is {string}", async function (this: VokaWorld, title: string) {
  await expect(this.page.getByRole("heading", { name: title })).toBeVisible();
});

Then("the add-account button is {string}", async function (this: VokaWorld, label: string) {
  await expect(this.page.getByRole("button", { name: label, exact: true })).toBeVisible();
});

Then("the sign-in form uses the Voka visual theme", async function (this: VokaWorld) {
  await expect(this.page.locator(".v-auth-wordmark")).toHaveText("Voka");
  await expect(this.page.locator(".v-auth-card")).toBeVisible();
  await expect(this.page.locator(".v-auth-card").getByRole("heading",{name:"Sign in"})).toBeVisible();
  const primary=this.page.locator(".v-auth-card button[type=submit]");
  await expect(primary).toHaveClass(/v-auth-primary/);
  const gradient=await primary.evaluate(el=>getComputedStyle(el).backgroundImage);
  expect(gradient).toContain("linear-gradient");
});

Then("the registration form keeps that visual theme", async function (this: VokaWorld) {
  await expect(this.page.locator(".v-auth-wordmark")).toHaveText("Voka");
  await expect(this.page.locator(".v-auth-card")).toBeVisible();
  await expect(this.page.locator(".v-auth-card").getByRole("heading",{name:"Create an account"})).toBeVisible();
  await expect(this.page.locator(".v-auth-card button[type=submit]")).toHaveClass(/v-auth-primary/);
});

Then("the Voka home-screen icon is explicitly linked on iOS", async function(this:VokaWorld){
 const icon=this.page.locator('link[rel="apple-touch-icon"]');
 await expect(icon).toHaveAttribute("sizes","180x180");
 const path=await icon.getAttribute("href");
 expect(path).toContain("apple-touch-icon.png");
 expect(path).not.toContain("%BASE_URL%");
 const response=await this.page.request.get(new URL(path!,this.page.url()).toString());
 expect(response.ok()).toBe(true);
 expect(response.headers()["content-type"]).toContain("image/png");
});

Then("each account has a different persistent profile color", async function(this:VokaWorld){
 const map=await this.page.evaluate(()=>{
  const value=localStorage.getItem("voka:user-avatar-colors:v1");
  return value?JSON.parse(value) as Record<string,string>:{};
 });
 const ids=["00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002"];
 expect(map[ids[0]]).toMatch(/^#[0-9A-F]{6}$/);
 expect(map[ids[1]]).toMatch(/^#[0-9A-F]{6}$/);
 expect(map[ids[0]]).not.toBe(map[ids[1]]);
 const badge=this.page.locator(".v-profile-avatar");
 await expect(badge).toBeVisible();
 await expect(badge).toHaveCSS("color",/^rgb/);
 const actual=await badge.evaluate(el=>getComputedStyle(el).color);
 const expected=map[ids[1]].match(/\w\w/g)!.map(n=>parseInt(n,16));
 expect(actual).toBe("rgb("+expected.join(", ")+")");
 await expect(this.page.locator(".v-profile .v-profile-action").first()).toBeVisible();
});

Then("the selected user's floating avatar retains their profile color", async function(this:VokaWorld){
 const map=await this.page.evaluate(()=>JSON.parse(localStorage.getItem("voka:user-avatar-colors:v1")||"{}") as Record<string,string>);
 const id="00000000-0000-4000-8000-000000000001";
 const expected=map[id].match(/\w\w/g)!.map(n=>parseInt(n,16));
 await this.page.getByRole("button",{name:"Voka",exact:true}).click();
 const avatar=this.page.locator(".v-user-float");
 await expect(avatar).toBeVisible();
 await expect(avatar).toHaveCSS("color","rgb("+expected.join(", ")+")");
});

Then("the account profile has no green-themed controls", async function(this:VokaWorld){
 await expect(this.page.locator(".v-profile-card")).toHaveCount(2);
 await expect(this.page.locator(".v-profile-avatar")).toBeVisible();
 const logout=this.page.locator(".v-profile-card .v-profile-action").first();
 await expect(logout).toBeVisible();
 await expect(logout).toHaveCSS("color",/rgb/);
 await expect(this.page.locator(".v-profile .bg-green-50, .v-profile .text-green-800, .v-profile .text-green-900")).toHaveCount(0);
});
