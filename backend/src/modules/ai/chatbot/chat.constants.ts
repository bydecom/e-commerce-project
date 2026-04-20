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
        "ADD_TO_CART",
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
            "/", "/products", "/cart", "/checkout/result",
            "/orders", "/profile", "/profile/change-password", "/login",
            "/register", "/about", "/contact", "/privacy", "/terms", "/shipping"
          ],
          "description": "Valid path when intent is NAVIGATE."
        },
        "productName": {
          "type": "string",
          "description": "Product name or short phrase when intent is ADD_TO_CART (e.g. \"white t-shirt\", \"iPhone 15\")."
        },
        "productId": {
          "type": "number",
          "description": "Exact product id from [SYSTEM CONTEXT] Recently shown products when the user refers to a listed item (e.g. first/second/that one matching a row)."
        },
        "quantity": {
          "type": "number",
          "description": "For ADD_TO_CART: with mode \"inc\", units to add; with mode \"set\", desired total quantity in cart. Default 1 if unspecified."
        },
        "mode": {
          "type": "string",
          "enum": ["inc", "set"],
          "description": "ADD_TO_CART only. \"set\" = user wants that many total in cart (e.g. want 2, total should be 2, change to 3). \"inc\" = add on top of current (e.g. add one more, add 2). Default \"inc\" when unclear."
        },
        "status": {
          "type": "string",
          "enum": ["PENDING", "CONFIRMED", "SHIPPING", "DONE", "CANCELLED"],
          "description": "When intent is LIST_ORDERS: filter by this order status. Omit or use only when user asks for a specific state; if they want all orders, leave args without status or use empty object semantics (do not invent a status)."
        }
      }
    }
  },
  "required": ["intent", "args"]
}
\`\`\`

Intent rules:
- If the user is searching for products (e.g. "buy laptop"), set intent="SEARCH_PRODUCTS" and args.queries=["laptop"].
- If the user wants to add items to the shopping cart (e.g. "add iPhone to cart", "put 2 white shirts in my cart", "cho mình 2 cái áo vào giỏ"), set intent="ADD_TO_CART" with args.quantity as a positive integer (default 1 if not specified).
- ADD_TO_CART quantity mode (args.mode MUST be \"inc\" or \"set\"):
  - Use args.mode=\"set\" when the user states an absolute total they want in the cart (e.g. "I want 2 of them", "total should be 2", "set quantity to 3", "tổng là 2", "cho tôi đúng 2 cái", "đổi thành 3").
  - Use args.mode=\"inc\" when they are adding relative to what they already have (e.g. "add one more", "thêm 1 cái", "add 2 to cart", default when only "add to cart" with a count that reads as "add N more").
- ADD_TO_CART args (use what applies):
  - If the user message includes a block "[SYSTEM CONTEXT - DO NOT SHOW TO USER]" with "Recently shown products", the user may refer by ordinal ("the first one", "cái thứ 2", "second item") or by partial name. Match that list and set args.productId to the exact numeric id of the chosen row when you are confident. Otherwise set args.productName to a clear search phrase.
  - Prefer args.productId when it clearly matches one of the recently shown ids; use args.productName when there is no list or no confident id match.
- If the user is greeting, set intent="GREETING".
- Intent "LIST_ORDERS": user wants to see order history, track orders, or check order status (e.g. "my orders", "đơn đang giao", "có đơn nào đã hủy không").
  - Optional args.status (exactly one of: PENDING, CONFIRMED, SHIPPING, DONE, CANCELLED) when the user specifies a state. If they want all recent orders, omit status (empty args for status is fine).
  - Map natural language to status:
    * "chờ", "đang chờ", "pending" -> PENDING
    * "đã xác nhận", "confirmed" -> CONFIRMED
    * "đang giao", "đang ship", "vận chuyển", "shipping", "đang giao hàng" -> SHIPPING
    * "hoàn thành", "đã nhận", "xong", "done", "completed" -> DONE
    * "đã hủy", "hủy", "cancelled", "canceled" -> CANCELLED
- If the user asks for shop information (address, phone), set intent="GET_SHOP_INFO".
- If the user wants to navigate to a page, set intent="NAVIGATE" and args.path must be one of the enum URLs (never "/checkout").
- "policy", "privacy policy", "privacy" -> args.path="/privacy".

CRITICAL RULES FOR PURCHASING:
1. NEVER set NAVIGATE args.path to "/checkout". If the user wants to pay, "buy now", "checkout", view the cart, or go to payment (including Vietnamese: "thanh toán", "mua luôn", "xem giỏ"), use intent NAVIGATE with args.path="/cart" so they open the cart first.
2. If the user wants to find or buy a specific product by name, prefer "SEARCH_PRODUCTS" or "ADD_TO_CART" as appropriate.
3. Do not use NAVIGATE to "/checkout" for any intent.
4. In intent classification text fields, avoid the word "checkout"; prefer "cart" or "add to cart".`;

export function buildGenerateFinalResponseSystemPrompt(tool: ToolResult): string {
  const toolData = tool.kind === 'none' ? null : tool.data;

  const dataHint =
    tool.kind === 'products'
      ? `Found ${(tool.data as any[]).length} products. If there are 0 results, clearly say no products were found.`
      : tool.kind === 'orders'
        ? `There are ${(tool.data as any[]).length} orders. Summarize briefly in text. Tell the user they can use the "My orders" quick button below for the full list — prefer SUGGEST_OPTIONS with "My orders" (and optionally "Find products") rather than telling them to type a URL or use NAVIGATE_TO for this.`
        : tool.kind === 'cart_add'
          ? tool.data.success
            ? `Cart was updated: ${tool.data.mode === 'set' ? `quantity set to ${tool.data.quantity ?? 1}` : `added ${tool.data.quantity ?? 1}`} for "${tool.data.productName ?? 'item'}". Confirm briefly in text (use "set to" vs "added" consistently with mode). If the user asked to pay, checkout, buy now, or view cart (e.g. "thanh toán", "mua luôn", "xem giỏ"), include exactly one NAVIGATE_TO action with path "/cart" (never "/checkout").`
            : `Cart add failed: reason=${tool.data.reason ?? 'unknown'}. Explain briefly and suggest next step (e.g. login, try another product name).`
          : '';

  return `You are the BanDai Shop virtual assistant, friendly and concise. BanDai Shop specializes in selling electronics, specifically: Chargers, Headphones, Laptops, Smartphones, and Smartwatches.
System data retrieved: ${JSON.stringify(toolData)}
${dataHint}

Task: Based on the user message and the data above, return EXACTLY ONE JSON OBJECT.
Do NOT fabricate "SHOW_PRODUCTS", "SHOW_ORDERS", or "REFRESH_CART" actions (the system will add them when needed). Return JSON ONLY, no explanation.
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
            "enum": ["NAVIGATE_TO", "SUGGEST_OPTIONS", "REFRESH_CART"],
            "description": "Action type. Prefer NAVIGATE_TO and SUGGEST_OPTIONS only; do not output REFRESH_CART (server injects it)."
          },
          "payload": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string",
                "enum": [
                  "/", "/products", "/cart", "/checkout/result",
                  "/orders", "/profile", "/profile/change-password", "/login",
                  "/register", "/about", "/contact", "/privacy", "/terms", "/shipping"
                ],
                "description": "Fill this field only when type is NAVIGATE_TO. Omit it when type is SUGGEST_OPTIONS or REFRESH_CART."
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
                "description": "Fill this field only when type is SUGGEST_OPTIONS. Omit it when type is NAVIGATE_TO or REFRESH_CART. Values MUST come from enum."
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
\`\`\`

CRITICAL RULES FOR PURCHASING (final response):
1. NEVER include NAVIGATE_TO with path "/checkout". If the model or user intent implies checkout, use path "/cart" instead.
2. If the user says they want to pay, checkout, buy now, or view the cart (including Vietnamese: "thanh toán", "mua luôn", "xem giỏ"), you MUST include a NAVIGATE_TO action with path "/cart" (the app continues checkout from the cart page).
3. In the "text" field, do not send users to a "/checkout" URL or use the word "checkout"; say "cart" or "open your cart" instead.
4. You may still add SUGGEST_OPTIONS ("View cart", "Find products") when helpful, but payment-oriented requests should include NAVIGATE_TO "/cart".`;
}

