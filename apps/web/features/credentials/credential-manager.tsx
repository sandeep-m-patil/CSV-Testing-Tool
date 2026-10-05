"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast } from "@/lib/mutation";
import type { Credential } from "@repo/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export interface CredentialRow {
  id: string;
  moduleId: string;
  role: string;
  username: string;
  hasSecret: boolean;
}

export function CredentialManager({ moduleId, initial }: { moduleId: string; initial?: CredentialRow[] }) {
  const credentialsList = initial;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          Credentials
        </CardTitle>
        <CardDescription>
          Encrypted login credentials per role. Secrets are AES-256-GCM encrypted, never stored or exposed in plaintext,
          and never appear in logs, screenshots, or traces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!credentialsList && <Skeleton className="h-20 rounded-lg" />}
        {credentialsList && credentialsList.length === 0 && (
          <p className="text-sm text-muted-foreground">No credentials configured. Add the role used to reach this module.</p>
        )}
        {credentialsList?.map((credential) => (
          <CredentialRowView key={credential.id} credential={credential} moduleId={moduleId} />
        ))}
        <AddCredentialForm moduleId={moduleId} />
      </CardContent>
    </Card>
  );
}

function CredentialRowView({ credential, moduleId }: { credential: CredentialRow; moduleId: string }) {
  const queryClient = useQueryClient();

  async function remove() {
    if (!confirm(`Remove credential for ${credential.role}?`)) return;
    try {
      await apiFetch(`/api/modules/${moduleId}/credentials/${credential.id}`, { method: "DELETE" });
      toast.success("Credential removed");
      await queryClient.invalidateQueries({ queryKey: queryKeys.moduleWithRelations(moduleId) });
    } catch (error) {
      errorToast(error);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{credential.role}</p>
          <Badge variant="muted">role</Badge>
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground">{credential.username}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="success" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {credential.hasSecret ? "secret set" : "no secret"}
        </Badge>
        <Button variant="ghost" size="icon" aria-label={`Delete ${credential.role}`} onClick={() => void remove()}>
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

function AddCredentialForm({ moduleId }: { moduleId: string }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!role || !username || !password) return;
    setSubmitting(true);
    try {
      await apiFetch<{ credential: Credential }>(`/api/modules/${moduleId}/credentials`, {
        method: "POST",
        body: JSON.stringify({ role, username, password }),
      });
      toast.success("Credential saved (encrypted)");
      setRole("");
      setUsername("");
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.moduleWithRelations(moduleId) });
    } catch (error) {
      errorToast(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-dashed p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`cred-role-${moduleId}`} className="text-xs">
            Role
          </Label>
          <Input
            id={`cred-role-${moduleId}`}
            data-testid="credential-role"
            placeholder="Material Creator"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cred-user-${moduleId}`} className="text-xs">
            Username / email
          </Label>
          <Input
            id={`cred-user-${moduleId}`}
            data-testid="credential-username"
            placeholder="creator@test.com"
            autoComplete="off"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cred-pass-${moduleId}`} className="text-xs">
            Password
          </Label>
          <Input
            id={`cred-pass-${moduleId}`}
            data-testid="credential-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting}>
          <Plus className="h-4 w-4" />
          {submitting ? "Saving…" : "Add credential"}
        </Button>
      </div>
    </form>
  );
}