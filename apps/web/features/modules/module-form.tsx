"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { CreateModuleInputSchema, type CreateModuleInput } from "@repo/schemas";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";

const MAX_INCLUDE_PATHS = 25;

/** "materials, /materials/new" -> ["/materials", "/materials/new"] (validated by the API schema). */
function parsePathList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => (part.startsWith("/") ? part : `/${part}`))
    .slice(0, MAX_INCLUDE_PATHS);
}

export function ModuleForm({ projectId, onDone }: { projectId: string; onDone?: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [includePathsText, setIncludePathsText] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, touchedFields },
  } = useForm<CreateModuleInput>({
    resolver: zodResolver(CreateModuleInputSchema),
    defaultValues: { projectId, name: "", description: "", includePaths: [] },
  });

  const startPathField = register("startPath");

  async function onSubmit(values: CreateModuleInput) {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ module: { id: string } }>(`/api/projects/${projectId}/modules`, {
        method: "POST",
        body: JSON.stringify({
          ...values,
          includePaths: parsePathList(includePathsText),
        }),
      });
      toast.success("Module added");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.modules(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.modulesHub }),
      ]);
      if (onDone) {
        onDone();
      } else {
        router.push(`/modules/${data.module.id}`);
      }
    } catch (error) {
      errorToast(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Module details</CardTitle>
        <CardDescription>Modules are the areas of the project you want to test — e.g. Login, Checkout, Material Review.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-name">Name</Label>
            <Input id="module-name" placeholder="Material Management" {...register("name")} />
            <FormFieldError error={errors.name} touched={touchedFields.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-description">Description</Label>
            <Textarea id="module-description" placeholder="Create and manage laboratory materials…" {...register("description")} />
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
            <div className="space-y-2">
              <Label htmlFor="module-start-path">Start path</Label>
              <Input
                id="module-start-path"
                placeholder="/materials"
                {...startPathField}
                onChange={(event) => {
                  startPathField.onChange(event);
                  const value = event.target.value.trim();
                  if (value !== "" && !value.startsWith("/")) {
                    setValue("startPath", `/${value}`, { shouldValidate: true });
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Discovery starts here and never leaves these paths. Leave empty to start at the project base URL.
              </p>
              <FormFieldError error={errors.startPath} touched={touchedFields.startPath} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module-include-paths">Extra in-scope paths</Label>
              <Input
                id="module-include-paths"
                placeholder="/materials, /materials/new"
                value={includePathsText}
                onChange={(event) => setIncludePathsText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Links to anything else (other modules) are listed as skipped, never crawled.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {!onDone && (
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Add module"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}