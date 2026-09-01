export interface MockInterview {
  id: string;
  stageId: string;
  status: "draft" | "completed";
  notes: string;
  feedback?: { strengths: string[]; gaps: string[] };
}
export function completeMock(
  session: MockInterview,
  feedback: NonNullable<MockInterview["feedback"]>
): MockInterview {
  return { ...session, status: "completed", feedback };
}
