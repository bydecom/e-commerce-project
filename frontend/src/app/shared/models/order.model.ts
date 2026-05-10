export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DONE' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface OrderItemLine {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
  isReviewed?: boolean;
}

export interface PaymentTransactionDetail {
  id: number;
  vnp_TxnRef: string;
  vnp_TransactionNo: string | null;
  vnp_Amount: number | null;
  vnp_BankCode: string | null;
  vnp_PayDate: string | null;
  vnp_ResponseCode: string | null;
  vnp_TransactionStatus: string | null;
  isSuccess: boolean;
  rawQuery: unknown;
  createdAt: string;
}

export interface OrderDetail {
  id: number;
  userId: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  shippingAddress: string;
  items: OrderItemLine[];
  createdAt: string;
  updatedAt: string;
  paymentTransactions: PaymentTransactionDetail[];
  user: { id: number; email: string; name: string | null };
}

export type OrderEventType = 'ORDER_STATUS_CHANGED' | 'PAYMENT_STATUS_CHANGED' | 'SYSTEM_LOG';

export interface OrderEvent {
  id: number;
  orderId: number;
  type: OrderEventType;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  changedById: number | null;
  changedByRole: 'USER' | 'ADMIN' | null;
  changedBy: { id: number; email: string; name: string | null } | null;
  createdAt: string;
}
