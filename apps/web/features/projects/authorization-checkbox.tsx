import { ShieldCheck } from "lucide-react";
import { siteKey } from "@repo/schemas";
import { Checkbox } from "@/components/ui/checkbox";

interface AuthorizationCheckboxProps {
  url: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * The user's attestation that they may test a site. Discovery and runs drive a
 * real browser against it, so nothing starts until this is ticked.
 */
export function AuthorizationCheckbox({ url, checked, onChange }: AuthorizationCheckboxProps) {
  const site = siteKey(url) ?? "this website";
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <Checkbox
        className="mt-0.5"
        data-testid="authorization-confirmed"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex-1">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Authorization to test
        </span>
        <span className="mt-0.5 block text-muted-foreground">
          I confirm I am authorized to run automated discovery and tests against{" "}
          <span className="font-mono text-foreground">{site}</span>.
        </span>
      </span>
    </label>
  );
}
