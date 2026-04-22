import { prisma } from '../../../db';
import { getDashboardSummary } from '../../dashboard/dashboard.service';
import * as orderService from '../../order/order.service';
import * as productService from '../../product/product.service';
import { getAIProvider } from '../providers/ai.factory';
import type { ChatBotResponse } from './chat.types';

async function getAI() {
  return await getAIProvider();
}

type AdminIntent =
  | 'GET_SUMMARY'
  | 'GET_REVENUE'
  | 'GET_ORDERS'
  | 'GET_CUSTOMERS'
  | 'GET_PRODUCTS'
  | 'GET_ALERTS'
  | 'GET_ORDER_DETAIL'
  | 'GET_PRODUCT_DETAIL'
  | 'GREETING'
  | 'UNKNOWN';

type AdminMode = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

type AdminIntentResult = {
  intent: AdminIntent;
  mode: AdminMode;
  args: Record<string, unknown>;
};

type AdminToolResult =
  | { kind: 'summary'; data: object }
  | { kind: 'revenue'; data: object }
  | { kind: 'orders'; data: object }
  | { kind: 'customers'; data: object }
  | { kind: 'products'; data: object }
  | { kind: 'alerts'; data: object }
  | { kind: 'order_detail'; data: object | null }
  | { kind: 'product_detail'; data: object | null }
  | { kind: 'none'; data: null };

type AdminAction =
  | { type: 'NAVIGATE_TO'; payload: { path: string } }
  | { type: 'SUGGEST_PROMPTS'; payload: { prompts: string[] } };

const ADMIN_VALID_PATHS = [
  '/admin/dashboard',
  '/admin/orders',
  '/admin/products',
  '/admin/users',
  '/admin/categories',
  '/admin/feedbacks',
  '/admin/settings',
  '/admin/system-logs',
] as const;

const SUGGEST_PROMPTS_MAP: Partial<Record<AdminToolResult['kind'], string[]>> = {
  summary:        ['Today revenue', 'Pending orders', 'Alerts'],
  revenue:        ['Compare vs last month', 'Top-selling products', 'VIP customers'],
  orders:         ['Order details', 'This week revenue', 'Alerts to review'],
  customers:      ['Top VIP customers', 'Revenue by month'],
  products:       ['Best-selling product', 'Low stock'],
  alerts:         ['View pending orders', 'Low-stock products'],
  order_detail:   ['View all orders', 'Today revenue'],
  product_detail: ['Best-selling product', 'Low stock'],
};

// ─── Prompts ──────────────────────────────────────────────────────────────────

const ADMIN_EXTRACT_INTENT_PROMPT = `
You are an intent extraction engine for an Admin Dashboard Chatbot of an electronics e-commerce store.
Analyze the admin's input and extract the intent and time mode.

Possible intents:
- "GET_SUMMARY": Admin wants overall statistics, dashboard overview, general report, combined metrics.
- "GET_REVENUE": Admin asks specifically about revenue, sales, income, money earned, conversion rate.
- "GET_ORDERS": Admin asks specifically about orders, order counts, order statuses, pending orders.
- "GET_CUSTOMERS": Admin asks about customers, users, buyers, repeat customers, top spenders.
- "GET_PRODUCTS": Admin asks about products, inventory, stock, low stock, top-selling items, categories.
- "GET_ALERTS": Admin asks about pending issues, alerts, warnings, negative feedbacks, low stock alerts, urgent tasks.
- "GET_ORDER_DETAIL": Admin asks about a specific order by ID (e.g. "order #123", "order 456").
- "GET_PRODUCT_DETAIL": Admin asks about a specific product by name or ID.
- "GREETING": General greetings (hello, hi, hey).
- "UNKNOWN": Anything else not related to store management.

Time mode — extract from the message:
- "TODAY": today
- "WEEK": this week (default if not mentioned)
- "MONTH": this month
- "QUARTER": this quarter
- "YEAR": this year

Optional args:
- "orderId": number — when intent is GET_ORDER_DETAIL
- "productName": string — when intent is GET_PRODUCT_DETAIL
- "productId": number — when intent is GET_PRODUCT_DETAIL

Return ONLY valid JSON:
{ "intent": "INTENT_NAME", "mode": "WEEK", "args": {} }
`.trim();

const PERIOD_LABEL: Record<AdminMode, string> = {
  TODAY:   'today',
  WEEK:    'the last 7 days',
  MONTH:   'this month',
  QUARTER: 'this quarter',
  YEAR:    'this year',
};

function buildAdminResponsePrompt(toolResult: AdminToolResult, mode: AdminMode): string {
  return `
You are the BanDai Store Admin Assistant. You support the admin with data-driven answers.
Data retrieved from the database for the period: ${PERIOD_LABEL[mode]}.
Respond in English. Be concise, professional, and format numbers clearly.
Currency must always be in VND with dot-separated thousands (e.g. 1.500.000 VND).
Use bullet points for lists. Do NOT fabricate any data outside what is provided below.

If the admin's message clearly implies they want to NAVIGATE to a management page, include "navigateTo" with the correct path.
Valid paths: ${ADMIN_VALID_PATHS.join(', ')}
Only include "navigateTo" when clearly needed (e.g. "open orders page", "go to product list"). Omit it otherwise.

System Data:
${JSON.stringify(toolResult.data, null, 2)}

Return ONLY valid JSON: { "text": "Your English response here", "navigateTo": "/admin/orders" }
The "navigateTo" field is optional — omit it if not needed.
`.trim();
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function processAdminChat(adminId: number, message: string): Promise<ChatBotResponse> {
  try {
    // Fast-path greeting (does not spend AI quota).
    const lower = message.toLowerCase();
    if (
      lower.includes('hello') ||
      lower === 'hi' ||
      lower.includes('hey')
    ) {
      return buildGreetingResponse();
    }

    // Step 1: Extract intent (+ mode, args)
    const intentResult = await extractAdminIntent(message);

    if (intentResult.intent === 'GREETING') return buildGreetingResponse();

    if (intentResult.intent === 'UNKNOWN') {
      return {
        text: "I can only help with store admin data like revenue, orders, customers, products, and alerts. Please ask about one of those.",
        actions: [],
      };
    }

    // Step 2: Tool calls by intent (avoid loading unnecessary data)
    const toolResult = await runAdminTools(intentResult);

    // Step 3: Generate an answer from real data (return full ChatBotResponse with actions)
    return await generateAdminResponse(message, toolResult, intentResult.mode);
  } catch (error) {
    console.error('[AdminChatBot] Error:', error);
    return {
      text: 'Sorry, the AI system is having an issue. Please try again later.',
      actions: [],
    };
  }
}

// ─── Step 1: Extract Intent ───────────────────────────────────────────────────

async function extractAdminIntent(message: string): Promise<AdminIntentResult> {
  try {
    const parsed = (await (await getAI()).generateJson({
      system: ADMIN_EXTRACT_INTENT_PROMPT,
      user: message,
      temperature: 0.1,
    })) as { intent?: string; mode?: string; args?: Record<string, unknown> };

    const intent = typeof parsed?.intent === 'string' ? (parsed.intent as AdminIntent) : 'UNKNOWN';
    const mode = typeof parsed?.mode === 'string' ? (parsed.mode as AdminMode) : 'WEEK';
    const args =
      parsed?.args && typeof parsed.args === 'object' && !Array.isArray(parsed.args) ? parsed.args : {};

    return { intent, mode: mode || 'WEEK', args };
  } catch (err) {
    console.error('[AdminChatBot] Extract intent error:', err);
    return { intent: 'UNKNOWN', mode: 'WEEK', args: {} };
  }
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

async function getTodaySummary() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const where = {
    createdAt: { gte: startOfToday, lte: endOfToday },
  };

  const [todayOrders, pendingOrders, lowStockProducts] = await Promise.all([
    // Total orders + revenue today
    prisma.order.aggregate({
      where: { ...where, status: { not: 'CANCELLED' } },
      _count: { id: true },
      _sum: { total: true },
    }),
    // Pending orders (not filtered by day — pending is backlog)
    prisma.order.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        total: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    // Low-stock products
    prisma.product.findMany({
      where: { status: 'AVAILABLE', stock: { lte: 5 } },
      orderBy: { stock: 'asc' },
      take: 5,
      select: { id: true, name: true, stock: true, price: true },
    }),
  ]);

  // Breakdown of today's order statuses
  const orderStatusBreakdown = await prisma.order.groupBy({
    by: ['status'],
    where,
    _count: { id: true },
  });

  // New customers registered today
  const newCustomers = await prisma.user.count({
    where: { createdAt: { gte: startOfToday, lte: endOfToday } },
  });

  return {
    period: 'TODAY',
    date: startOfToday.toLocaleDateString('en-US'),
    revenue: {
      total: todayOrders._sum.total ?? 0,
      orderCount: todayOrders._count.id,
    },
    orderStatusBreakdown: orderStatusBreakdown.map((s) => ({
      status: s.status,
      count: s._count.id,
    })),
    pendingOrders: pendingOrders.map((o) => ({
      id: o.id,
      total: o.total,
      customer: o.user?.name ?? null,
      date: o.createdAt.toISOString(),
    })),
    newCustomers,
    lowStockProducts,
  };
}

// ─── Step 2: Tool Calls ───────────────────────────────────────────────────────

async function runAdminTools(intentResult: AdminIntentResult): Promise<AdminToolResult> {
  const { intent, mode, args } = intentResult;
  const dashboardMode = mode as 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

  switch (intent) {
    case 'GET_SUMMARY': {
      if (mode === 'TODAY') {
        const today = await getTodaySummary();
        return { kind: 'summary', data: today };
      }
      const summary = await getDashboardSummary({ mode: dashboardMode });
      return {
        kind: 'summary',
        data: {
          keyMetrics: summary.keyMetrics,
          revenueComparison: summary.charts.revenueComparison,
          orderStatus: summary.charts.orderStatus,
          topProducts: summary.charts.topProducts.slice(0, 5),
        },
      };
    }

    case 'GET_REVENUE': {
      if (mode === 'TODAY') {
        const today = await getTodaySummary();
        return {
          kind: 'revenue',
          data: {
            totalRevenue: today.revenue.total,
            totalOrders: today.revenue.orderCount,
            orderBreakdown: today.orderStatusBreakdown,
            date: today.date,
          },
        };
      }

      const summary = await getDashboardSummary({ mode: dashboardMode });
      return {
        kind: 'revenue',
        data: {
          totalRevenue: summary.keyMetrics.totalRevenue,
          avgOrderValue: summary.keyMetrics.avgOrderValue,
          totalOrders: summary.keyMetrics.totalOrders,
          revenueComparison: summary.charts.revenueComparison,
          revenueSeries: summary.charts.revenueLast7Days,
        },
      };
    }

    case 'GET_ORDERS': {
      if (mode === 'TODAY') {
        const today = await getTodaySummary();
        return {
          kind: 'orders',
          data: {
            totalOrdersToday: today.revenue.orderCount,
            orderStatusBreakdown: today.orderStatusBreakdown,
            pendingCount: today.pendingOrders.length,
            recentPendingOrders: today.pendingOrders,
          },
        };
      }

      const summary = await getDashboardSummary({ mode: dashboardMode });

      const pendingOrders = await prisma.order.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          total: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      });

      return {
        kind: 'orders',
        data: {
          totalOrders: summary.keyMetrics.totalOrders,
          orderStatus: summary.charts.orderStatus,
          pendingCount: summary.actionRequired.pendingOrders.length,
          recentPendingOrders: pendingOrders.map((o) => ({
            id: o.id,
            total: o.total,
            customer: o.user?.name ?? null,
            date: o.createdAt.toISOString(),
          })),
        },
      };
    }

    case 'GET_CUSTOMERS': {
      if (mode === 'TODAY') {
        const today = await getTodaySummary();
        return {
          kind: 'customers',
          data: {
            newCustomersToday: today.newCustomers,
            date: today.date,
          },
        };
      }

      const summary = await getDashboardSummary({ mode: dashboardMode });
      return {
        kind: 'customers',
        data: {
          totalCustomers: summary.keyMetrics.totalCustomers,
          totalBuyers: summary.keyMetrics.totalBuyers,
          repeatCustomers: summary.keyMetrics.repeatCustomers,
          topCustomers: summary.charts.topCustomers.slice(0, 5),
        },
      };
    }

    case 'GET_PRODUCTS': {
      if (mode === 'TODAY') {
        const today = await getTodaySummary();
        return {
          kind: 'products',
          data: {
            lowStockCount: today.lowStockProducts.length,
            lowStockProducts: today.lowStockProducts,
          },
        };
      }

      const summary = await getDashboardSummary({ mode: dashboardMode });

      const lowStockProducts = await prisma.product.findMany({
        where: { status: 'AVAILABLE', stock: { lte: 5 } },
        orderBy: { stock: 'asc' },
        take: 10,
        select: { id: true, name: true, stock: true, price: true },
      });

      return {
        kind: 'products',
        data: {
          activeProducts: summary.keyMetrics.activeProducts,
          topProducts: summary.charts.topProducts.slice(0, 5),
          categoryBreakdown: summary.charts.categoryBreakdown,
          lowStockCount: lowStockProducts.length,
          lowStockProducts,
        },
      };
    }

    case 'GET_ALERTS': {
      // Alerts are always real-time, independent of mode
      const [summary, lowStockProducts] = await Promise.all([
        getDashboardSummary({ mode: 'WEEK' }),
        prisma.product.findMany({
          where: { status: 'AVAILABLE', stock: { lte: 5 } },
          orderBy: { stock: 'asc' },
          take: 5,
          select: { id: true, name: true, stock: true },
        }),
      ]);
      return {
        kind: 'alerts',
        data: {
          pendingOrdersCount: summary.actionRequired.pendingOrders.length,
          negativeFeedbacksCount: summary.actionRequired.negativeFeedbacks.length,
          lowStockProductsCount: lowStockProducts.length,
          sentimentBreakdown: summary.charts.sentiment,
          topPendingOrders: summary.actionRequired.pendingOrders.slice(0, 3),
          topNegativeFeedbacks: summary.actionRequired.negativeFeedbacks.slice(0, 3),
          topLowStockProducts: lowStockProducts,
        },
      };
    }

    case 'GET_ORDER_DETAIL': {
      const orderId = parsePositiveIntArg(args['orderId']);
      if (!orderId) {
        return { kind: 'order_detail', data: { error: 'Could not find an order ID in the question.' } };
      }

      try {
        const order = await orderService.getAdminOrder(orderId);
        return { kind: 'order_detail', data: order };
      } catch (e) {
        const status =
          e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status) : 0;
        if (status === 404) {
          return { kind: 'order_detail', data: { error: `Order #${orderId} was not found.` } };
        }
        throw e;
      }
    }

    case 'GET_PRODUCT_DETAIL': {
      const productId = parsePositiveIntArg(args['productId']);
      const productName = typeof args['productName'] === 'string' ? args['productName'].trim() : '';

      if (productId) {
        try {
          const p = await productService.getProductById(productId);
          return { kind: 'product_detail', data: p };
        } catch (e) {
          const status =
            e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status) : 0;
          if (status === 404) {
            return { kind: 'product_detail', data: { error: `Product #${productId} was not found.` } };
          }
          // Redis or other error → fall back to direct Prisma query
          console.warn('[AdminChatBot] getProductById failed, falling back to prisma:', e);
          const p = await prisma.product.findUnique({
            where: { id: productId },
            include: { category: { select: { id: true, name: true } } },
          });
          if (!p) {
            return { kind: 'product_detail', data: { error: `Product #${productId} was not found.` } };
          }
          return {
            kind: 'product_detail',
            data: {
              id: p.id,
              name: p.name,
              description: p.description,
              price: p.price,
              stock: p.stock,
              status: p.status,
              imageUrl: p.imageUrl,
              category: p.category,
            },
          };
        }
      }

      if (productName) {
        const p = await prisma.product.findFirst({
          where: { name: { contains: productName, mode: 'insensitive' } },
          include: { category: { select: { id: true, name: true } } },
        });
        if (!p) {
          return { kind: 'product_detail', data: { error: `Product "${productName}" was not found.` } };
        }
        return {
          kind: 'product_detail',
          data: {
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            stock: p.stock,
            status: p.status,
            imageUrl: p.imageUrl,
            category: p.category,
          },
        };
      }

      return { kind: 'product_detail', data: { error: 'Could not find a product ID or product name in the question.' } };
    }

    default:
      return { kind: 'none', data: null };
  }
}

// ─── Step 3: Generate Response ────────────────────────────────────────────────

async function generateAdminResponse(
  message: string,
  toolResult: AdminToolResult,
  mode: AdminMode,
): Promise<ChatBotResponse> {
  if (toolResult.kind === 'none') {
    return {
      text: "I couldn't find relevant information. Try asking about revenue, orders, customers, products, or alerts.",
      actions: [],
    };
  }

  try {
    const finalRes = (await (await getAI()).generateJson({
      system: buildAdminResponsePrompt(toolResult, mode),
      user: message,
      temperature: 0.2,
    })) as { text?: string; navigateTo?: string };

    const actions: AdminAction[] = [];

    // Validate the LLM-provided path — disallow non-whitelisted paths
    if (
      typeof finalRes?.navigateTo === 'string' &&
      (ADMIN_VALID_PATHS as readonly string[]).includes(finalRes.navigateTo)
    ) {
      actions.push({ type: 'NAVIGATE_TO', payload: { path: finalRes.navigateTo } });
    }

    // Suggest follow-up prompts based on the tool that was executed
    const prompts = SUGGEST_PROMPTS_MAP[toolResult.kind];
    if (prompts && prompts.length > 0) {
      actions.push({ type: 'SUGGEST_PROMPTS', payload: { prompts } });
    }

    return {
      text: finalRes?.text || "I couldn't retrieve that information right now. Please try again later.",
      actions,
    };
  } catch (err) {
    console.error('[AdminChatBot] Generate response error:', err);
    return {
      text: 'Sorry, the AI is busy processing. Please try again later.',
      actions: [],
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildGreetingResponse(): ChatBotResponse {
  return {
    text: 'Hello! I can report revenue, orders, customers, products, and alerts that need attention. What would you like to check?',
    actions: [],
  };
}
