export type GenerateJsonInput = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Provider-specific schema.
   * - Gemini: pass `responseSchema` compatible with `@google/genai` (e.g. using `Type.*`)
   * - Local: ignored (prompt text should already enforce JSON shape)
   */
  responseSchema?: unknown;
  /** Override model per-call (optional). */
  model?: string;
};

export interface IAIProvider {
  generateJson<T>(input: GenerateJsonInput): Promise<T>;
}

