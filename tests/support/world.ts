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
  const sampleData = pickle.tags.some(tag => tag.name === "@voka");
  const touchTablet = pickle.tags.some(tag => tag.name === "@touch");
  this.context = await this.browser.newContext({ locale, ...(touchTablet ? {hasTouch:true,viewport:{width:1180,height:820}} : {}) });
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

    if (path === "/rest/v1/rpc/voka_initialize_defaults" && method === "POST") {
      await route.fulfill(json(null));
      return;
    }
    if (path.startsWith("/rest/v1/voka_") && method === "GET") {
      const fixtures: Record<string, unknown[]> = {
        voka_subjectgroups: [
          {id:"10000000-0000-4000-8000-000000000001",user_id:users[0].id,title:"Sprachen"},
          {id:"10000000-0000-4000-8000-000000000002",user_id:users[0].id,title:"MINT"},
          {id:"10000000-0000-4000-8000-000000000003",user_id:users[0].id,title:"Sonstige"}
        ],
        voka_subjects: [
          {id:"20000000-0000-4000-8000-000000000001",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000001",title:"Englisch",emoji:"🇬🇧"},
          {id:"20000000-0000-4000-8000-000000000003",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000001",title:"Französisch",emoji:"🇫🇷"},
          {id:"20000000-0000-4000-8000-000000000004",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000001",title:"Latein",emoji:"🏛️"},
          {id:"20000000-0000-4000-8000-000000000005",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000001",title:"Griechisch",emoji:"🇬🇷"},
          {id:"20000000-0000-4000-8000-000000000002",user_id:users[0].id,group_id:"10000000-0000-4000-8000-000000000002",title:"Mathe",emoji:"➗"}
        ],
        voka_lists: [
          {id:"30000000-0000-4000-8000-000000000001",user_id:users[0].id,subject_id:"20000000-0000-4000-8000-000000000001",title:"Irregular Verbs",tags:["Verben","Unit 3"],question_label:"Infinitiv",answer_label:"Englisch",learn_both_directions:true,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"}
        ],
        voka_cards: [
          {id:"40000000-0000-4000-8000-000000000001",user_id:users[0].id,list_id:"30000000-0000-4000-8000-000000000001",question:"go",answer:"went",marked:true,success_count:0,position:0,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
          {id:"40000000-0000-4000-8000-000000000002",user_id:users[0].id,list_id:"30000000-0000-4000-8000-000000000001",question:"be",answer:"was/were",marked:false,success_count:3,position:0,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"},
          {id:"40000000-0000-4000-8000-000000000003",user_id:users[0].id,list_id:"30000000-0000-4000-8000-000000000001",question:"choose",answer:"chose",marked:false,success_count:1,position:0,created_at:"2026-11-12T09:00:00Z",updated_at:"2026-11-12T09:00:00Z"}
        ],
        voka_list_usage: []
      };
      await route.fulfill(json(sampleData ? fixtures[path.split("/").pop() || ""] || [] : []));
      return;
    }
    if (path.startsWith("/rest/v1/voka_") && ["POST","PATCH","DELETE"].includes(method)) {
      await route.fulfill(json(null, 204));
      return;
    }

    await route.fulfill(json({ error: "Unsupported mock endpoint: " + method + " " + path }, 404));
  });
});

After(async function (this: VokaWorld) {
  await this.context?.close();
  await this.browser?.close();
});
