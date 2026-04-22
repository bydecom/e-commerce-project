import type { IAIProvider } from './ai.interface';
import { GeminiAIProvider } from './gemini.provider';
import { LocalAIProvider } from './local.provider';
import { getConfig, getConfigBool } from '../../system-config/system-config.service';

export async function getAIProvider(): Promise<IAIProvider> {
  const useGemini = await getConfigBool('use_gemini', String(process.env.USE_GEMINI ?? '').trim().toLowerCase() === 'true');
  const geminiKey = (await getConfig('gemini_api_key')).trim() || String(process.env.GEMINI_API_KEY ?? '').trim();

  if (useGemini && geminiKey) {
    // Gemini provider reads env for the API key
    process.env.GEMINI_API_KEY = geminiKey;
    return new GeminiAIProvider();
  }

  return new LocalAIProvider();
}

