import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app.js";

let server: Server;
let baseUrl: string;

async function request(path: string, options: { method?: string; body?: string; cookie?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body) headers["content-type"] = "application/x-www-form-urlencoded";
  if (options.cookie) headers["cookie"] = options.cookie;
  return fetch(`${baseUrl}${path}`, { method: options.method ?? "GET", headers, body: options.body, redirect: "manual" });
}

beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address();
  if (typeof address === "object" && address) {
    baseUrl = `http://127.0.0.1:${address.port}`;
  } else {
    throw new Error("Server did not bind a port");
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Pharma LIMS demo app", () => {
  it("redirects the root to the login page", async () => {
    const response = await request("/");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("renders the login form with email, password and sign-in button", async () => {
    const response = await request("/login");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(`type="email"`);
    expect(html).toContain(`type="password"`);
    expect(html).toContain(">Sign in</button>");
  });

  it("accepts any credentials and reaches the dashboard", async () => {
    const login = await request("/login", {
      method: "POST",
      body: "email=creator@test.com&password=demo1234",
    });
    expect(login.status).toBe(303);
    expect(login.headers.get("location")).toBe("/dashboard");

    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    const dashboard = await request("/dashboard", { cookie });
    const html = await dashboard.text();
    expect(dashboard.status).toBe(200);
    expect(html).toContain("<h1>Dashboard</h1>");
    expect(html).toContain('href="/materials"');
  });

  it("creates a material and shows it in the materials list", async () => {
    const cookie = "demo_session=creator%40test.com";
    const created = await request("/materials", {
      method: "POST",
      cookie,
      body: "material_name=Acetone&material_code=MAT-001&department=QC&material_type=Chemical",
    });
    expect(created.status).toBe(303);
    expect(created.headers.get("location")).toBe("/materials/MAT-004");

    const list = await request("/materials", { cookie });
    const html = await list.text();
    expect(html).toContain("<h1>Materials</h1>");
    expect(html).toContain("MAT-001");
  });
});