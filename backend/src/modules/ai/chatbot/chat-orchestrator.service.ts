import { prisma } from '../../../db';
import * as productService from '../../product/product.service';

export type ChatAction =
  | { type: 'NAVIGATE_TO'; payload: { path: string } }
  | { type: 'SUGGEST_OPTIONS'; payload: { options: string[] } }
  | { type: 'SHOW_ORDERS'; payload: { orders: Array<{ id: number; status: string; total: number; date: string }> } }
  | { type: 'SHOW_PRODUCTS'; payload: { products: Array<{ id: number; name: string; price: number; imageUrl: string | null }> } };

export type ChatBotResponse = {
  text: string;
  actions: ChatAction[];
};

type Intent = 'GET_SHOP_INFO' | 'NAVIGATE' | 'LIST_ORDERS' | 'SEARCH_PRODUCTS' | 'GREETING' | 'UNKNOWN';

type IntentResult = {
  intent: Intent;
  args: Record<string, unknown>;
};

type ToolResult =
  | { kind: 'shop'; data: { name: string | null; address: string | null; phone: string | null } | null }
  | { kind: 'orders'; data: Array<{ id: number; status: string; total: number; date: string }> }
  | { kind: 'products'; data: Array<{ id: number; name: string; price: number; imageUrl: string | null }> }
  | { kind: 'navigate'; data: { path: string } }
  | { kind: 'none'; data: null };

const FALLBACK_RESPONSE: ChatBotResponse = {
  text: 'Sorry, the system is busy right now. Please try again later!',
  actions: [
    {
      type: 'SUGGEST_OPTIONS',
      payload: { options: ['View cart', 'Find products', 'My orders'] },
    },
  ],
};

const GREETING_RESPONSE: ChatBotResponse = {
  text: 'Hello! I am BanDai AI Assistant. I can help you find products or check your order information.',
  actions: [
    {
      type: 'SUGGEST_OPTIONS',
      payload: { options: ['View cart', 'Find products', 'My orders'] },
    },
  ],
};

const LOCAL_LLM_URL = (process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1/chat/completions').trim();
const LOCAL_LLM_MODEL = (process.env.LOCAL_LLM_MODEL || 'mistral-7b-instruct').trim();

// Valid route list (synced from frontend `app.routes.ts`).
const VALID_PATHS = [
  '/',
  '/products',
  '/cart',
  '/checkout',
  '/checkout/result',
  '/orders',
  '/profile',
  '/profile/change-password',
  '/login',
  '/register',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/shipping',
] as const;

const PATH_LABELS: Record<string, string> = {
  '/': 'Home',
  '/products': 'Products',
  '/cart': 'Cart',
  '/checkout': 'Checkout',
  '/orders': 'Orders',
  '/profile': 'Profile',
  '/profile/change-password': 'Change password',
  '/login': 'Login',
  '/register': 'Register',
  '/about': 'About',
  '/contact': 'Contact',
  '/privacy': 'Privacy policy',
  '/terms': 'Terms of service',
  '/shipping': 'Shipping policy',
  '/checkout/result': 'Checkout result',
};

function cleanJsonResponse(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

async function callLocalJson(prompt: {
  system: string;
  user: string;
  temperature: number;
}): Promise<unknown> {
  const res = await fetch(LOCAL_LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LOCAL_LLM_MODEL,
      messages: [
        {
          role: 'user',
          content: `${prompt.system}\n\n---\n\nUser request:\n${prompt.user}`,
        },
      ],
      temperature: prompt.temperature,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Local LLM error: ${res.status} ${res.statusText} - ${errText}`);
  }

  const data = (await res.json()) as any;
  const raw = String(data?.choices?.[0]?.message?.content ?? '');
  return JSON.parse(cleanJsonResponse(raw));
}

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
    const systemPrompt = `You are the BanDai Shop virtual assistant, friendly and concise. BanDai Shop specializes in selling electronics, specifically: Chargers, Headphones, Laptops, Smartphones, and Smartwatches.
Your task is to analyze the user message and return EXACTLY ONE JSON OBJECT. Do NOT explain, and do NOT add extra text.

The output MUST strictly follow this JSON Schema. Pay special attention: values can only be selected from each "enum":

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "intent": {
      "type": "string",
      "enum": [
        "GET_SHOP_INFO",
        "NAVIGATE",
        "LIST_ORDERS",
        "SEARCH_PRODUCTS",
        "GREETING",
        "UNKNOWN"
      ],
      "description": "Classifies the user's intent."
    },
    "args": {
      "type": "object",
      "properties": {
        "queries": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Array of search keywords when intent is SEARCH_PRODUCTS."
        },
        "path": {
          "type": "string",
          "enum": [
            "/", "/products", "/cart", "/checkout", "/checkout/result",
            "/orders", "/profile", "/profile/change-password", "/login",
            "/register", "/about", "/contact", "/privacy", "/terms", "/shipping"
          ],
          "description": "Valid path when intent is NAVIGATE."
        }
      }
    }
  },
  "required": ["intent", "args"]
}
\`\`\`

Intent rules:
- If the user is searching for products (e.g. "buy laptop"), set intent="SEARCH_PRODUCTS" and args.queries=["laptop"].
- If the user is greeting, set intent="GREETING".
- If the user asks about order information, set intent="LIST_ORDERS".
- If the user asks for shop information (address, phone), set intent="GET_SHOP_INFO".
- If the user wants to navigate to a page, set intent="NAVIGATE" and args.path must be one of the enum URLs.
- "policy", "privacy policy", "privacy" -> args.path="/privacy".`;

    const parsed = (await callLocalJson({ system: systemPrompt, user: userMessage, temperature: 0.1 })) as any;
    const intent = typeof parsed?.intent === 'string' ? (parsed.intent as Intent) : 'UNKNOWN';
    const args = parsed?.args && typeof parsed.args === 'object' ? (parsed.args as Record<string, unknown>) : {};
    return { intent, args };
  } catch (err) {
    console.error('[ChatBot Local] Extract intent error:', err);
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
  const toolData = tool.kind === 'none' ? null : tool.data;

  const dataHint =
    tool.kind === 'products'
      ? `Found ${(tool.data as any[]).length} products. If there are 0 results, clearly say no products were found.`
      : tool.kind === 'orders'
        ? `There are ${(tool.data as any[]).length} orders.`
        : '';

  const systemPrompt = `You are the BanDai Shop virtual assistant, friendly and concise. BanDai Shop specializes in selling electronics, specifically: Chargers, Headphones, Laptops, Smartphones, and Smartwatches.
System data retrieved: ${JSON.stringify(toolData)}
${dataHint}

Task: Based on the user message and the data above, return EXACTLY ONE JSON OBJECT.
Do NOT fabricate "SHOW_PRODUCTS" or "SHOW_ORDERS" actions (the system will add them). Return JSON ONLY, no explanation.
The value of "text" MUST be in English.

🛑 CURRENCY RULE: When mentioning prices in the text, ALWAYS format them as Vietnamese Dong (e.g., "25,000,000 VND" or "25,000,000đ"). NEVER use the dollar sign ($) or the word "dollars".

The output MUST follow this JSON Schema (especially enum values):

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "Natural language answer in English based on system data. Prices MUST be in VND."
    },
    "actions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["NAVIGATE_TO", "SUGGEST_OPTIONS"],
            "description": "Action type. MUST be one of these two values."
          },
          "payload": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string",
                "enum": [
                  "/", "/products", "/cart", "/checkout", "/checkout/result",
                  "/orders", "/profile", "/profile/change-password", "/login",
                  "/register", "/about", "/contact", "/privacy", "/terms", "/shipping"
                ],
                "description": "Fill this field only when type is NAVIGATE_TO. Omit it when type is SUGGEST_OPTIONS."
              },
              "options": {
                "type": "array",
                "items": {
                  "type": "string",
                  "enum": [
                    "View cart",
                    "Find products",
                    "My orders"
                  ]
                },
                "description": "Fill this field only when type is SUGGEST_OPTIONS. Omit it when type is NAVIGATE_TO. Values MUST come from enum."
              }
            }
          }
        },
        "required": ["type", "payload"]
      }
    }
  },
  "required": ["text", "actions"]
}
\`\`\``;


  try {
    const parsed = (await callLocalJson({ system: systemPrompt, user: userMessage, temperature: 0.2 })) as any;
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
    console.error('[ChatBot Local] Generate final response error:', err);
    return { text: 'Sorry, the AI system is overloaded right now. Can I help you with anything else?', actions: [] };
  }
}

