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

export async function getDashboardSummary() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

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
  ] = await Promise.all([
    prisma.order.aggregate({ where: { status: 'DONE' }, _sum: { total: true } }),
    prisma.order.count(),
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

    prisma.feedback.groupBy({ by: ['sentiment'], _count: { _all: true } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.findMany({
      where: { status: 'DONE', createdAt: { gte: sevenDaysAgo } },
      select: { total: true, createdAt: true },
    }),
    prisma.feedback.groupBy({ by: ['rating'], _count: { _all: true } }),

    prisma.order.findMany({ where: { status: 'DONE' }, select: { total: true } }),
    prisma.order.groupBy({
      by: ['userId'],
      where: { status: 'DONE' },
      _count: { id: true },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
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
  ]);

  const revenueByDate: Record<string, number> = {};
  recentDoneOrders.forEach((o) => {
    const d = o.createdAt.toISOString().split('T')[0];
    revenueByDate[d] = (revenueByDate[d] || 0) + o.total;
  });

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
      revenueLast7Days: Object.entries(revenueByDate).map(([date, revenue]) => ({ date, revenue })),
      topProducts,
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
