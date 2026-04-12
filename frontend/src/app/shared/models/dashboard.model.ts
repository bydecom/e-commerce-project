import type { OrderStatus } from './order.model';
import type { SentimentLabel } from './feedback.model';

export interface DashboardKeyMetrics {
  totalRevenue: number;
  totalOrders: number;
  activeProducts: number;
  totalCustomers: number;
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

export interface DashboardCharts {
  sentiment: DashboardSentimentDistribution;
  orderStatus: DashboardOrderStatusItem[];
  revenueLast7Days: DashboardRevenuePoint[];
}

export interface DashboardSummary {
  keyMetrics: DashboardKeyMetrics;
  actionRequired: DashboardActionRequired;
  charts: DashboardCharts;
}
