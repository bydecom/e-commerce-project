export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface FeedbackType {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface Feedback {
  id: number;
  userId: number;
  productId: number;
  orderId: number;
  typeId: number;
  rating: number;
  comment?: string | null;
  sentiment?: SentimentLabel | null;
}
