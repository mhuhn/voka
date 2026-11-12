import { Before, After, setDefaultTimeout, World } from "@cucumber/cucumber";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "@playwright/test";

setDefaultTimeout(30_000);

const users = [
  { id: "00000000-0000-4000-8000-000000000001", email: "alice@example.test", name: "Alice" },
  { id: "00000000-0000-4000-8000-000000000002", email: "bob@example.test", name: "Bob" }
];

function userPayload(user: typeof users[number]) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: user.name },
    identities: []
  };
}

function makeToken(user: typeof users[number]) {
  const b64 = (part: unknown) => Buffer.from(JSON.stringify(part)).toString("base64url");
  return b64({ alg: "HS256", typ: "JWT" }) + "." + b64({
    iss: "https://localhost/auth/v1", sub: user.id, aud: "authenticated",
    role: "authenticated", email: user.email, exp: Math.floor(Date.now() / 1000) + 3600
  }) + ".test-signature";
}

function json(data: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(data), headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } };
}

export class VokaWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
}

Before(async function (this: VokaWorld, { pickle }) {
  this.browser = await chromium.launch({ headless: true });
  const locales: Record<string, string> = {
    "@de": "de-DE", "@fr": "fr-FR", "@nl": "nl-NL",
    "@da": "da-DK", "@it": "it-IT"
  };
  const locale = pickle.tags.map(tag => locales[tag.name]).find(Boolean) ?? "en-US";
  this.context = await this.browser.newContext({ locale });
  this.page = await this.context.newPage();

  await this.page.route("http://127.0.0.1:54321/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
        "access-control-allow-headers": "authorization, apikey, content-type, x-client-info"
      } });
      return;
    }

    if (path === "/auth/v1/token" && method === "POST") {
      const body = request.postDataJSON() as { email?: string; password?: string };
      const found = users.find(u => u.email === body.email);
      if (!found || body.password !== "correct-password") {
        await route.fulfill(json({ msg: "Invalid login credentials", error: "invalid_grant" }, 400));
        return;
      }
      await route.fulfill(json({
        access_token: makeToken(found),
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "refresh-" + found.id,
        user: userPayload(found)
      }));
      return;
    }

    if (path === "/auth/v1/user" && method === "GET") {
      // Validate the JWT originally issued by the mock, rather than generating
      // a new JWT: its time-dependent exp claim changes between requests.
      const bearer = (request.headers()["authorization"] || "").replace(/^Bearer\s+/i, "");
      let sub: string | undefined;
      try {
        const [header, payload, signature] = bearer.split(".");
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
          sub?: string; exp?: number;
        };
        if (header && signature === "test-signature" &&
            typeof claims.exp === "number" && claims.exp > Date.now() / 1000) {
          sub = claims.sub;
        }
      } catch { /* Malformed mock JWT */ }
      const found = users.find(u => u.id === sub);
      await route.fulfill(found ? json(userPayload(found)) : json({ msg: "Invalid JWT" }, 401));
      return;
    }

    if (path === "/auth/v1/signup" && method === "POST") {
      const body = request.postDataJSON() as { email: string };
      const found = users.find(u => u.email === body.email) ?? users[0];
      await route.fulfill(json({ user: userPayload(found), session: null }));
      return;
    }

    if (path === "/auth/v1/recover" && method === "POST") {
      await route.fulfill(json({}));
      return;
    }

    if (path === "/auth/v1/logout" && method === "POST") {
      await route.fulfill(json({}));
      return;
    }

    await route.fulfill(json({ error: "Unsupported mock endpoint: " + method + " " + path }, 404));
  });
});

After(async function (this: VokaWorld) {
  await this.context?.close();
  await this.browser?.close();
});
