import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const TAB_SKELETONS = [0, 1, 2, 3, 4, 5];

/** Loading placeholder shaped like a module workspace: header, tab bar and a content block. */
export function ModulePageSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="Loading module">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-64 max-w-full" />
      </div>
      <div className="flex gap-3 overflow-hidden border-b pb-3">
        {TAB_SKELETONS.map((index) => (
          <Skeleton key={index} className="h-5 w-24 shrink-0" />
        ))}
      </div>
      {children ?? <Skeleton className="h-72 rounded-xl" />}
    </div>
  );
}

/** Shown when a module id does not resolve (deleted, or no access). */
export function ModuleNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <EmptyState
        icon={<SearchX />}
        title="Module not found"
        description="It may have been deleted or you don't have access to it."
        action={
          <Link href="/modules" className={buttonVariants({ variant: "outline" })}>
            Back to modules
          </Link>
        }
      />
    </div>
  );
}
