import { FreelanceDetail } from "@/components/dashboard/freelance/detail";

export default async function FreelanceOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FreelanceDetail opportunityId={id} />;
}
