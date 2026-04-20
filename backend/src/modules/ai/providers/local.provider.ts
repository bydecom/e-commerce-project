import type { GenerateJsonInput, IAIProvider } from './ai.interface';

function cleanJsonResponse(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function getEnvTrim(name: string, fallback: string): string {
  const val = process.env[name];
  return String(val || fallback).trim();
}

export class LocalAIProvider implements IAIProvider {
  private readonly url = getEnvTrim('LOCAL_LLM_URL', 'http://localhost:1234/v1/chat/completions');
  private readonly defaultModel = getEnvTrim('LOCAL_LLM_MODEL', 'mistral-7b-instruct');

  async generateJson<T>(input: GenerateJsonInput): Promise<T> {
    let systemPrompt = input.system;

    // Nếu có truyền responseSchema, tự động tiêm lệnh ép Local LLM trả về JSON
    if (input.responseSchema) {
      systemPrompt +=
        '\n\nCRITICAL INSTRUCTION: You MUST return EXACTLY ONE valid JSON object. Do not include any markdown formatting (like ```json). Do not add any conversational text before or after the JSON.';
    }

    const combinedPrompt = `${systemPrompt}\n\n---\n\nUser request:\n${input.user}`;

    const bodyPayload: any = {
      model: input.model ?? this.defaultModel,
      messages: [{ role: 'user', content: combinedPrompt }],
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 1000,
    };

    // Kích hoạt JSON mode trên LM Studio (nếu model có hỗ trợ)
    if (input.responseSchema) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Local LLM error: ${res.status} ${res.statusText} - ${errText}`);
    }

    const data = (await res.json()) as any;
    const raw = String(data?.choices?.[0]?.message?.content ?? '');
    try {
      return JSON.parse(cleanJsonResponse(raw)) as T;
    } catch (e) {
      console.error('[LocalAIProvider] Parse JSON Failed. Model returned text:\n', raw);
      throw e;
    }
  }
}

