import { ApplicationDetailWorkspace } from "@/components/dashboard/applications/detail-workspace";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationDetailWorkspace id={id} />;
}
