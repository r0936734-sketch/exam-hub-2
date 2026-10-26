export type McqQuestion = {
  id: string;
  topicId: string;
  topicTitle: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subtopic?: string;
  style?: string;
};

export function getCorrectOptionDistribution(questions: McqQuestion[]) {
  return questions.reduce<Record<string, number>>((distribution, question) => {
    const label = String.fromCharCode(65 + question.correctIndex);
    distribution[label] = (distribution[label] || 0) + 1;
    return distribution;
  }, {});
}
