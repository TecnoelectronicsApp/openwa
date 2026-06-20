import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { PluginLoaderService, PluginManifest, PluginType } from '../../core/plugins';
import { AutoReplyPlugin } from './auto-reply';
import { Cod10GeminiPlugin } from './cod10-gemini';
import { TranslationPlugin } from './translation';
import { createLogger } from '../../common/services/logger.service';

/**
 * Registers first-party built-in EXTENSION plugins with the (global) PluginLoaderService.
 * Mirrors EngineFactory's registration pattern so src/core never imports a concrete plugin.
 * Built-in extensions are registered DISABLED; operators enable them via POST /plugins/:id/enable.
 */
@Injectable()
export class ExtensionsRegistrar implements OnModuleInit {
  private readonly logger = createLogger('ExtensionsRegistrar');

  constructor(private readonly pluginLoader: PluginLoaderService) {}

  onModuleInit(): void {
    const autoReplyManifest: PluginManifest = {
      id: 'auto-reply',
      name: 'Auto Reply (reference)',
      version: '1.0.0',
      type: PluginType.EXTENSION,
      description: 'Reference extension plugin: replies to inbound direct messages. Disabled by default.',
      main: 'index.ts',
      permissions: ['messages:send'],
      sessions: ['*'],
    };

    this.pluginLoader.registerBuiltInPlugin(autoReplyManifest, new AutoReplyPlugin());
    this.logger.log('Auto-reply reference plugin registered (disabled)');

    const translationManifest: PluginManifest = {
      id: 'translation',
      name: 'Group Auto-Translation',
      version: '1.0.0',
      type: PluginType.EXTENSION,
      description:
        "Auto-translates group messages between participants' languages via LibreTranslate. Configure in-group with /tr commands. Disabled by default.",
      main: 'index.ts',
      permissions: ['messages:send'],
      sessions: ['*'],
      // Exposed via GET /plugins so the dashboard renders an editable config form (URL + API key, etc.).
      configSchema: {
        type: 'object',
        properties: {
          libretranslateUrl: {
            type: 'string',
            title: 'LibreTranslate URL',
            description:
              'Base URL of the LibreTranslate instance (e.g. http://libretranslate:7001 or https://libretranslate.com).',
            default: 'http://localhost:7001',
            required: true,
          },
          libretranslateApiKey: {
            type: 'string',
            title: 'LibreTranslate API key',
            description:
              'Optional API key, if your LibreTranslate instance requires one (e.g. hosted libretranslate.com).',
            secret: true,
          },
          timeoutMs: { type: 'number', title: 'Translate timeout (ms)', default: 5000 },
          commandPrefix: { type: 'string', title: 'Command prefix', default: '/tr' },
          minLength: { type: 'number', title: 'Min message length to translate', default: 2 },
          maxLength: { type: 'number', title: 'Max message length to translate', default: 2000 },
          denyReply: {
            type: 'boolean',
            title: 'Reply on denied commands',
            description: "Reply with an 'admins only' message when a non-admin runs a restricted command.",
            default: false,
          },
        },
      },
    };

    this.pluginLoader.registerBuiltInPlugin(translationManifest, new TranslationPlugin());
    this.logger.log('Translation plugin registered (disabled)');

    const cod10GeminiManifest: PluginManifest = {
      id: 'cod10-gemini',
      name: 'Codigo 10 Gemini Bot',
      version: '1.0.0',
      type: PluginType.EXTENSION,
      description:
        'Bot de atención al cliente con IA Gemini conectado al catálogo Cod10 (productos, precios y cuentas bancarias).',
      main: 'index.ts',
      permissions: ['messages:send'],
      sessions: ['*'],
      configSchema: {
        type: 'object',
        properties: {
          cod10ApiUrl: {
            type: 'string',
            title: 'URL Cod10 (Vercel)',
            description: 'Base URL de la plataforma Cod10 (ej. https://cod10.vercel.app). Lee productos de MongoDB vía GraphQL.',
            default: 'https://cod10.vercel.app',
            required: true,
          },
          cod10ApiKey: {
            type: 'string',
            title: 'Bot API Key',
            description: 'Clave BOT_API_KEY configurada en Vercel (cod10 platform).',
            secret: true,
          },
          geminiApiKey: {
            type: 'string',
            title: 'Gemini API Key',
            description: 'Clave de Google AI Studio / Gemini API.',
            secret: true,
            required: true,
          },
          geminiModel: {
            type: 'string',
            title: 'Modelo Gemini',
            description: 'Modelo a usar (ej. gemini-2.0-flash).',
            default: 'gemini-2.0-flash',
          },
          systemPrompt: {
            type: 'string',
            title: 'Prompt del sistema',
            description: 'Instrucciones base para el asistente de ventas.',
          },
          replyInGroups: {
            type: 'boolean',
            title: 'Responder en grupos',
            description: 'Si está activo, el bot también responde en chats de grupo.',
            default: false,
          },
          catalogTimeoutMs: { type: 'number', title: 'Timeout catálogo (ms)', default: 10000 },
          geminiTimeoutMs: { type: 'number', title: 'Timeout Gemini (ms)', default: 30000 },
        },
      },
    };

    this.pluginLoader.registerBuiltInPlugin(cod10GeminiManifest, new Cod10GeminiPlugin());
    this.logger.log('Cod10 Gemini bot plugin registered (disabled)');
  }
}

@Module({
  providers: [ExtensionsRegistrar],
})
export class ExtensionsModule {}
