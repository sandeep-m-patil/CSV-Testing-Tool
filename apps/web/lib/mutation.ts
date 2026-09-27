import { toast } from "sonner";

export function extractError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: string }).message);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong";
}

export function okToast(message: string): void {
  toast.success(message);
}

export function errorToast(error: unknown): void {
  toast.error(extractError(error));
}