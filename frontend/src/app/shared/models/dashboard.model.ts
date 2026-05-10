import type { OrderStatus } from './order.model';
import type { SentimentLabel } from './feedback.model';

export interface DashboardKeyMetrics {
  totalRevenue: number;
  totalOrders: number;
  activeProducts: number;
  totalCustomers: number;
  avgOrderValue: number;
  repeatCustomers: number;
  totalBuyers: number;
  avgProcessingDays: number;
  cancellationRate: number;
}

export interface DashboardPendingOrder {
  id: number;
  total: number;
  createdAt: string;
  user: { name: string | null; email: string };
}

export interface DashboardNegativeFeedback {
  id: number;
  rating: number;
  comment: string | null;
  sentiment: SentimentLabel | null;
  user: { name: string | null };
  product: { name: string };
}

export interface DashboardLowStockProduct {
  id: number;
  name: string;
  stock: number;
  price: number;
}

export interface DashboardActionRequired {
  pendingOrders: DashboardPendingOrder[];
  negativeFeedbacks: DashboardNegativeFeedback[];
  lowStockProducts: DashboardLowStockProduct[];
}

export interface DashboardSentimentDistribution {
  POSITIVE: number;
  NEUTRAL: number;
  NEGATIVE: number;
}

export interface DashboardOrderStatusItem {
  status: OrderStatus;
  count: number;
}

export interface DashboardRevenuePoint {
  date: string;
  revenue: number;
}

export interface DashboardRevenueComparison {
  mode: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  labels: string[];
  current: number[];
  previous: number[];
  summary: {
    currentTotal: number;
    prevTotal: number;
    changePercent: number | null;
  };
}

/** Count of feedback rows per star rating (1–5). */
export interface DashboardRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface DashboardTopCustomer {
  userId: number;
  name: string | null;
  email: string;
  totalSpent: number;
  orderCount: number;
}

export interface DashboardCharts {
  sentiment: DashboardSentimentDistribution;
  ratingDistribution: DashboardRatingDistribution;
  orderStatus: DashboardOrderStatusItem[];
  revenueLast7Days: DashboardRevenuePoint[];
  revenueComparison: DashboardRevenueComparison;
  topProducts: { name: string; qty: number }[];
  topCustomers: DashboardTopCustomer[];
  categoryBreakdown: { name: string; count: number }[];
}

export interface DashboardSummary {
  keyMetrics: DashboardKeyMetrics;
  actionRequired: DashboardActionRequired;
  charts: DashboardCharts;
}
