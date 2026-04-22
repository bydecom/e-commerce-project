export type ChatAction =
  | { type: 'NAVIGATE_TO'; payload: { path: string } }
  | { type: 'SUGGEST_OPTIONS'; payload: { options: string[] } }
  | { type: 'SHOW_ORDERS'; payload: { orders: Array<{ id: number; status: string; total: number; date: string }> } }
  | { type: 'SHOW_PRODUCTS'; payload: { products: Array<{ id: number; name: string; price: number; imageUrl: string | null }> } }
  | { type: 'REFRESH_CART' }
  | { type: 'SUGGEST_PROMPTS'; payload: { prompts: string[] } };

export type ChatBotResponse = {
  text: string;
  actions: ChatAction[];
};

/** FE gửi kèm turn chat để giải quyết đại từ (vd. "cái đầu tiên") khớp sản phẩm vừa hiển thị. */
export type ChatShownProductRef = { id: number; name: string };

export type ChatTurnContext = {
  lastShownProducts?: ChatShownProductRef[];
};

export type Intent =
  | 'GET_SHOP_INFO'
  | 'NAVIGATE'
  | 'LIST_ORDERS'
  | 'SEARCH_PRODUCTS'
  | 'ADD_TO_CART'
  | 'GREETING'
  | 'UNKNOWN';

export type IntentResult = {
  intent: Intent;
  args: Record<string, unknown>;
};

export type ToolResult =
  | { kind: 'shop'; data: { name: string | null; address: string | null; phone: string | null } | null }
  | { kind: 'orders'; data: Array<{ id: number; status: string; total: number; date: string }> }
  | { kind: 'products'; data: Array<{ id: number; name: string; price: number; imageUrl: string | null }> }
  | { kind: 'navigate'; data: { path: string } }
  | {
      kind: 'cart_add';
      data: {
        success: boolean;
        reason?: 'unauthorized' | 'not_found' | 'missing_info' | 'insufficient_stock';
        productName?: string;
        quantity?: number;
        /** How quantity was applied: relative add vs absolute line quantity. */
        mode?: 'inc' | 'set';
      };
    }
  | { kind: 'none'; data: null };

