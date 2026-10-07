"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SignupInputSchema, type SignupInput } from "@repo/schemas";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormFieldError } from "@/components/ui/form";
import { AuthHeading } from "../auth-heading";

export default function SignupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState } = useForm<SignupInput>({
    resolver: zodResolver(SignupInputSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupInput) {
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify(values) });
      toast.success("Account created");
      router.replace("/projects");
    } catch (error) {
      errorToast(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading
        title="Create your account"
        description="Start discovering and generating tests for your applications."
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" placeholder="Ada Lovelace" className="h-10" {...register("name")} />
          <FormFieldError error={formState.errors.name} touched={formState.touchedFields.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" className="h-10" {...register("email")} />
          <FormFieldError error={formState.errors.email} touched={formState.touchedFields.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="h-10"
            {...register("password")}
          />
          <FormFieldError error={formState.errors.password} touched={formState.touchedFields.password} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
