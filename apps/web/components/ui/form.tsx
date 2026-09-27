"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type Resolver, type SubmitHandler } from "react-hook-form";
import { type ZodType } from "zod";
import { cn } from "@/lib/utils";

export interface FormFieldErrorProps {
  error?: { message?: string };
  touched?: boolean;
  className?: string;
}

export function FormFieldError({ error, touched, className }: FormFieldErrorProps) {
  if (!error?.message || !touched) return null;
  return <p className={cn("mt-1 text-xs font-medium text-destructive", className)}>{error.message}</p>;
}

export function useZodForm<T extends FieldValues, TSchema extends ZodType>(
  schema: TSchema,
  options: { defaultValues?: DefaultValues<T>; disabled?: boolean },
) {
  return useForm<T>({
    resolver: zodResolver(schema) as Resolver<T>,
    defaultValues: options.defaultValues,
    mode: "onBlur",
  });
}

export type { SubmitHandler as FormSubmitHandler };