export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface Feedback {
  id: number;
  userId: number;
  productId: number;
  orderId: number;
  rating: number;
  comment?: string | null;
  sentiment?: SentimentLabel | null;
}
