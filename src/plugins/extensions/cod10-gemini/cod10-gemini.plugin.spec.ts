import { Cod10GeminiPlugin } from './index';
import { PluginContext } from '../../../core/plugins';
import { HookContext, HookEvent, HookHandler } from '../../../core/hooks';
import { IncomingMessage } from '../../../engine/interfaces/whatsapp-engine.interface';
import { Cod10ApiClient } from './cod10-api.client';
import { GeminiClient } from './gemini.client';

jest.mock('./cod10-api.client');
jest.mock('./gemini.client');

function makeContext(reply: jest.Mock, config: Record<string, unknown> = {}): { context: PluginContext; getHandler: () => HookHandler } {
  let captured: HookHandler | undefined;
  const context = {
    pluginId: 'cod10-gemini',
    config: {
      cod10ApiUrl: 'https://cod10.vercel.app',
      geminiApiKey: 'test-gemini-key',
      ...config,
    },
    registerHook: (_event: HookEvent, handler: HookHandler) => {
      captured = handler;
    },
    messages: { reply, sendText: jest.fn() },
    logger: { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  } as unknown as PluginContext;
  return { context, getHandler: () => captured as HookHandler };
}

function inbound(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    id: 'msg-1',
    from: '628@c.us',
    to: 'me',
    chatId: '628@c.us',
    body: '¿Cuánto cuesta el producto X?',
    type: 'text',
    timestamp: 1,
    fromMe: false,
    isGroup: false,
    ...overrides,
  };
}

function ctxFor(data: IncomingMessage): HookContext<IncomingMessage> {
  return { event: 'message:received', data, sessionId: 'sess-codigo10', timestamp: new Date(), source: 'Engine' };
}

describe('Cod10GeminiPlugin', () => {
  const mockFetchCatalogContext = jest.fn();
  const mockGenerateReply = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Cod10ApiClient as jest.Mock).mockImplementation(() => ({
      fetchCatalogContext: mockFetchCatalogContext,
    }));
    (GeminiClient as jest.Mock).mockImplementation(() => ({
      generateReply: mockGenerateReply,
    }));
    mockFetchCatalogContext.mockResolvedValue('=== CATÁLOGO COD10 ===');
    mockGenerateReply.mockResolvedValue('Hola, el producto X cuesta $100.');
  });

  it('replies to inbound text messages using Gemini', async () => {
    const reply = jest.fn().mockResolvedValue({ messageId: 'x', timestamp: 1 });
    const { context, getHandler } = makeContext(reply);
    await new Cod10GeminiPlugin().onEnable(context);

    const result = await getHandler()(ctxFor(inbound()));

    expect(mockFetchCatalogContext).toHaveBeenCalled();
    expect(mockGenerateReply).toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith('sess-codigo10', '628@c.us', 'msg-1', 'Hola, el producto X cuesta $100.');
    expect(result).toEqual({ continue: true });
  });

  it('does NOT reply to its own messages', async () => {
    const reply = jest.fn();
    const { context, getHandler } = makeContext(reply);
    await new Cod10GeminiPlugin().onEnable(context);

    await getHandler()(ctxFor(inbound({ fromMe: true })));

    expect(reply).not.toHaveBeenCalled();
  });

  it('does NOT reply to group messages by default', async () => {
    const reply = jest.fn();
    const { context, getHandler } = makeContext(reply);
    await new Cod10GeminiPlugin().onEnable(context);

    await getHandler()(ctxFor(inbound({ isGroup: true })));

    expect(reply).not.toHaveBeenCalled();
  });

  it('skips non-text messages', async () => {
    const reply = jest.fn();
    const { context, getHandler } = makeContext(reply);
    await new Cod10GeminiPlugin().onEnable(context);

    await getHandler()(ctxFor(inbound({ type: 'image', body: '' })));

    expect(reply).not.toHaveBeenCalled();
  });
});
