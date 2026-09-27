import { esc, layout, statusBadge } from "./layout.js";
import type { Material } from "../data.js";
import { getMaterial, getReport, listMaterials, listMaterialsByStatus, listReports } from "../data.js";

export function loginPage(): string {
  const body = `
<div class="auth-card">
  <div class="panel">
    <h1>Sign in to Pharma LIMS</h1>
    <p class="muted">Use your laboratory account to access materials, QC review and reports.</p>
    <form method="post" action="/login">
      <label for="login-email">Email address</label>
      <input id="login-email" name="email" type="email" autocomplete="username"
             data-testid="login-email" placeholder="name@lab.com" required />
      <label for="login-password">Password</label>
      <input id="login-password" name="password" type="password" autocomplete="current-password"
             data-testid="login-password" placeholder="Password" required />
      <div class="actions">
        <button type="submit" data-testid="login-submit">Sign in</button>
      </div>
    </form>
  </div>
</div>`;
  return layout({ title: "Sign in", active: "", userEmail: null, body });
}

export function dashboardPage(userEmail: string | null): string {
  const materials = listMaterials();
  const submitted = listMaterialsByStatus("Submitted").length;
  const approved = listMaterialsByStatus("Approved").length;
  const reports = listReports().length;

  const body = `
<div class="panel">
  <h1>Dashboard</h1>
  <p class="muted">Overview of laboratory quality activities.</p>
  <div class="cards">
    <div class="card">
      <div class="num">${materials.length}</div>
      <div class="lbl">Materials</div>
      <a href="/materials" data-testid="dashboard-materials">Browse materials</a>
    </div>
    <div class="card">
      <div class="num">${submitted}</div>
      <div class="lbl">Awaiting review</div>
      <a href="/review" data-testid="dashboard-review">Open review queue</a>
    </div>
    <div class="card">
      <div class="num">${approved}</div>
      <div class="lbl">Approved</div>
      <a href="/approvals" data-testid="dashboard-approvals">Manage approvals</a>
    </div>
    <div class="card">
      <div class="num">${reports}</div>
      <div class="lbl">Reports available</div>
      <a href="/reports" data-testid="dashboard-reports">View reports</a>
    </div>
  </div>
  <div class="link-row">
    <a href="/materials/new" data-testid="dashboard-create">Create new material</a>
  </div>
</div>`;
  return layout({ title: "Dashboard", active: "/dashboard", userEmail, body });
}

export function materialsPage(userEmail: string | null): string {
  const table = materialsTable(listMaterials());
  const body = `
<div class="panel">
  <h1>Materials</h1>
  <p class="muted">Master data of all registered materials.</p>
  <div class="link-row">
    <a href="/materials/new" data-testid="list-create">Create material</a>
  </div>
  ${table}
</div>`;
  return layout({ title: "Materials", active: "/materials", userEmail, body });
}

export function createMaterialPage(userEmail: string | null): string {
  const body = `
<div class="panel">
  <h1>Create material</h1>
  <p class="muted">Register a new material in the laboratory system.</p>
  <form method="post" action="/materials">
    <label for="material_name">Material name</label>
    <input id="material_name" name="material_name" data-testid="material_name" placeholder="material_name" required />
    <label for="material_code">Material code</label>
    <input id="material_code" name="material_code" data-testid="material_code" placeholder="material_code" required />
    <label for="department">Department</label>
    <input id="department" name="department" data-testid="department" placeholder="department" required />
    <label for="material_type">Material type</label>
    <input id="material_type" name="material_type" data-testid="material_type" placeholder="material_type" required />
    <label for="storage_condition">Storage condition</label>
    <select id="storage_condition" name="storage_condition" data-testid="storage_condition">
      <option value="Ambient">Ambient</option>
      <option value="Refrigerated">Refrigerated</option>
      <option value="Flammable cabinet">Flammable cabinet</option>
      <option value="Cold room">Cold room</option>
    </select>
    <label for="description">Description</label>
    <textarea id="description" name="description" data-testid="description" placeholder="description"></textarea>
    <div class="actions">
      <button type="submit" data-testid="create-submit">Create</button>
      <a class="btn ghost" href="/materials" data-testid="create-cancel">Cancel</a>
    </div>
  </form>
</div>`;
  return layout({ title: "Create material", active: "/materials/new", userEmail, body });
}

export function materialDetailPage(code: string, userEmail: string | null, flash: string | null = null): string {
  const material = getMaterial(code);
  if (!material) return notFoundPage();
  const toast = flash ? `<div class="flash" data-testid="flash">${esc(flash)}</div>` : "";

  const submitForm =
    material.status === "Draft"
      ? `<form method="post" action="/materials/${esc(material.code)}/submit">
           <button type="submit" data-testid="detail-submit">Submit for review</button>
         </form>`
      : "";

  const body = `
<div class="panel">
  <h1>Material — ${esc(material.code)}</h1>
  ${toast}
  <table>
    <tr><th>Name</th><td>${esc(material.name)}</td></tr>
    <tr><th>Code</th><td>${esc(material.code)}</td></tr>
    <tr><th>Department</th><td>${esc(material.department)}</td></tr>
    <tr><th>Type</th><td>${esc(material.type)}</td></tr>
    <tr><th>Storage condition</th><td>${esc(material.storageCondition)}</td></tr>
    <tr><th>Description</th><td>${esc(material.description)}</td></tr>
    <tr><th>Status</th><td>${statusBadge(material.status)}</td></tr>
  </table>
  <div class="actions">
    ${submitForm}
    <a class="btn ghost" href="/materials" data-testid="detail-back">Back to materials</a>
  </div>
</div>`;
  return layout({ title: `Material ${material.code}`, active: "/materials", userEmail, body });
}

export function reviewQueuePage(kind: "review" | "approval", userEmail: string | null): string {
  const title = kind === "review" ? "Material Review" : "Material Approval";
  const targetStatus = kind === "review" ? "Submitted" : "Ready";
  const items = listMaterialsByStatus(targetStatus);
  const action = "approve";

  const rows =
    items.length === 0
      ? `<tr><td colspan="5" class="muted">No materials in the queue.</td></tr>`
      : items
          .map(
            (material) => `
  <tr>
    <td><a href="/materials/${esc(material.code)}" data-testid="queue-link-${esc(material.code)}">${esc(material.name)}</a></td>
    <td>${esc(material.code)}</td>
    <td>${esc(material.department)}</td>
    <td>${statusBadge(material.status)}</td>
    <td>
      <form method="post" action="/materials/${esc(material.code)}/${action}" style="display:inline">
        <button type="submit" class="ok" data-testid="queue-${esc(material.code)}-approve">Approve</button>
      </form>
      <form method="post" action="/materials/${esc(material.code)}/reject" style="display:inline">
        <button type="submit" class="danger" data-testid="queue-${esc(material.code)}-reject">Reject</button>
      </form>
    </td>
  </tr>`,
          )
          .join("\n");

  const body = `
<div class="panel">
  <h1>${title}</h1>
  <p class="muted">Materials ${kind === "review" ? "waiting for QC review" : "ready for final approval"}.</p>
  <table>
    <thead>
      <tr><th>Material</th><th>Code</th><th>Department</th><th>Status</th><th>Actions</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`;
  return layout({ title, active: kind === "review" ? "/review" : "/approvals", userEmail, body });
}

export function reportsPage(userEmail: string | null): string {
  const rows = listReports()
    .map(
      (report) => `
  <tr>
    <td><a href="/reports/${esc(report.id)}" data-testid="report-${esc(report.id)}">${esc(report.id)}</a></td>
    <td>${esc(report.materialCode)}</td>
    <td>${esc(report.createdBy)}</td>
    <td>${report.rows}</td>
    <td>${esc(report.createdAt)}</td>
  </tr>`,
    )
    .join("\n");

  const body = `
<div class="panel">
  <h1>Reports</h1>
  <p class="muted">Generated quality control reports.</p>
  <form method="post" action="/reports/generate">
    <button type="submit" class="ok" data-testid="reports-generate">Generate</button>
  </form>
  <table>
    <thead>
      <tr><th>Report</th><th>Material</th><th>Created by</th><th>Rows</th><th>Date</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`;
  return layout({ title: "Reports", active: "/reports", userEmail, body });
}

export function reportDetailPage(id: string, userEmail: string | null): string {
  const report = getReport(id);
  if (!report) return notFoundPage();
  const material = getMaterial(report.materialCode);

  const body = `
<div class="panel">
  <h1>Report — ${esc(report.id)}</h1>
  <table>
    <tr><th>Report ID</th><td>${esc(report.id)}</td></tr>
    <tr><th>Material</th><td>${material ? esc(material.name) : esc(report.materialCode)}</td></tr>
    <tr><th>Created by</th><td>${esc(report.createdBy)}</td></tr>
    <tr><th>Rows sampled</th><td>${report.rows}</td></tr>
    <tr><th>Date</th><td>${esc(report.createdAt)}</td></tr>
  </table>
  <div class="actions">
    <a class="btn ghost" href="/reports" data-testid="report-back">Back to reports</a>
  </div>
</div>`;
  return layout({ title: `Report ${report.id}`, active: "/reports", userEmail, body });
}

export function notFoundPage(): string {
  const body = `
<div class="panel">
  <h1>Not found</h1>
  <p class="muted">The page you requested does not exist.</p>
  <div class="actions">
    <a class="btn" href="/dashboard" data-testid="notfound-home">Go to dashboard</a>
  </div>
</div>`;
  return layout({ title: "Not found", active: "", userEmail: null, body });
}

function materialsTable(materials: Material[]): string {
  const rows = materials
    .map(
      (material) => `
  <tr>
    <td><a href="/materials/${esc(material.code)}" data-testid="row-${esc(material.code)}">${esc(material.name)}</a></td>
    <td>${esc(material.code)}</td>
    <td>${esc(material.department)}</td>
    <td>${esc(material.type)}</td>
    <td>${statusBadge(material.status)}</td>
  </tr>`,
    )
    .join("\n");

  return `
  <table>
    <thead>
      <tr><th>Material</th><th>Code</th><th>Department</th><th>Type</th><th>Status</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>`;
}

export { listMaterials };