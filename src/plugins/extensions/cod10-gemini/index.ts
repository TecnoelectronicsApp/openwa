/**
 * Codigo 10 + Gemini customer service bot.
 *
 * Fetches products, prices and bank accounts from the Cod10 Vercel API and uses
 * Google Gemini to generate contextual WhatsApp replies to customers.
 */
import { PluginContext, IPlugin } from '../../../core/plugins';
import { HookContext, HookResult } from '../../../core/hooks';
import { IncomingMessage } from '../../../engine/interfaces/whatsapp-engine.interface';
import { Cod10ApiClient } from './cod10-api.client';
import { GeminiClient } from './gemini.client';

const DEFAULT_SYSTEM_PROMPT = `Eres el asistente virtual de ventas de Codigo 10 (Cod10).
Responde en español de forma amable, clara y concisa por WhatsApp.
Usa SOLO la información del catálogo y cuentas bancarias proporcionada — no inventes productos ni precios.
Si el cliente pregunta por un producto que no existe, indícalo amablemente y ofrece alternativas del catálogo.
Si pregunta cómo pagar, comparte los datos bancarios disponibles.
Mantén respuestas cortas (máximo 3 párrafos). Usa emojis con moderación.`;

function readString(cfg: Record<string, unknown>, key: string, fallback: string): string {
  const v = cfg[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function readOptionalString(cfg: Record<string, unknown>, key: string): string | undefined {
  const v = cfg[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function readBool(cfg: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = cfg[key];
  return typeof v === 'boolean' ? v : fallback;
}

function readNumber(cfg: Record<string, unknown>, key: string, fallback: number): number {
  const v = cfg[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export class Cod10GeminiPlugin implements IPlugin {
  private cod10Client: Cod10ApiClient | null = null;
  private geminiClient: GeminiClient | null = null;
  private catalogCache: { context: string; expiresAt: number } | null = null;
  private systemPrompt = DEFAULT_SYSTEM_PROMPT;

  onEnable(context: PluginContext): Promise<void> {
    this.rebuildClients(context);
    context.registerHook('message:received', ctx => this.onMessage(context, ctx as HookContext<IncomingMessage>));
    context.logger.log('Cod10 Gemini bot enabled');
    return Promise.resolve();
  }

  onConfigChange(context: PluginContext): Promise<void> {
    this.catalogCache = null;
    this.rebuildClients(context);
    context.logger.log('Cod10 Gemini bot config updated');
    return Promise.resolve();
  }

  onDisable(context: PluginContext): Promise<void> {
    this.cod10Client = null;
    this.geminiClient = null;
    this.catalogCache = null;
    context.logger.log('Cod10 Gemini bot disabled');
    return Promise.resolve();
  }

  private rebuildClients(context: PluginContext): void {
    const cfg = context.config;
    const cod10ApiUrl = readString(cfg, 'cod10ApiUrl', '');
    const geminiApiKey = readString(cfg, 'geminiApiKey', '');

    if (!cod10ApiUrl || !geminiApiKey) {
      context.logger.warn('Cod10 Gemini bot: cod10ApiUrl and geminiApiKey are required');
    }

    this.systemPrompt = readString(cfg, 'systemPrompt', DEFAULT_SYSTEM_PROMPT);
    this.cod10Client = new Cod10ApiClient({
      baseUrl: cod10ApiUrl,
      apiKey: readOptionalString(cfg, 'cod10ApiKey'),
      timeoutMs: readNumber(cfg, 'catalogTimeoutMs', 10000),
    });
    this.geminiClient = new GeminiClient({
      apiKey: geminiApiKey,
      model: readString(cfg, 'geminiModel', 'gemini-2.0-flash'),
      timeoutMs: readNumber(cfg, 'geminiTimeoutMs', 30000),
    });
  }

  private async getCatalogContext(): Promise<string> {
    const cacheTtlMs = 60000;
    const now = Date.now();
    if (this.catalogCache && this.catalogCache.expiresAt > now) {
      return this.catalogCache.context;
    }

    if (!this.cod10Client) {
      throw new Error('Cod10 API client not initialized');
    }

    const context = await this.cod10Client.fetchCatalogContext();
    this.catalogCache = { context, expiresAt: now + cacheTtlMs };
    return context;
  }

  private async onMessage(context: PluginContext, ctx: HookContext<IncomingMessage>): Promise<HookResult> {
    const message = ctx.data;
    const cfg = context.config;
    const replyInGroups = readBool(cfg, 'replyInGroups', false);

    if (ctx.source !== 'Engine' || !ctx.sessionId || message.fromMe) {
      return { continue: true };
    }
    if (message.isGroup && !replyInGroups) {
      return { continue: true };
    }
    if (message.type !== 'text' || !message.body?.trim()) {
      return { continue: true };
    }

    if (!this.geminiClient || !this.cod10Client) {
      context.logger.warn('Cod10 Gemini bot not configured — skipping reply');
      return { continue: true };
    }

    try {
      const catalogContext = await this.getCatalogContext();
      const fullSystemPrompt = `${this.systemPrompt}\n\n${catalogContext}`;
      const reply = await this.geminiClient.generateReply(fullSystemPrompt, message.body.trim());

      await context.messages.reply(ctx.sessionId, message.chatId, message.id, reply);
    } catch (error) {
      context.logger.error('Cod10 Gemini reply failed', error);
    }

    return { continue: true };
  }
}

export default Cod10GeminiPlugin;
