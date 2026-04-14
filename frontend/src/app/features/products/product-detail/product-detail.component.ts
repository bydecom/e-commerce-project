import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { ServerCartService } from '../../../core/services/server-cart.service';
import { ProductApiService } from '../../../core/services/product-api.service';
import { CurrencyVndPipe } from '../../../shared/pipes/currency-vnd.pipe';
import type { Product } from '../../../shared/models/product.model';
import { environment } from '../../../../environments/environment';
import type { ApiSuccess } from '../../../shared/models/api-response.model';

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
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly serverCart = inject(ServerCartService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly product = signal<Product | null>(null);
  readonly cartHint = signal(false);
  readonly cartError = signal<string | null>(null);
  /** Quantity to add on the next "Add to cart" action (clamped to stock). */
  readonly addQuantity = signal(1);

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
          this.addQuantity.set(1);
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

  decrementAddQuantity(p: Product): void {
    if (p.stock <= 0) return;
    const next = Math.max(1, this.addQuantity() - 1);
    this.addQuantity.set(next);
  }

  incrementAddQuantity(p: Product): void {
    if (p.stock <= 0) return;
    const next = Math.min(p.stock, this.addQuantity() + 1);
    this.addQuantity.set(next);
  }

  addToCart(p: Product): void {
    if (p.stock <= 0) return;

    const qty = Math.min(p.stock, Math.max(1, this.addQuantity()));

    // Server cart is now the source of truth for `/cart`.
    // If user is not logged in, redirect to login (backend requires JWT).
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.cartError.set(null);
    this.http
      .put<ApiSuccess<unknown>>(`${environment.apiUrl}/api/cart/items/${p.id}`, {
        quantity: qty,
        name: p.name,
      })
      .subscribe({
        next: () => {
          // Keep local cart in sync with existing navbar badge for now.
          this.cart.add({
            productId: p.id,
            quantity: qty,
            unitPrice: p.price,
            name: p.name,
          });
          this.addQuantity.set(1);
          this.serverCart.refresh().subscribe();
          this.cartHint.set(true);
          if (this.hintTimer) clearTimeout(this.hintTimer);
          if (isPlatformBrowser(this.platformId)) {
            this.hintTimer = setTimeout(() => {
              this.cartHint.set(false);
              this.hintTimer = null;
            }, 2500);
          }
        },
        error: (e: Error) => {
          this.cartError.set(e.message ?? 'Failed to add to cart');
        },
      });
  }
}
