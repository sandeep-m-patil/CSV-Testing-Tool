export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface LayoutOptions {
  title: string;
  active: string;
  userEmail: string | null;
  body: string;
}

export function layout(options: LayoutOptions): string {
  const { title, active, userEmail, body } = options;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — Pharma LIMS</title>
<style>
  :root {
    --bg: #f5f7fa;
    --panel: #ffffff;
    --ink: #1f2933;
    --muted: #6b7280;
    --line: #e5e7eb;
    --brand: #2563eb;
    --brand-dark: #1d4ed8;
    --ok: #059669;
    --warn: #d97706;
    --bad: #dc2626;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--ink);
  }
  .topbar {
    background: var(--ink);
    color: #fff;
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .topbar .brand { font-weight: 700; letter-spacing: 0.02em; }
  .topbar .who { font-size: 13px; color: #c7ced6; }
  nav.tabs {
    display: flex;
    gap: 2px;
    background: var(--ink);
    padding: 0 8px 0 24px;
  }
  nav.tabs a {
    color: #c7ced6;
    text-decoration: none;
    font-size: 14px;
    padding: 8px 14px;
    border-radius: 6px 6px 0 0;
  }
  nav.tabs a:hover { color: #fff; background: #2f3845; }
  nav.tabs a.active { color: #fff; background: var(--bg); }
  main { max-width: 960px; margin: 24px auto; padding: 0 16px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 20px 24px; }
  h1 { margin: 0 0 16px; font-size: 22px; }
  h2 { font-size: 16px; margin: 20px 0 8px; }
  .flash { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; font-size: 13px; }
  tr:last-child td { border-bottom: none; }
  label { display: block; font-size: 13px; font-weight: 600; color: var(--muted); margin: 14px 0 4px; }
  input[type="text"], input[type="email"], input[type="password"], select, textarea {
    width: 100%;
    max-width: 520px;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
  }
  textarea { min-height: 84px; resize: vertical; }
  button, .btn {
    display: inline-block;
    background: var(--brand);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    padding: 10px 18px;
    cursor: pointer;
    text-decoration: none;
  }
  button:hover, .btn:hover { background: var(--brand-dark); }
  button.ghost { background: transparent; border: 1px solid #d1d5db; color: var(--ink); }
  button.ghost:hover { background: #f3f4f6; }
  button.warn { background: var(--warn); }
  button.warn:hover { background: #b45309; }
  button.danger { background: var(--bad); }
  button.danger:hover { background: #b91c1c; }
  button.ok { background: var(--ok); }
  button.ok:hover { background: #047857; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin: 16px 0; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }
  .card .num { font-size: 28px; font-weight: 700; }
  .card .lbl { color: var(--muted); font-size: 13px; }
  .card a { display: block; margin-top: 10px; font-size: 14px; font-weight: 600; color: var(--brand); text-decoration: none; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .badge.ok { background: #d1fae5; color: #065f46; }
  .badge.warn { background: #fef3c7; color: #92400e; }
  .badge.bad { background: #fee2e2; color: #991b1b; }
  .badge.muted { background: #e5e7eb; color: #374151; }
  .muted { color: var(--muted); font-size: 13px; }
  .actions { display: flex; gap: 8px; margin-top: 18px; }
  .auth-card { max-width: 380px; margin: 10vh auto; text-align: center; }
  .auth-card .panel { text-align: left; }
  .auth-card h1 { text-align: center; }
  .foot { text-align: center; color: var(--muted); font-size: 12px; margin: 32px 0 16px; }
  .link-row a { color: var(--brand); font-weight: 600; text-decoration: none; margin-right: 12px; font-size: 14px; }
</style>
</head>
<body>
<header>
  <div class="topbar">
    <span class="brand">Pharma LIMS</span>
    <span class="who">${userEmail ? esc(userEmail) : "Signed out"}</span>
  </div>
  <nav class="tabs" aria-label="Primary navigation">
    ${tabLink("/dashboard", "Dashboard", active)}
    ${tabLink("/materials", "Materials", active)}
    ${tabLink("/materials/new", "Create material", active)}
    ${tabLink("/review", "Review", active)}
    ${tabLink("/approvals", "Approvals", active)}
    ${tabLink("/reports", "Reports", active)}
  </nav>
</header>
<main>
${body}
<p class="foot">Autonomous QA demo environment — seed data only. No data leaves this instance.</p>
</main>
</body>
</html>`;
}

function tabLink(href: string, label: string, active: string): string {
  const isActive = active === href ? " active" : "";
  return `<a href="${href}"${isActive} data-testid="nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${label}</a>`;
}

export function statusBadge(status: string): string {
  const map: Record<string, string> = {
    Draft: "muted",
    Submitted: "warn",
    Ready: "warn",
    Approved: "ok",
    Rejected: "bad",
  };
  const tone = map[status] ?? "muted";
  return `<span class="badge ${tone}">${esc(status)}</span>`;
}