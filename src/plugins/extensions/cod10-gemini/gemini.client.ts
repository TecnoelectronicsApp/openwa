import { createLogger } from '../../../common/services/logger.service';

export interface GeminiClientOptions {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

export class GeminiClient {
  private readonly logger = createLogger('GeminiClient');
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly opts: GeminiClientOptions) {
    this.model = opts.model ?? 'gemini-2.0-flash';
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }

  async generateReply(systemPrompt: string, userMessage: string, conversationHistory?: string): Promise<string> {
    const parts: string[] = [];
    if (conversationHistory) {
      parts.push(`Historial reciente:\n${conversationHistory}\n`);
    }
    parts.push(`Mensaje del cliente:\n${userMessage}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.opts.apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: parts.join('\n') }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        throw new Error('Gemini returned empty response');
      }
      return text;
    } catch (error) {
      this.logger.error('Gemini generateReply failed', error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
