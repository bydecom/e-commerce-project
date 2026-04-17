export type ChatAction =
  | { type: 'NAVIGATE_TO'; payload: { path: string } }
  | { type: 'SUGGEST_OPTIONS'; payload: { options: string[] } }
  | { type: 'SHOW_ORDERS'; payload: { orders: Array<{ id: number; status: string; total: number; date: string }> } }
  | { type: 'SHOW_PRODUCTS'; payload: { products: Array<{ id: number; name: string; price: number; imageUrl: string | null }> } };

export type ChatBotResponse = {
  text: string;
  actions: ChatAction[];
};

export type Intent =
  | 'GET_SHOP_INFO'
  | 'NAVIGATE'
  | 'LIST_ORDERS'
  | 'SEARCH_PRODUCTS'
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
  | { kind: 'none'; data: null };

