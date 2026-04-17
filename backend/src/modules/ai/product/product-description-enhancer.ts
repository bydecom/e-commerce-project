import { Type } from '@google/genai';
import { httpError } from '../../../utils/http-error';
import { getAIProvider } from '../providers/ai.factory';

const MAX_NAME_LEN = 300;
const MAX_CURRENT_LEN = 8000;

export async function enhanceProductDescription(
  name: string,
  currentDescription: string | null
): Promise<string> {
  if (name.length > MAX_NAME_LEN) throw httpError(400, 'Product name is too long');
  if (currentDescription && currentDescription.length > MAX_CURRENT_LEN) {
    throw httpError(400, 'Current description is too long');
  }

  const draft = currentDescription?.trim() || '';

  const systemPrompt =
    `You are an e-commerce copywriter. Write a clear, persuasive product description for an online store.\n` +
    `Rules: English, 2–5 sentences or a short paragraph, no markdown headings, no placeholder text, no price.`;

  const userPrompt =
    `Product name: "${name}"\n` +
    (draft
      ? `Current draft (expand, polish, and keep factual claims reasonable; do not invent specs):\n"""${draft}"""\n`
      : `There is no draft yet — write a short professional description based only on the product name.\n`);

  try {
    const ai = getAIProvider();

    const responseSchema = {
      type: Type.OBJECT,
      required: ['description'],
      properties: {
        description: {
          type: Type.STRING,
          description: 'Final product description only',
        },
      },
    };

    const parsed = await ai.generateJson<{ description?: string }>({
      system: systemPrompt,
      user: userPrompt,
      responseSchema,
    });

    const out = (parsed.description ?? '').trim();
    if (!out) throw httpError(502, 'AI returned an empty description');
    if (out.length > 12000) throw httpError(502, 'AI response too large');
    return out;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[AI] Product description enhancement failed:', err);
    throw httpError(502, 'Could not generate description');
  }
}
