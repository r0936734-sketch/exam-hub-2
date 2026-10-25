import { createServerFn } from "@tanstack/react-start";
import { connectToDatabase } from "@/server/db";
import { generateObjectiveMcqs } from "@/server/gemini.server";
import { requireSession } from "@/server/session";

type GenerateMcqsInput = {
  token: string;
  examTitle: string;
  topics: Array<{ id: string; title: string; subtopics: string[] }>;
  questionCount: number;
  instructions?: string;
};

export const generateMcqsServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateMcqsInput) => data)
  .handler(async ({ data }) => {
    const db = await connectToDatabase();
    await requireSession(db, "student", data.token);

    return {
      questions: await generateObjectiveMcqs({
        examTitle: data.examTitle,
        topics: data.topics,
        questionCount: data.questionCount,
        instructions: data.instructions,
      }),
    };
  });
