export interface SavedAnswer {
  id: string;
  questionCategory: string;
  answer: string;
  version: number;
  allowedContexts: string[];
  reviewedAt?: string;
}
export function adaptSavedAnswer(answer: SavedAnswer, context: string): SavedAnswer {
  if (!answer.allowedContexts.includes(context))
    throw new Error("SAVED_ANSWER_CONTEXT_NOT_ALLOWED");
  return {
    ...answer,
    answer: answer.answer.replace(/\b(?:the company|this company)\b/gi, context),
    version: answer.version + 1
  };
}
