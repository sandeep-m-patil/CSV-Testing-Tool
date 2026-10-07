import { FlaskConical, Radar, ShieldCheck, Workflow } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Radar, text: "Autonomous discovery of pages, forms and actions" },
  { icon: Workflow, text: "Workflows and test cases generated for review" },
  { icon: ShieldCheck, text: "Credentials encrypted and never shown in the browser" },
] as const;

/** Shared frame for sign-in and sign-up: brand panel on desktop, a single centered column on phones. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen bg-background lg:grid-cols-2">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--brand)/0.14),transparent_60%)]"
      />
      <aside className="relative hidden flex-col justify-between border-r bg-card/40 p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <FlaskConical className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight">Autotest</span>
        </div>
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Autonomous testing for the web applications you ship.
          </h2>
          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-card text-brand">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Projects → modules → discovery → test cases → runs → reports</p>
      </aside>
      <main className="relative flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
