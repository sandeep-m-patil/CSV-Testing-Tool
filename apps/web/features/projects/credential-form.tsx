"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Environment, ProjectRole } from "@repo/schemas";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CredentialFormProps {
  projectId: string;
  roles: ProjectRole[];
  environments: Environment[];
  onSaved: () => Promise<void>;
}

const EMPTY = { name: "", role: "", username: "", password: "", environmentId: "", variables: "" };

/**
 * Parses `key=value` lines into non-secret credential variables. Secrets do not
 * belong here: variables are stored and displayed in plaintext.
 */
export function parseVariables(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    out[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return out;
}

export function CredentialForm({ projectId, roles, environments, onSaved }: CredentialFormProps) {
  const [form, setForm] = useState(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await apiFetch(`/api/projects/${projectId}/credentials`, {
        method: "POST",
        body: JSON.stringify({
          name: form.name || form.role,
          role: form.role,
          username: form.username,
          password: form.password,
          environmentId: form.environmentId || null,
          variables: parseVariables(form.variables),
        }),
      });
      toast.success("Credential saved (encrypted)");
      setForm(EMPTY);
      await onSaved();
    } catch (error) {
      errorToast(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">New credential</p>
        <p className="text-xs text-muted-foreground">The password is encrypted on save and can never be read back.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="cred-role" label="Role">
          <Input id="cred-role" list="project-role-options" placeholder="LAB_ANALYST" value={form.role} onChange={set("role")} required />
          <datalist id="project-role-options">
            {roles.map((role) => (
              <option key={role.id} value={role.name} />
            ))}
          </datalist>
        </Field>
        <Field id="cred-name" label="Name (optional)">
          <Input id="cred-name" placeholder="Analyst — QA" value={form.name} onChange={set("name")} />
        </Field>
        <Field id="cred-user" label="Username / email">
          <Input id="cred-user" autoComplete="off" value={form.username} onChange={set("username")} required />
        </Field>
        <Field id="cred-pass" label="Password">
          <Input id="cred-pass" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
        </Field>
        <Field id="cred-env" label="Environment">
          <Select id="cred-env" value={form.environmentId} onChange={set("environmentId")}>
            <option value="">Any environment</option>
            {environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="cred-vars" label="Variables (key=value per line, not secret)">
          <Textarea id="cred-vars" rows={2} className="min-h-[60px] font-mono text-xs" placeholder={"lab_id=LAB-01"} value={form.variables} onChange={set("variables")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          <Plus className="h-4 w-4" />
          {isSubmitting ? "Saving…" : "Add credential"}
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
