import { GoogleGenAI } from '@google/genai';
import type { GenerateJsonInput, IAIProvider } from './ai.interface';

function getEnvTrim(name: string, fallback: string): string {
  return String(process.env[name] ?? fallback).trim();
}

export class GeminiAIProvider implements IAIProvider {
  private readonly ai: GoogleGenAI;
  private readonly defaultModel: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.defaultModel = getEnvTrim('GEMINI_MODEL', 'gemini-2.5-flash-lite');
  }

  async generateJson<T>(input: GenerateJsonInput): Promise<T> {
    const prompt = `${input.system}\n\n---\n\nUser request:\n${input.user}`;

    const config: any = {
      responseMimeType: 'application/json',
      temperature: input.temperature ?? 0.2,
    };
    if (input.responseSchema) {
      config.responseSchema = input.responseSchema;
    }

    const aiResponse = await this.ai.models.generateContent({
      model: input.model ?? this.defaultModel,
      config,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const jsonText = aiResponse.text ?? '{}';
    return JSON.parse(jsonText) as T;
  }
}

