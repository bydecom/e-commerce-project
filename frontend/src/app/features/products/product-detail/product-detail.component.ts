import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ServerCartService } from '../../../core/services/server-cart.service';
import { ProductApiService, type ProductFeedbackDto } from '../../../core/services/product-api.service';
import { CurrencyVndPipe } from '../../../shared/pipes/currency-vnd.pipe';
import type { Product } from '../../../shared/models/product.model';
import { environment } from '../../../../environments/environment';
import type { ApiSuccess } from '../../../shared/models/api-response.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, CurrencyVndPipe, FormsModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ProductApiService);
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
  readonly addingToCart = signal(false);

  quantity = signal(1);

  readonly qtyInCart = computed(() => {
    const p = this.product();
    if (!p) return 0;
    const item = this.serverCart.items().find((i) => i.productId === p.id);
    return item ? item.quantity : 0;
  });

  readonly availableRoom = computed(() => {
    const p = this.product();
    if (!p) return 0;
    const room = p.stock - this.qtyInCart();
    return room > 0 ? room : 0;
  });

  private sub!: Subscription;
  private feedbackSub: Subscription | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;

  readonly feedbackLoading = signal(false);
  readonly feedbackError = signal<string | null>(null);
  readonly feedbacks = signal<ProductFeedbackDto[]>([]);

  ngOnInit(): void {
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
          this.quantity.set(1);
          this.feedbackLoading.set(false);
          this.feedbackError.set(null);
          this.feedbacks.set([]);
          if (this.feedbackSub) {
            this.feedbackSub.unsubscribe();
            this.feedbackSub = null;
          }
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
            this.feedbackLoading.set(false);
            this.feedbackError.set(null);
            this.feedbacks.set([]);
            return;
          }

          this.feedbackLoading.set(true);
          this.feedbackError.set(null);
          this.feedbackSub = this.api.listFeedbacksByProduct(p.id).subscribe({
            next: (rows) => {
              this.feedbacks.set(rows);
              this.feedbackLoading.set(false);
            },
            error: (e: Error) => {
              this.feedbackError.set(e.message ?? 'Failed to load reviews');
              this.feedbackLoading.set(false);
            },
          });
        },
        error: (e: Error) => {
          this.error.set(e.message ?? 'Product not found');
          this.loading.set(false);
          this.product.set(null);
        },
      });
  }

  ngOnDestroy(): void {
    if (this.sub) this.sub.unsubscribe();
    if (this.feedbackSub) this.feedbackSub.unsubscribe();
    if (this.hintTimer) clearTimeout(this.hintTimer);
  }

  increaseQty(): void {
    if (this.quantity() < this.availableRoom()) {
      this.quantity.update((q) => q + 1);
    }
  }

  decreaseQty(): void {
    if (this.quantity() > 1) {
      this.quantity.update((q) => q - 1);
    }
  }

  addToCart(p: Product): void {
    if (p.stock <= 0 || this.addingToCart()) return;

    // Server cart is now the source of truth for `/cart`.
    // If user is not logged in, redirect to login (backend requires JWT).
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.addingToCart.set(true);
    this.cartError.set(null);

    const qtyToAdd = Math.min(this.availableRoom(), Math.max(1, this.quantity()));
    this.http
      .put<ApiSuccess<unknown>>(`${environment.apiUrl}/api/cart/items/${p.id}`, {
        quantity: qtyToAdd,
        name: p.name,
      })
      .subscribe({
        next: () => {
          this.serverCart.refresh().subscribe();
          this.cartHint.set(true);
          this.addingToCart.set(false);
          if (this.hintTimer) clearTimeout(this.hintTimer);
          if (isPlatformBrowser(this.platformId)) {
            this.hintTimer = setTimeout(() => {
              this.cartHint.set(false);
              this.hintTimer = null;
            }, 3000);
          }
        },
        error: (e: Error) => {
          this.cartError.set(e.message ?? 'Failed to add to cart');
          this.addingToCart.set(false);
        },
      });
  }

  goToCart(): void {
    this.cartHint.set(false);
    void this.router.navigate(['/cart']);
  }
}
