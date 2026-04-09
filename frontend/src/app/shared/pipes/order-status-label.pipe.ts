import { Pipe, PipeTransform } from '@angular/core';
import type { OrderStatus } from '../models/order.model';

const LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  SHIPPING: 'Shipping',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

@Pipe({ name: 'orderStatusLabel', standalone: true })
export class OrderStatusLabelPipe implements PipeTransform {
  transform(value: OrderStatus | null | undefined): string {
    if (!value) {
      return '—';
    }
    return LABELS[value] ?? value;
  }
}
