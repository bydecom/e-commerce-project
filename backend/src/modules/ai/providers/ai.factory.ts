import type { IAIProvider } from './ai.interface';
import { GeminiAIProvider } from './gemini.provider';
import { LocalAIProvider } from './local.provider';

export function getAIProvider(): IAIProvider {
  const useGemini = String(process.env.USE_GEMINI ?? '').trim().toLowerCase() === 'true';
  if (useGemini && process.env.GEMINI_API_KEY) {
    return new GeminiAIProvider();
  }
  return new LocalAIProvider();
}

