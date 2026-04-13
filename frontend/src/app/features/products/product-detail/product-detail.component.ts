import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CartService } from '../../../core/services/cart.service';
import { ProductApiService } from '../../../core/services/product-api.service';
import { CurrencyVndPipe } from '../../../shared/pipes/currency-vnd.pipe';
import type { Product } from '../../../shared/models/product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ProductApiService);
  private readonly cart = inject(CartService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly product = signal<Product | null>(null);
  readonly cartHint = signal(false);

  private sub: Subscription;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.sub = this.route.paramMap
      .pipe(
        switchMap((pm) => {
          const raw = pm.get('id');
          const id = raw !== null ? parseInt(raw, 10) : NaN;
          if (Number.isNaN(id)) {
            this.loading.set(false);
            this.error.set('Invalid product link.');
            this.product.set(null);
            return EMPTY;
          }
          this.loading.set(true);
          this.error.set(null);
          this.product.set(null);
          return this.api.getById(id);
        })
      )
      .subscribe({
        next: (p) => {
          this.product.set(p);
          this.loading.set(false);
          if (p.status !== 'AVAILABLE') {
            this.error.set('This product is not available for purchase right now.');
            this.product.set(null);
          }
        },
        error: (e: Error) => {
          this.error.set(e.message ?? 'Product not found');
          this.loading.set(false);
          this.product.set(null);
        },
      });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.hintTimer) clearTimeout(this.hintTimer);
  }

  addToCart(p: Product): void {
    if (p.stock <= 0) return;
    this.cart.add({
      productId: p.id,
      quantity: 1,
      unitPrice: p.price,
      name: p.name,
    });
    this.cartHint.set(true);
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (isPlatformBrowser(this.platformId)) {
      this.hintTimer = setTimeout(() => {
        this.cartHint.set(false);
        this.hintTimer = null;
      }, 2500);
    }
  }
}
