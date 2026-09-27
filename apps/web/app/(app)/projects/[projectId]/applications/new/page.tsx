import Link from "next/link";
import { ApplicationForm } from "@/features/applications/application-form";

export default async function NewApplicationPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to project
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Add application</h1>
      </div>
      <ApplicationForm projectId={projectId} />
    </div>
  );
}