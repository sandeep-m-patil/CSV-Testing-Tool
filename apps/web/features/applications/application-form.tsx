"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CreateApplicationInputSchema, type CreateApplicationInput } from "@repo/schemas";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormFieldError } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";

export function ApplicationForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields },
  } = useForm<CreateApplicationInput>({
    resolver: zodResolver(CreateApplicationInputSchema),
    defaultValues: {
      projectId,
      name: "",
      baseUrl: "https://",
      description: "",
      environment: "qa",
      productionConfirmed: false,
    },
  });

  const environment = watch("environment");

  async function onSubmit(values: CreateApplicationInput) {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ application: { id: string } }>("/api/applications", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Application added");
      await queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      router.push(`/projects/${projectId}/applications/${data.application.id}`);
    } catch (error) {
      errorToast(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Application details</CardTitle>
        <CardDescription>Point us at the web app you want to discover and test.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="app-name">Name</Label>
              <Input id="app-name" placeholder="Pharma LIMS" {...register("name")} />
              <FormFieldError error={errors.name} touched={touchedFields.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-base-url">Base URL</Label>
              <Input id="app-base-url" type="url" placeholder="https://lims.example.com" {...register("baseUrl")} />
              <FormFieldError error={errors.baseUrl} touched={touchedFields.baseUrl} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-description">Description</Label>
            <Textarea id="app-description" placeholder="What is this application?" {...register("description")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-environment">Environment</Label>
            <Select id="app-environment" {...register("environment")}>
              {(["development", "qa", "staging", "production", "custom"] as const).map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </Select>
          </div>

          {environment === "production" && (
            <Alert variant="warning">
              <AlertTitle>Production environment</AlertTitle>
              <AlertDescription>
                Autonomous discovery and testing are disabled by default against production. You must confirm this is an
                explicitly approved testing target. If you only intend to prepare configuration, leave this off.
              </AlertDescription>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" {...register("productionConfirmed")} />
                I explicitly authorise automated discovery against this production application.
              </label>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Add application"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}