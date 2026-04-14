export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DONE' | 'CANCELLED';

export interface OrderItemLine {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
  isReviewed?: boolean;
}

export interface OrderDetail {
  id: number;
  userId: number;
  status: OrderStatus;
  total: number;
  shippingAddress: string;
  items: OrderItemLine[];
  createdAt: string;
  updatedAt: string;
  user: { id: number; email: string; name: string | null };
}
