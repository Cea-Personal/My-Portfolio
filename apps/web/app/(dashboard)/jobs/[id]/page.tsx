import { JobsWorkspace } from "@/components/dashboard/jobs";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobsWorkspace initialJobId={id} />;
}
