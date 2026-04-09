import { NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { OrderStatus } from '../../models/order.model';
import { OrderStatusLabelPipe } from '../../pipes/order-status-label.pipe';

@Component({
  selector: 'app-order-status-badge',
  standalone: true,
  imports: [NgClass, OrderStatusLabelPipe],
  templateUrl: './order-status-badge.component.html',
  styleUrl: './order-status-badge.component.scss',
})
export class OrderStatusBadgeComponent {
  @Input({ required: true }) status!: OrderStatus;
}
