export interface StarStory {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  evidenceIds: string[];
}
export function rankStories(question: string, stories: readonly StarStory[]): StarStory[] {
  const terms = question.toLowerCase().split(/\W+/);
  return [...stories].sort((a, b) => score(b) - score(a));
  function score(story: StarStory) {
    return terms.reduce(
      (sum, term) => sum + (JSON.stringify(story).toLowerCase().includes(term) ? 1 : 0),
      0
    );
  }
}
