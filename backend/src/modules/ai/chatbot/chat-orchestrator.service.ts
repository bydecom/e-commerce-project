import { prisma } from '../../../db';
import * as cartService from '../../cart/cart.service';
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
import type {
  ChatAction,
  ChatBotResponse,
  ChatTurnContext,
  Intent,
  IntentResult,
  ToolResult,
} from './chat.types';

async function getAI() {
  return await getAIProvider();
}

function sanitizeChatTurnContext(raw: unknown): ChatTurnContext {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const last = (raw as Record<string, unknown>)['lastShownProducts'];
  if (!Array.isArray(last)) return {};
  const out: { id: number; name: string }[] = [];
  for (const row of last.slice(0, 30)) {
    if (!row || typeof row !== 'object') continue;
    const id = Number((row as Record<string, unknown>)['id']);
    const nameRaw = (row as Record<string, unknown>)['name'];
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
    if (!Number.isFinite(id) || id <= 0 || !name) continue;
    out.push({ id: Math.floor(id), name: name.slice(0, 400) });
  }
  return out.length > 0 ? { lastShownProducts: out } : {};
}

function parsePositiveIntArg(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.floor(value);
    return n > 0 ? n : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const n = parseInt(value.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export async function processUserChat(
  userId: number | undefined,
  message: string,
  rawContext?: unknown
): Promise<ChatBotResponse> {
  const context = sanitizeChatTurnContext(rawContext);
  // Fast-path greeting so frontend can fetch it without consuming quota.
  const lower = message.toLowerCase();
  if (lower.includes('hello') || lower === 'hi' || lower.includes('hey')) {
    return GREETING_RESPONSE;
  }

  try {
    // Step 1: Extract intent + args from Local LLM
    const intentResult = await extractIntent(message, context);

    if (intentResult.intent === 'GREETING') {
      return GREETING_RESPONSE;
    }

    // Step 2: Query DB based on intent
    const tool = await runToolsForIntent(userId, intentResult, message, context);

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

    if (tool.kind === 'cart_add') {
      let filtered: ChatAction[] = actions.filter((a) => a.type !== 'REFRESH_CART');
      if (tool.data.success) {
        filtered.unshift({ type: 'REFRESH_CART' });
      } else if (tool.data.reason === 'unauthorized') {
        filtered = filtered.filter((a) => a.type !== 'NAVIGATE_TO');
        filtered.unshift({ type: 'NAVIGATE_TO', payload: { path: '/login' } });
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

async function extractIntent(userMessage: string, context: ChatTurnContext): Promise<IntentResult> {
  try {
    const contextBlock =
      context.lastShownProducts && context.lastShownProducts.length > 0
        ? `\n\n[SYSTEM CONTEXT - DO NOT SHOW TO USER]\nRecently shown products (display order = array order): ${JSON.stringify(context.lastShownProducts)}`
        : '';
    const userPrompt = `${userMessage}${contextBlock}`;

    const parsed = (await (await getAI()).generateJson({
      system: EXTRACT_INTENT_SYSTEM_PROMPT,
      user: userPrompt,
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
  userMessage: string,
  context: ChatTurnContext
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

      if (path === '/checkout') {
        console.warn('[ChatBot] Prevented NAVIGATE to /checkout; using /cart instead.');
        path = '/cart';
      }

      if (!VALID_PATHS.includes(path as any)) {
        console.warn(`[ChatBot] Invalid path from LLM: ${String(path)}, fallback to /`);
        path = '/';
      }

      return { kind: 'navigate', data: { path } };
    }

    case 'LIST_ORDERS': {
      if (!userId) return { kind: 'orders', data: [] };

      const rawStatus = intent.args?.['status'];
      const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED'] as const;
      const statusFilter =
        typeof rawStatus === 'string' && validStatuses.includes(rawStatus.toUpperCase() as (typeof validStatuses)[number])
          ? (rawStatus.toUpperCase() as (typeof validStatuses)[number])
          : undefined;

      const whereClause: { userId: number; status?: (typeof validStatuses)[number] } = { userId };
      if (statusFilter) {
        whereClause.status = statusFilter;
      }

      const rows = await prisma.order.findMany({
        where: whereClause,
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

    case 'ADD_TO_CART': {
      if (!userId) {
        return { kind: 'cart_add', data: { success: false, reason: 'unauthorized' } };
      }

      const rawName = intent.args?.['productName'];
      const productName = typeof rawName === 'string' ? rawName.trim() : '';

      let quantity = 1;
      const rawQty = intent.args?.['quantity'];
      if (typeof rawQty === 'number' && Number.isFinite(rawQty)) {
        quantity = Math.floor(rawQty);
      } else if (typeof rawQty === 'string' && rawQty.trim()) {
        const n = parseInt(rawQty.trim(), 10);
        if (Number.isFinite(n)) quantity = n;
      }
      if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
      quantity = Math.min(quantity, 99);

      const rawMode = intent.args?.['mode'];
      const mode: 'inc' | 'set' =
        typeof rawMode === 'string' && rawMode.trim().toLowerCase() === 'set' ? 'set' : 'inc';

      let productId = parsePositiveIntArg(intent.args?.['productId']);
      const lastShown = context.lastShownProducts ?? [];
      if (productId && lastShown.length > 0) {
        const allowed = new Set(lastShown.map((p) => p.id));
        if (!allowed.has(productId)) {
          productId = null;
        }
      }

      if (!productId && !productName) {
        return { kind: 'cart_add', data: { success: false, reason: 'missing_info' } };
      }

      let target: { id: number; name: string } | null = null;

      if (productId) {
        const p = await prisma.product.findUnique({
          where: { id: productId },
          select: { id: true, name: true, status: true },
        });
        if (p?.status === 'AVAILABLE') {
          target = { id: p.id, name: p.name };
        }
      }

      if (!target && productName) {
        const results = await productService.searchSmartHybrid(productName, 1);
        if (results.length > 0) {
          target = { id: results[0].id, name: results[0].name };
        }
      }

      if (!target) {
        return {
          kind: 'cart_add',
          data: { success: false, reason: 'not_found', productName: productName || undefined },
        };
      }

      try {
        await cartService.upsertItemWithStock({
          userId,
          productId: target.id,
          quantity,
          name: target.name,
          mode,
        });
        return {
          kind: 'cart_add',
          data: { success: true, productName: target.name, quantity, mode },
        };
      } catch (e) {
        const status =
          e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status) : 0;
        if (status === 422) {
          return {
            kind: 'cart_add',
            data: {
              success: false,
              reason: 'insufficient_stock',
              productName: target.name,
              quantity,
              mode,
            },
          };
        }
        console.error('[ChatBot] ADD_TO_CART error:', e);
        return {
          kind: 'cart_add',
          data: { success: false, reason: 'not_found', productName: target.name },
        };
      }
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
    const parsed = (await (await getAI()).generateJson({
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
      ['view orders', 'My orders'],
    ]);

    if (tool.kind === 'cart_add') {
      if (tool.data.success) {
        safeActions.push({ type: 'REFRESH_CART' });
      } else if (tool.data.reason === 'unauthorized') {
        safeActions.push({ type: 'NAVIGATE_TO', payload: { path: '/login' } });
      }
    }

    for (const a of rawActions) {
      const type = (a as any)?.type;
      const payload = (a as any)?.payload;

      if (type === 'REFRESH_CART') {
        if (!safeActions.some((sa) => sa.type === 'REFRESH_CART')) {
          safeActions.push({ type: 'REFRESH_CART' });
        }
        continue;
      }

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
        let path = (payload as any)?.path;
        if (path === '/checkout') {
          path = '/cart';
        }
        if (typeof path === 'string' && VALID_PATHS.includes(path as any)) {
          if (!safeActions.some((sa) => sa.type === 'NAVIGATE_TO' && (sa as { payload?: { path?: string } }).payload?.path === path)) {
            safeActions.push({ type: 'NAVIGATE_TO', payload: { path } });
          }
        }
      }
    }

    if (tool.kind === 'orders') {
      const suggestIdx = safeActions.findIndex((a) => a.type === 'SUGGEST_OPTIONS');
      if (suggestIdx === -1) {
        safeActions.push({ type: 'SUGGEST_OPTIONS', payload: { options: ['My orders', 'Find products'] } });
      } else {
        const act = safeActions[suggestIdx] as { type: 'SUGGEST_OPTIONS'; payload: { options: string[] } };
        const opts = [...act.payload.options];
        if (!opts.includes('My orders')) {
          opts.unshift('My orders');
        }
        if (!opts.includes('Find products')) {
          opts.push('Find products');
        }
        act.payload.options = opts;
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

