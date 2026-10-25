/**
 * Creative loading messages for AIHub operations
 */

export const QUESTION_GENERATION_MESSAGES = [
  "✨ Analyzing topic complexity...",
  "🎯 Matching difficulty level to your progress...",
  "🧠 Aligning concepts to learning objectives...",
  "📚 Structuring question framework...",
  "🔍 Integrating weak area focus...",
  "⚡ Optimizing question clarity...",
  "🎓 Cross-referencing syllabus...",
  "💡 Adding exam-style formatting...",
  "🌟 Finalizing question generation...",
];

export const ANSWER_EVALUATION_MESSAGES = [
  "📖 Reading your answer...",
  "🔎 Analyzing concept accuracy...",
  "✅ Checking answer completeness...",
  "🎯 Evaluating relevance to question...",
  "📝 Assessing structural clarity...",
  "⚖️ Weighing technical precision...",
  "🔄 Optimizing feedback generation...",
  "🏆 Preparing detailed evaluation...",
  "💬 Crafting personalized suggestions...",
  "📊 Finalizing assessment...",
];

export const IMAGE_OCR_MESSAGES = [
  "📸 Processing handwritten image...",
  "🔍 Analyzing handwriting...",
  "📝 Extracting text content...",
  "🎯 Recognizing answer structure...",
];

export const SYLLABUS_PARSING_MESSAGES = [
  "📚 Reading syllabus document...",
  "🏷️ Identifying main topics...",
  "📋 Categorizing subtopics...",
  "🔗 Building topic relationships...",
  "✨ Organizing syllabus structure...",
];

/**
 * Get a rotating loading message for an operation
 */
export function getLoadingMessage(
  messageSet: string[],
  index: number,
): string {
  return messageSet[index % messageSet.length];
}

/**
 * Create an async generator that yields loading messages at intervals
 */
export async function* generateLoadingMessages(
  messageSet: string[],
  intervalMs: number = 1500,
  durationMs: number = 30000,
): AsyncGenerator<string, void, unknown> {
  const startTime = Date.now();
  let messageIndex = 0;

  while (Date.now() - startTime < durationMs) {
    yield getLoadingMessage(messageSet, messageIndex);
    messageIndex++;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Format loading message with animation
 */
export function formatLoadingMessage(message: string, frameIndex: number = 0): string {
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const spinner = spinnerFrames[frameIndex % spinnerFrames.length];
  return `${spinner} ${message}`;
}

/**
 * Get a random encouraging message during processing
 */
export const ENCOURAGEMENT_MESSAGES = [
  "🚀 Almost there...",
  "⏳ Processing your request...",
  "🎪 Working on it...",
  "💻 Crunching numbers...",
  "🔮 Consulting the AI oracle...",
  "⚙️ Gears turning...",
];

export function getEncouragementMessage(): string {
  return ENCOURAGEMENT_MESSAGES[
    Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length)
  ];
}
