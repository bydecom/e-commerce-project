import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyVndPipe } from '../../pipes/currency-vnd.pipe';
import type { Product } from '../../models/product.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
}
