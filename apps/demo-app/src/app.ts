import express, { type Request, type Response } from "express";
import {
  createMaterial,
  createReport,
  listMaterials,
  listReports,
  setMaterialStatus,
} from "./data.js";
import {
  createMaterialPage,
  dashboardPage,
  loginPage,
  materialDetailPage,
  materialsPage,
  notFoundPage,
  reportDetailPage,
  reportsPage,
  reviewQueuePage,
} from "./views/pages.js";

const COOKIE_NAME = "demo_session";

const PROTECTED_PREFIXES = ["/dashboard", "/materials", "/review", "/approvals", "/reports"];

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: false }));

  app.use((request, response, next) => {
    const pathname = request.path;
    if (pathname === "/login" || pathname === "/") return next();
    if (!PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return next();
    if (getCookie(request.headers.cookie, COOKIE_NAME)) return next();
    return redirectToLogin(response);
  });

  app.get("/", (_request, response) => redirectToLogin(response));
  app.get("/login", (_request, response) => {
    response.type("html").send(loginPage());
  });

  app.post("/login", (request, response) => {
    const email = safeText(request.body.email) || "user@lab.com";
    response
      .setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax`,
      )
      .redirect(303, "/dashboard");
  });

  app.get("/dashboard", (request, response) => {
    response.type("html").send(dashboardPage(sessionEmail(request)));
  });

  app.get("/materials", (request, response) => {
    response.type("html").send(materialsPage(sessionEmail(request)));
  });

  app.get("/materials/new", (request, response) => {
    response.type("html").send(createMaterialPage(sessionEmail(request)));
  });

  app.post("/materials", (request, response) => {
    const name = safeText(request.body.material_name);
    const department = safeText(request.body.department);
    const type = safeText(request.body.material_type) || "Chemical";
    const description = safeText(request.body.description) || "";
    const storageCondition = safeText(request.body.storage_condition) || "Ambient";

    if (!name || !department) {
      response.type("html").status(400).send(createMaterialPage(sessionEmail(request)));
      return;
    }

    const material = createMaterial({ name, department, type, description, storageCondition });
    response.redirect(303, `/materials/${material.code}`);
  });

  app.get("/materials/:code", (request, response) => {
    const code = request.params.code ?? "";
    response.type("html").send(materialDetailPage(code, sessionEmail(request)));
  });

  app.post("/materials/:code/submit", (request, response) => {
    const code = request.params.code ?? "";
    setMaterialStatus(code, "Submitted");
    response.redirect(303, `/materials/${code}?flash=${encodeURIComponent("Submitted for review.")}`);
  });

  app.post("/materials/:code/approve", (request, response) => {
    const code = request.params.code ?? "";
    const current = listMaterials().find((material) => material.code.toLowerCase() === code.toLowerCase());
    const nextStatus = current?.status === "Submitted" ? "Ready" : "Approved";
    setMaterialStatus(code, nextStatus);
    const message = nextStatus === "Ready" ? "Passed QC review — ready for approval." : "Approved.";
    response.redirect(303, `/materials/${code}?flash=${encodeURIComponent(message)}`);
  });

  app.post("/materials/:code/reject", (request, response) => {
    const code = request.params.code ?? "";
    setMaterialStatus(code, "Rejected");
    response.redirect(303, `/materials/${code}?flash=${encodeURIComponent("Rejected.")}`);
  });

  app.get("/review", (request, response) => {
    response.type("html").send(reviewQueuePage("review", sessionEmail(request)));
  });

  app.get("/approvals", (request, response) => {
    response.type("html").send(reviewQueuePage("approval", sessionEmail(request)));
  });

  app.get("/reports", (request, response) => {
    response.type("html").send(reportsPage(sessionEmail(request)));
  });

  app.post("/reports/generate", (_request, response) => {
    const first = listMaterials()[0]?.code ?? "MAT-001";
    const report = createReport(first, 12);
    response.redirect(303, `/reports/${report.id}`);
  });

  app.get("/reports/:id", (request, response) => {
    const id = request.params.id ?? "";
    response.type("html").send(reportDetailPage(id, sessionEmail(request)));
  });

  app.use((_: Request, response: Response) => {
    response.type("html").status(404).send(notFoundPage());
  });

  return app;
}

function sessionEmail(request: Request): string | null {
  const raw = getCookie(request.headers.cookie, COOKIE_NAME);
  return raw ? decodeURIComponent(raw) : null;
}

function getCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name && rest.length > 0) return rest.join("=");
  }
  return null;
}

function redirectToLogin(response: Response): void {
  response.redirect(302, "/login");
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}