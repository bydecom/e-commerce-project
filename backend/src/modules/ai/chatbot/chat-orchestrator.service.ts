import { prisma } from '../../../db';
import * as productService from '../../product/product.service';
import { getAIProvider } from '../providers/ai.factory';
import {
  buildGenerateFinalResponseSystemPrompt,
  EXTRACT_INTENT_SYSTEM_PROMPT,
  FALLBACK_RESPONSE,
  GREETING_RESPONSE,
  PATH_LABELS,
  VALID_PATHS,
} from './chat.constants';
import type { ChatAction, ChatBotResponse, Intent, IntentResult, ToolResult } from './chat.types';

const ai = getAIProvider();

export async function processUserChat(
  userId: number | undefined,
  message: string
): Promise<ChatBotResponse> {
  // Fast-path greeting so frontend can fetch it without consuming quota.
  const lower = message.toLowerCase();
  if (lower.includes('hello') || lower === 'hi' || lower.includes('hey')) {
    return GREETING_RESPONSE;
  }

  try {
    // Step 1: Extract intent + args from Local LLM
    const intentResult = await extractIntent(message);

    if (intentResult.intent === 'GREETING') {
      return GREETING_RESPONSE;
    }

    // Step 2: Query DB based on intent
    const tool = await runToolsForIntent(userId, intentResult, message);

    // Step 3 (short-circuit): Return deterministic navigate response without LLM.
    if (tool.kind === 'navigate') {
      const label = PATH_LABELS[tool.data.path] ?? tool.data.path;
      return {
        text: `You are now redirected to the ${label} page!`,
        actions: [{ type: 'NAVIGATE_TO', payload: { path: tool.data.path } }],
      };
    }

    // Step 3: Let Local LLM generate final response from real data
    const final = await generateFinalResponse(message, tool);

    // Ensure real data is always injected into actions (AI cannot fabricate data).
    const actions: ChatAction[] = Array.isArray(final.actions) ? final.actions : [];

    if (tool.kind === 'orders') {
      const filtered: ChatAction[] = actions.filter((a) => a.type !== 'SHOW_ORDERS');
      filtered.push({ type: 'SHOW_ORDERS', payload: { orders: tool.data } });
      return { text: final.text, actions: filtered };
    }

    if (tool.kind === 'products') {
      const filtered: ChatAction[] = actions.filter((a) => a.type !== 'SHOW_PRODUCTS');
      if (tool.data.length > 0) {
        filtered.push({ type: 'SHOW_PRODUCTS', payload: { products: tool.data } });
      }
      return { text: final.text, actions: filtered };
    }

    return { text: final.text, actions };
  } catch (err) {
    console.error('[ChatBot] Processing error:', err);
    return FALLBACK_RESPONSE;
  }
}

// ─── Step 1: Extract Intent ────────────────────────────────────────────────

async function extractIntent(userMessage: string): Promise<IntentResult> {
  try {
    const parsed = (await ai.generateJson({
      system: EXTRACT_INTENT_SYSTEM_PROMPT,
      user: userMessage,
      temperature: 0.1,
    })) as any;
    const intent = typeof parsed?.intent === 'string' ? (parsed.intent as Intent) : 'UNKNOWN';
    const args = parsed?.args && typeof parsed.args === 'object' ? (parsed.args as Record<string, unknown>) : {};
    return { intent, args };
  } catch (err) {
    console.error('[ChatBot] Extract intent error:', err);
    return { intent: 'UNKNOWN', args: {} };
  }
}

// ─── Step 2: Tool Calls (DB) ───────────────────────────────────────────────

async function runToolsForIntent(
  userId: number | undefined,
  intent: IntentResult,
  userMessage: string
): Promise<ToolResult> {
  switch (intent.intent) {
    case 'GET_SHOP_INFO': {
      const shop = await prisma.storeSetting.findFirst({
        select: { name: true, address: true, phone: true },
      });
      return { kind: 'shop', data: shop };
    }

    case 'NAVIGATE': {
      const p = intent.args?.['path'];
      let path = typeof p === 'string' ? p : '/';

      if (!VALID_PATHS.includes(path as any)) {
        console.warn(`[ChatBot] Invalid path from LLM: ${String(path)}, fallback to /`);
        path = '/';
      }

      return { kind: 'navigate', data: { path } };
    }

    case 'LIST_ORDERS': {
      if (!userId) return { kind: 'orders', data: [] };
      const rows = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, total: true, createdAt: true },
      });
      return {
        kind: 'orders',
        data: rows.map((o) => ({
          id: o.id,
          status: o.status,
          total: o.total,
          date: o.createdAt.toISOString(),
        })),
      };
    }

    case 'SEARCH_PRODUCTS': {
      const rawQueries = intent.args?.['queries'];
      let searchTerms: string[] = [];

      if (Array.isArray(rawQueries) && rawQueries.length > 0) {
        searchTerms = rawQueries
          .map((q) => (typeof q === 'string' ? q.trim() : ''))
          .filter(Boolean);
      } else {
        // Fallback: parse from original message if model misses queries
        const match = userMessage.match(/(?:find|buy|search|show)\s+(?:product\s+)?(.+)/i);
        const raw = (match?.[1]?.trim() ?? userMessage.trim()).trim();
        searchTerms = raw
          .split(/\s+and\s+|\s+with\s+|,/i)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      console.log('[ChatBot] SEARCH_PRODUCTS queries:', searchTerms);
      if (searchTerms.length === 0) return { kind: 'products', data: [] };

      // Limit to top 3 per keyword to avoid returning too many items
      const perTermLimit = 3;
      const results = await Promise.all(
        searchTerms.slice(0, 5).map((term) => productService.searchSmartHybrid(term, perTermLimit))
      );

      const merged = results.flat();
      const uniq = [...new Map(merged.map((p) => [p.id, p])).values()];
      return { kind: 'products', data: uniq.slice(0, 10) };
    }

    case 'GREETING':
    case 'UNKNOWN':
    default:
      return { kind: 'none', data: null };
  }
}

// ─── Step 3: Generate Final Response ──────────────────────────────────────

async function generateFinalResponse(userMessage: string, tool: ToolResult): Promise<ChatBotResponse> {
  try {
    const parsed = (await ai.generateJson({
      system: buildGenerateFinalResponseSystemPrompt(tool),
      user: userMessage,
      temperature: 0.2,
    })) as any;
    const rawActions: unknown[] = Array.isArray(parsed?.actions) ? parsed.actions : [];
    const safeActions: ChatAction[] = [];
    const allowedOptionsMap = new Map<string, string>([
      ['view cart', 'View cart'],
      ['find products', 'Find products'],
      ['my orders', 'My orders'],
    ]);

    for (const a of rawActions) {
      const type = (a as any)?.type;
      const payload = (a as any)?.payload;

      if (type === 'SUGGEST_OPTIONS') {
        const options = (payload as any)?.options;
        if (Array.isArray(options)) {
          const validOptions: string[] = [];

          for (const opt of options) {
            if (typeof opt !== 'string') continue;
            const normalizedOpt = opt.trim().toLowerCase();
            const canonical = allowedOptionsMap.get(normalizedOpt);
            if (canonical) {
              validOptions.push(canonical);
            }
          }

          if (validOptions.length > 0) {
            safeActions.push({ type: 'SUGGEST_OPTIONS', payload: { options: validOptions } });
          }
        }
        continue;
      }

      if (type === 'NAVIGATE_TO') {
        const path = (payload as any)?.path;
        if (typeof path === 'string' && VALID_PATHS.includes(path as any)) {
          safeActions.push({ type: 'NAVIGATE_TO', payload: { path } });
        }
      }
    }

    return {
      text: typeof parsed?.text === 'string' ? parsed.text : 'OK',
      actions: safeActions,
    };
  } catch (err) {
    console.error('[ChatBot] Generate final response error:', err);
    return { text: 'Sorry, the AI system is overloaded right now. Can I help you with anything else?', actions: [] };
  }
}

