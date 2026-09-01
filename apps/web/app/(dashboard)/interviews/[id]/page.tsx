import { InterviewDetail } from "@/components/dashboard/interview-detail";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InterviewDetail id={id} />;
}
