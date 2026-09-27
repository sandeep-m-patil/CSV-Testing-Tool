"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CreateProjectInputSchema, type CreateProjectInput } from "@repo/schemas";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { errorToast } from "@/lib/mutation";
import { titleCase } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";

const ENVIRONMENTS: CreateProjectInput["environment"][] = [
  "development",
  "qa",
  "staging",
  "production",
  "custom",
];

export function CreateProjectButton() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const EMPTY = { name: "", baseUrl: "", description: "", environment: "development", productionConfirmed: false } as const;
  const [values, setValues] = useState<CreateProjectInput>({ ...EMPTY });
  const router = useRouter();
  const queryClient = useQueryClient();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = CreateProjectInputSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiFetch<{ project: { id: string } }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success("Project created");
      setOpen(false);
      setValues({ ...EMPTY });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      if (data.project?.id) router.push(`/projects/${data.project.id}`);
    } catch (error) {
      errorToast(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            A project is one web application you test. A &quot;Whole site&quot; module is created for you and
            discovery starts immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              data-testid="project-name"
              placeholder="Pharma LIMS"
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-base-url">Base URL</Label>
            <Input
              id="project-base-url"
              data-testid="project-base-url"
              type="url"
              placeholder="https://shop.example.com"
              value={values.baseUrl}
              onChange={(event) => setValues((prev) => ({ ...prev, baseUrl: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-environment">Environment</Label>
            <Select
              id="project-environment"
              data-testid="project-environment"
              value={values.environment}
              onChange={(event) => {
                const value = event.target.value as CreateProjectInput["environment"];
                setValues((prev) => ({
                  ...prev,
                  environment: value,
                  productionConfirmed: value === "production" ? prev.productionConfirmed : false,
                }));
              }}
            >
              {ENVIRONMENTS.map((environment) => (
                <option key={environment} value={environment}>
                  {titleCase(environment)}
                </option>
              ))}
            </Select>
          </div>
          {values.environment === "production" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={values.productionConfirmed}
                onChange={(event) => setValues((prev) => ({ ...prev, productionConfirmed: event.target.checked }))}
              />
              I explicitly authorise automated discovery against this production environment.
            </label>
          )}
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="What this project covers…"
              value={values.description}
              onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}