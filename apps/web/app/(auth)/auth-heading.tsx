import { FlaskConical } from "lucide-react";

/** Title block above the auth forms; shows the product mark on phones where the brand panel is hidden. */
export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8 space-y-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-brand-foreground lg:hidden">
        <FlaskConical className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
