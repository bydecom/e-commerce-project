import { Type } from '@google/genai';
import { prisma } from '../../../db';
import { getAIProvider } from '../providers/ai.factory';

export interface SuggestedActionPlan {
  title: string;
  description: string;
}

export interface FeedbackAnalysis {
  resolvedTypeId: number | null;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  suggestedActionPlans: SuggestedActionPlan[];
}

export interface FeedbackAnalysisDemo extends FeedbackAnalysis {
  /** Raw JSON string from the model (or error payload when AI is skipped). */
  rawJson: string;
}

const FALLBACK: FeedbackAnalysis = {
  resolvedTypeId: null,
  sentiment: 'NEUTRAL',
  suggestedActionPlans: [],
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
          required: ['feedbacktype', 'sentiment', 'suggestedActionPlans'],
          properties: {
            feedbacktype: {
              type: Type.STRING,
              enum: typeNames,
            },
            sentiment: {
              type: Type.STRING,
              enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
            },
            suggestedActionPlans: {
              type: Type.ARRAY,
              description: 'List of 1-2 actionable steps for the admin based on this feedback',
              items: {
                type: Type.OBJECT,
                required: ['title', 'description'],
                properties: {
                  title: {
                    type: Type.STRING,
                    description: "Short, actionable title (e.g., 'Gọi điện xin lỗi khách')",
                  },
                  description: {
                    type: Type.STRING,
                    description: 'Detailed steps on how to resolve or respond to the feedback',
                  },
                },
              },
            },
          },
        },
      },
    };

    const systemPrompt =
      `You are an e-commerce feedback classifier and customer success advisor.\n` +
      `Given the customer review below, determine:\n` +
      `1. The most fitting feedback category from the list below (choose the name exactly as shown):\n` +
      `${typeDescriptions}\n\n` +
      `2. The overall sentiment: POSITIVE, NEUTRAL, or NEGATIVE\n\n` +
      `3. Generate 1 to 2 concrete action plans (title and description) for the store admin to handle this feedback. ` +
      `If negative, suggest compensation, checking stock, or apologizing. ` +
      `If positive, suggest thanking the user or upselling. ` +
      `Write action plan title and description in English.`;

    const userPrompt = `Customer review: "${comment}"`;

    const parsed = await ai.generateJson<{
      response: { feedbacktype: string; sentiment: string; suggestedActionPlans: SuggestedActionPlan[] };
    }>({
      system: systemPrompt,
      user: userPrompt,
      responseSchema,
    });

    const { feedbacktype, sentiment, suggestedActionPlans } = parsed.response;

    const validSentiments = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
    const resolvedSentiment = validSentiments.includes(sentiment as (typeof validSentiments)[number])
      ? (sentiment as 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE')
      : 'NEUTRAL';

    const matchedType = activeTypes.find(
      (t: FeedbackTypeRow) => t.name.toLowerCase() === (feedbacktype || '').toLowerCase()
    );

    return {
      resolvedTypeId: matchedType?.id ?? null,
      sentiment: resolvedSentiment,
      suggestedActionPlans: Array.isArray(suggestedActionPlans) ? suggestedActionPlans : [],
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
  return {
    resolvedTypeId: result.resolvedTypeId,
    sentiment: result.sentiment,
    suggestedActionPlans: result.suggestedActionPlans,
  };
}
