import { prisma } from '../../db';

/** Parsed query for dashboard PDF export (Express `req.query`). */
export interface DashboardPdfExportFilter {
  type?: string;
  month?: string;
  quarter?: string;
  year?: string;
  start?: string;
  end?: string;
}

function parseQuery(q: Record<string, unknown>): DashboardPdfExportFilter {
  const s = (v: unknown): string | undefined =>
    typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : undefined;
  return {
    type: s(q['type']),
    month: s(q['month']),
    quarter: s(q['quarter']),
    year: s(q['year']),
    start: s(q['start']),
    end: s(q['end']),
  };
}

/** Date range for PDF export: ALL (epoch → now), MONTH, QUARTER, YEAR, CUSTOM. */
export function getDateRangeForExport(f: DashboardPdfExportFilter): { gte: Date; lte: Date } {
  const now = new Date();
  const yearNum = f.year ? parseInt(f.year, 10) : now.getFullYear();
  const t = (f.type || 'ALL').toUpperCase();

  if (t === 'ALL') {
    return { gte: new Date(0), lte: now };
  }

  if (t === 'MONTH') {
    const m = f.month ? parseInt(f.month, 10) : now.getMonth() + 1;
    if (m < 1 || m > 12 || Number.isNaN(m)) throw new Error('Invalid month (1–12)');
    const y = Number.isNaN(yearNum) ? now.getFullYear() : yearNum;
    const gte = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const lte = new Date(y, m, 0, 23, 59, 59, 999);
    return { gte, lte };
  }

  if (t === 'QUARTER') {
    const q = f.quarter ? parseInt(f.quarter, 10) : Math.floor(now.getMonth() / 3) + 1;
    if (q < 1 || q > 4 || Number.isNaN(q)) throw new Error('Invalid quarter (1–4)');
    const y = Number.isNaN(yearNum) ? now.getFullYear() : yearNum;
    const gte = new Date(y, (q - 1) * 3, 1, 0, 0, 0, 0);
    const lte = new Date(y, q * 3, 0, 23, 59, 59, 999);
    return { gte, lte };
  }

  if (t === 'YEAR') {
    const y = f.year ? parseInt(f.year, 10) : now.getFullYear();
    if (Number.isNaN(y)) throw new Error('Invalid year');
    return {
      gte: new Date(y, 0, 1, 0, 0, 0, 0),
      lte: new Date(y, 11, 31, 23, 59, 59, 999),
    };
  }

  if (t === 'CUSTOM') {
    if (!f.start || !f.end) throw new Error('start and end are required for CUSTOM range');
    let gte = new Date(f.start);
    let lte = new Date(f.end);
    if (Number.isNaN(gte.getTime()) || Number.isNaN(lte.getTime())) {
      throw new Error('Invalid start or end date');
    }
    if (lte < gte) [gte, lte] = [lte, gte];
    if (f.start.length <= 10) gte.setHours(0, 0, 0, 0);
    if (f.end.length <= 10) lte.setHours(23, 59, 59, 999);
    return { gte, lte };
  }

  return { gte: new Date(0), lte: now };
}

export async function getExportData(query: Record<string, unknown>) {
  const f = parseQuery(query);
  const { gte, lte } = getDateRangeForExport(f);
  const dateWhere = { createdAt: { gte, lte } };
  const orderWhereDone = { ...dateWhere, status: 'DONE' as const };

  const [revenue, orders, feedbacks] = await Promise.all([
    prisma.order.aggregate({ where: orderWhereDone, _sum: { total: true } }),
    prisma.order.count({ where: orderWhereDone }),
    prisma.feedback.groupBy({
      where: { order: { createdAt: { gte, lte } } },
      by: ['sentiment'],
      _count: { _all: true },
    }),
  ]);

  return {
    revenue: revenue._sum.total || 0,
    orders,
    feedbacks: {
      positive: feedbacks.find((x) => x.sentiment === 'POSITIVE')?._count._all || 0,
      neutral: feedbacks.find((x) => x.sentiment === 'NEUTRAL')?._count._all || 0,
      negative: feedbacks.find((x) => x.sentiment === 'NEGATIVE')?._count._all || 0,
    },
    range: `${gte.toLocaleDateString('en-US')} – ${lte.toLocaleDateString('en-US')}`,
  };
}

export async function getDashboardSummary(query: Record<string, unknown> = {}) {
  const now = new Date();
  const rawMode = getQueryString(query, 'mode');
  const mode = (rawMode ?? 'WEEK').toUpperCase();

  let gte: Date;
  const lte = now;

  if (mode === 'MONTH') {
    gte = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (mode === 'QUARTER') {
    const q = Math.floor(now.getMonth() / 3);
    gte = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
  } else if (mode === 'YEAR') {
    gte = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  } else {
    // WEEK default: last 7 days (including today)
    gte = new Date(now.getTime() - 6 * 86400000);
    gte.setHours(0, 0, 0, 0);
  }

  const dateWhere = { createdAt: { gte, lte } };
  const doneWhere = { status: 'DONE' as const, ...dateWhere };

  const [
    revenueResult,
    totalOrders,
    activeProducts,
    totalCustomers,
    pendingOrders,
    negativeFeedbacks,
    lowStockProducts,
    sentimentGroup,
    orderStatusGroup,
    recentDoneOrders,
    ratingGroup,
    doneOrders,
    orderCountPerUser,
    topProductsRaw,
    categoryBreakdown,
    topCustomersRaw,
  ] = await Promise.all([
    prisma.order.aggregate({ where: doneWhere, _sum: { total: true } }),
    prisma.order.count({ where: dateWhere }),
    prisma.product.count({ where: { status: 'AVAILABLE' } }),
    prisma.user.count({ where: { role: 'USER' } }),

    prisma.order.findMany({
      where: { status: 'PENDING' },
      take: 5,
      orderBy: { id: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.feedback.findMany({
      where: { OR: [{ sentiment: 'NEGATIVE' }, { rating: { lte: 2 } }] },
      take: 5,
      orderBy: { id: 'desc' },
      include: { user: { select: { name: true } }, product: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { stock: { lt: 10 }, status: 'AVAILABLE' },
      take: 5,
      orderBy: { stock: 'asc' },
    }),

    prisma.feedback.groupBy({ by: ['sentiment'], where: { order: dateWhere }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['status'], where: dateWhere, _count: { _all: true } }),
    prisma.order.findMany({
      where: doneWhere,
      select: { total: true, createdAt: true },
    }),
    prisma.feedback.groupBy({ by: ['rating'], where: { order: dateWhere }, _count: { _all: true } }),

    prisma.order.findMany({ where: doneWhere, select: { total: true } }),
    prisma.order.groupBy({
      by: ['userId'],
      where: doneWhere,
      _count: { id: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: doneWhere },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.category.findMany({
      select: {
        name: true,
        _count: { select: { products: true } },
      },
      orderBy: { products: { _count: 'desc' } },
    }),
    prisma.order.groupBy({
      by: ['userId'],
      where: doneWhere,
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    }),
  ]);

  // Top customers: join userId → user info
  const topCustomerUserIds = topCustomersRaw.map((r) => r.userId);
  const topCustomerUsers =
    topCustomerUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: topCustomerUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userById = new Map(topCustomerUsers.map((u) => [u.id, u]));
  const topCustomers = topCustomersRaw.map((r) => ({
    userId: r.userId,
    name: userById.get(r.userId)?.name ?? null,
    email: userById.get(r.userId)?.email ?? '',
    totalSpent: r._sum.total ?? 0,
    orderCount: r._count.id,
  }));

  // Revenue comparison for the same global mode (current vs previous period)
  const revenueComparison = await getRevenueComparison({ mode });

  // Build revenue series for the selected mode, filling empty buckets with 0.
  const revenueMap: Record<string, number> = {};
  for (const o of recentDoneOrders) {
    let key: string;
    if (mode === 'YEAR' || mode === 'QUARTER') {
      key = o.createdAt.toLocaleString('en-US', { month: 'short' });
    } else if (mode === 'MONTH') {
      const d = o.createdAt.getDate();
      key = d <= 7 ? 'Week 1 (1-7)' : d <= 14 ? 'Week 2 (8-14)' : d <= 21 ? 'Week 3 (15-21)' : 'Week 4 (22+)';
    } else {
      key = o.createdAt.toISOString().split('T')[0];
    }
    revenueMap[key] = (revenueMap[key] ?? 0) + o.total;
  }

  let revenueLabels: string[] = [];
  if (mode === 'YEAR') {
    revenueLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  } else if (mode === 'QUARTER') {
    const q = Math.floor(now.getMonth() / 3);
    revenueLabels = [0, 1, 2].map((i) => new Date(now.getFullYear(), q * 3 + i, 1).toLocaleString('en-US', { month: 'short' }));
  } else if (mode === 'MONTH') {
    revenueLabels = ['Week 1 (1-7)', 'Week 2 (8-14)', 'Week 3 (15-21)', 'Week 4 (22+)'];
  } else {
    // WEEK => daily labels from gte..lte (inclusive by day)
    const start = new Date(gte);
    start.setHours(0, 0, 0, 0);
    const end = new Date(lte);
    end.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    revenueLabels = Array.from({ length: days }, (_, i) => {
      const d = new Date(start.getTime() + i * 86400000);
      return d.toISOString().split('T')[0];
    });
  }

  const avgOrderValue =
    doneOrders.length > 0
      ? Math.round(doneOrders.reduce((s, o) => s + o.total, 0) / doneOrders.length)
      : 0;
  const repeatCustomers = orderCountPerUser.filter((u) => u._count.id > 1).length;
  const totalBuyers = orderCountPerUser.length;

  const productIds = topProductsRaw.map((x) => x.productId);
  const productsForTop =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true },
        })
      : [];
  const nameById = new Map(productsForTop.map((p) => [p.id, p.name]));
  const topProducts = topProductsRaw.map((item) => ({
    name: nameById.get(item.productId) ?? 'Unknown',
    qty: item._sum.quantity ?? 0,
  }));

  return {
    keyMetrics: {
      totalRevenue: revenueResult._sum.total || 0,
      totalOrders,
      activeProducts,
      totalCustomers,
      avgOrderValue,
      repeatCustomers,
      totalBuyers,
    },
    actionRequired: { pendingOrders, negativeFeedbacks, lowStockProducts },
    charts: {
      sentiment: {
        POSITIVE: sentimentGroup.find((s) => s.sentiment === 'POSITIVE')?._count._all || 0,
        NEUTRAL: sentimentGroup.find((s) => s.sentiment === 'NEUTRAL')?._count._all || 0,
        NEGATIVE: sentimentGroup.find((s) => s.sentiment === 'NEGATIVE')?._count._all || 0,
      },
      ratingDistribution: {
        1: ratingGroup.find((r) => r.rating === 1)?._count._all || 0,
        2: ratingGroup.find((r) => r.rating === 2)?._count._all || 0,
        3: ratingGroup.find((r) => r.rating === 3)?._count._all || 0,
        4: ratingGroup.find((r) => r.rating === 4)?._count._all || 0,
        5: ratingGroup.find((r) => r.rating === 5)?._count._all || 0,
      },
      orderStatus: orderStatusGroup.map((g) => ({ status: g.status, count: g._count._all })),
      revenueLast7Days: revenueLabels.map((date) => ({ date, revenue: revenueMap[date] ?? 0 })),
      revenueComparison,
      topProducts,
      topCustomers,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        name: c.name,
        count: c._count.products,
      })),
    },
  };
}

export interface WeeklyStatsComparison {
  thisWeek: { revenue: number; orders: number };
  lastWeek: { revenue: number; orders: number };
}

/** 7 ngày gần nhất so với 7 ngày trước đó (đơn DONE cho doanh thu). */
export async function getWeeklyStatsComparison(): Promise<WeeklyStatsComparison> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [thisWeekRev, thisWeekOrders, lastWeekRev, lastWeekOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'DONE', createdAt: { gte: sevenDaysAgo, lte: now } },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: sevenDaysAgo, lte: now } },
    }),
    prisma.order.aggregate({
      where: { status: 'DONE', createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
  ]);

  return {
    thisWeek: { revenue: thisWeekRev._sum.total || 0, orders: thisWeekOrders },
    lastWeek: { revenue: lastWeekRev._sum.total || 0, orders: lastWeekOrders },
  };
}

export type RevenueComparisonMode = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export type RevenueComparisonDto = {
  mode: RevenueComparisonMode;
  labels: string[];
  current: number[];
  previous: number[];
  summary: {
    currentTotal: number;
    prevTotal: number;
    changePercent: number | null;
  };
};

function getQueryString(q: Record<string, unknown>, key: string): string | undefined {
  const v = q[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function getRevenueComparison(query: Record<string, unknown>): Promise<RevenueComparisonDto> {
  const rawMode = (getQueryString(query, 'mode') ?? 'WEEK').toUpperCase();
  const mode: RevenueComparisonMode =
    rawMode === 'MONTH' || rawMode === 'QUARTER' || rawMode === 'YEAR' ? (rawMode as RevenueComparisonMode) : 'WEEK';

  const now = new Date();

  let currentGte: Date;
  let currentLte: Date;
  let prevGte: Date;
  let prevLte: Date;
  let labels: string[] = [];

  if (mode === 'WEEK') {
    // Current: last 7 days (including today). Previous: 7 days right before that.
    const today = startOfDay(now);
    currentGte = new Date(today.getTime() - 6 * 86400000);
    currentLte = endOfDay(now);

    prevLte = new Date(currentGte.getTime() - 1);
    prevGte = new Date(startOfDay(prevLte).getTime() - 6 * 86400000);

    labels = Array.from({ length: 7 }, (_, i) => isoDate(new Date(currentGte.getTime() + i * 86400000)));
  } else if (mode === 'MONTH') {
    // Group by 4 fixed weeks: W4 absorbs day 22 to end-of-month.
    const y = now.getFullYear();
    const m = now.getMonth();
    currentGte = new Date(y, m, 1, 0, 0, 0, 0);
    currentLte = new Date(y, m + 1, 0, 23, 59, 59, 999);
    prevGte    = new Date(y, m - 1, 1, 0, 0, 0, 0);
    prevLte    = new Date(y, m, 0, 23, 59, 59, 999);

    labels = ['Week 1 (1-7)', 'Week 2 (8-14)', 'Week 3 (15-21)', 'Week 4 (22+)'];
  } else if (mode === 'QUARTER') {
    const y = now.getFullYear();
    const q = Math.floor(now.getMonth() / 3); // 0..3
    currentGte = new Date(y, q * 3, 1, 0, 0, 0, 0);
    currentLte = new Date(y, q * 3 + 3, 0, 23, 59, 59, 999);

    prevGte = new Date(y, (q - 1) * 3, 1, 0, 0, 0, 0);
    prevLte = new Date(y, q * 3, 0, 23, 59, 59, 999);

    labels = [0, 1, 2].map((i) =>
      new Date(y, q * 3 + i, 1).toLocaleString('en-US', { month: 'short' })
    );
  } else {
    // YEAR
    const y = now.getFullYear();
    currentGte = new Date(y, 0, 1, 0, 0, 0, 0);
    currentLte = new Date(y, 11, 31, 23, 59, 59, 999);

    prevGte = new Date(y - 1, 0, 1, 0, 0, 0, 0);
    prevLte = new Date(y - 1, 11, 31, 23, 59, 59, 999);

    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }

  const [currentOrders, prevOrders] = await Promise.all([
    prisma.order.findMany({
      where: { status: 'DONE', createdAt: { gte: currentGte, lte: currentLte } },
      select: { total: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { status: 'DONE', createdAt: { gte: prevGte, lte: prevLte } },
      select: { total: true, createdAt: true },
    }),
  ]);

  function groupByLabel(orders: { total: number; createdAt: Date }[], m: RevenueComparisonMode): Record<string, number> {
    const map: Record<string, number> = {};
    for (const o of orders) {
      let key: string;
      if (m === 'YEAR' || m === 'QUARTER') {
        key = o.createdAt.toLocaleString('en-US', { month: 'short' });
      } else if (m === 'MONTH') {
        const d = o.createdAt.getDate();
        key = d <= 7 ? 'Week 1 (1-7)' : d <= 14 ? 'Week 2 (8-14)' : d <= 21 ? 'Week 3 (15-21)' : 'Week 4 (22+)';
      } else {
        key = isoDate(o.createdAt);
      }
      map[key] = (map[key] ?? 0) + o.total;
    }
    return map;
  }

  const currentMap = groupByLabel(currentOrders, mode);
  const prevMap    = groupByLabel(prevOrders, mode);

  const currentTotal = currentOrders.reduce((s, o) => s + o.total, 0);
  const prevTotal = prevOrders.reduce((s, o) => s + o.total, 0);
  const changePercent =
    prevTotal > 0 ? Math.round((((currentTotal - prevTotal) / prevTotal) * 100) * 10) / 10 : null;

  return {
    mode,
    labels,
    current: labels.map((l) => currentMap[l] ?? 0),
    previous: labels.map((l) => prevMap[l] ?? 0),
    summary: { currentTotal, prevTotal, changePercent },
  };
}
