import type { ChatBotResponse, ToolResult } from './chat.types';

export const FALLBACK_RESPONSE: ChatBotResponse = {
  text: 'Sorry, the system is busy right now. Please try again later!',
  actions: [
    {
      type: 'SUGGEST_OPTIONS',
      payload: { options: ['View cart', 'Find products', 'My orders'] },
    },
  ],
};

export const GREETING_RESPONSE: ChatBotResponse = {
  text: 'Hello! I am BanDai AI Assistant. I can help you find products or check your order information.',
  actions: [
    {
      type: 'SUGGEST_OPTIONS',
      payload: { options: ['View cart', 'Find products', 'My orders'] },
    },
  ],
};

// Valid route list (synced from frontend `app.routes.ts`).
export const VALID_PATHS = [
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

export const PATH_LABELS: Record<string, string> = {
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

export const EXTRACT_INTENT_SYSTEM_PROMPT = `You are the BanDai Shop virtual assistant, friendly and concise. BanDai Shop specializes in selling electronics, specifically: Chargers, Headphones, Laptops, Smartphones, and Smartwatches.
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

export function buildGenerateFinalResponseSystemPrompt(tool: ToolResult): string {
  const toolData = tool.kind === 'none' ? null : tool.data;

  const dataHint =
    tool.kind === 'products'
      ? `Found ${(tool.data as any[]).length} products. If there are 0 results, clearly say no products were found.`
      : tool.kind === 'orders'
        ? `There are ${(tool.data as any[]).length} orders.`
        : '';

  return `You are the BanDai Shop virtual assistant, friendly and concise. BanDai Shop specializes in selling electronics, specifically: Chargers, Headphones, Laptops, Smartphones, and Smartwatches.
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
}

