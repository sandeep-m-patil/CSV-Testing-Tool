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

export function ModuleForm({ applicationId, onDone }: { applicationId: string; onDone?: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
  } = useForm<CreateModuleInput>({
    resolver: zodResolver(CreateModuleInputSchema),
    defaultValues: { applicationId, name: "", description: "" },
  });

  async function onSubmit(values: CreateModuleInput) {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ module: { id: string } }>(`/api/applications/${applicationId}/modules`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Module added");
      await queryClient.invalidateQueries({ queryKey: queryKeys.modules(applicationId) });
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
        <CardDescription>Modules are the areas of the application you want to test — e.g. Login, Checkout, Material Review.</CardDescription>
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