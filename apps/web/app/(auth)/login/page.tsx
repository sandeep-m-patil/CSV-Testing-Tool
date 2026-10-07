"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LoginInputSchema, type LoginInput } from "@repo/schemas";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { errorToast } from "@/lib/mutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormFieldError } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthHeading } from "../auth-heading";

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/projects";
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
      toast.success("Welcome back");
      router.replace(next);
    } catch (error) {
      errorToast(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading title="Sign in" description="Welcome back. Sign in to continue testing your applications." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="h-10"
            {...register("email")}
          />
          <FormFieldError error={formState.errors.email} touched={formState.touchedFields.email} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-10"
            {...register("password")}
          />
          <FormFieldError error={formState.errors.password} touched={formState.touchedFields.password} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
