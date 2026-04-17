import { Type } from '@google/genai';
import { prisma } from '../../../db';
import { getAIProvider } from '../providers/ai.factory';

export interface FeedbackAnalysis {
  resolvedTypeId: number | null;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

export interface FeedbackAnalysisDemo extends FeedbackAnalysis {
  /** Raw JSON string from the model (or error payload when AI is skipped). */
  rawJson: string;
}

const FALLBACK: FeedbackAnalysis = {
  resolvedTypeId: null,
  sentiment: 'NEUTRAL',
};

type FeedbackTypeRow = { id: number; name: string; description: string | null };

/**
 * Classify a comment using Gemini and the given active types (no DB read).
 */
export async function analyzeFeedbackWithTypes(
  comment: string,
  activeTypes: FeedbackTypeRow[]
): Promise<FeedbackAnalysisDemo> {
  if (activeTypes.length === 0) {
    return { ...FALLBACK, rawJson: JSON.stringify({ error: 'No active types' }) };
  }

  const typeNames = activeTypes.map((t) => t.name);
  const typeDescriptions = activeTypes
    .map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`)
    .join('\n');

  try {
    const ai = getAIProvider();

    const responseSchema = {
      type: Type.OBJECT,
      required: ['response'],
      properties: {
        response: {
          type: Type.OBJECT,
          required: ['feedbacktype', 'sentiment'],
          properties: {
            feedbacktype: {
              type: Type.STRING,
              enum: typeNames,
            },
            sentiment: {
              type: Type.STRING,
              enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
            },
          },
        },
      },
    };

    const systemPrompt =
      `You are an e-commerce feedback classifier.\n` +
      `Given the customer review below, determine:\n` +
      `1. The most fitting feedback category from the list below (choose the name exactly as shown):\n` +
      `${typeDescriptions}\n\n` +
      `2. The overall sentiment: POSITIVE, NEUTRAL, or NEGATIVE`;

    const userPrompt = `Customer review: "${comment}"`;

    const parsed = await ai.generateJson<{ response: { feedbacktype: string; sentiment: string } }>({
      system: systemPrompt,
      user: userPrompt,
      responseSchema,
    });

    const { feedbacktype, sentiment } = parsed.response;

    const validSentiments = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
    const resolvedSentiment = validSentiments.includes(
      sentiment as (typeof validSentiments)[number]
    )
      ? (sentiment as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE')
      : 'NEUTRAL';

    const matchedType = activeTypes.find(
      (t: FeedbackTypeRow) => t.name.toLowerCase() === (feedbacktype || '').toLowerCase()
    );

    return {
      resolvedTypeId: matchedType?.id ?? null,
      sentiment: resolvedSentiment,
      rawJson: JSON.stringify(parsed),
    };
  } catch (err) {
    console.error('[AI] Feedback analysis failed:', err);
    return {
      ...FALLBACK,
      rawJson: JSON.stringify({
        error: 'Analysis failed',
        detail: err instanceof Error ? err.message : String(err),
      }),
    };
  }
}

export async function analyzeFeedback(comment: string): Promise<FeedbackAnalysis> {
  const activeTypes: FeedbackTypeRow[] = await prisma.feedbackType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true },
    orderBy: { id: 'asc' },
  });

  if (activeTypes.length === 0) return FALLBACK;

  const result = await analyzeFeedbackWithTypes(comment, activeTypes);
  return { resolvedTypeId: result.resolvedTypeId, sentiment: result.sentiment };
}
