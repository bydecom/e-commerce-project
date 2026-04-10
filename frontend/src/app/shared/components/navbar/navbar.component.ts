import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { StoreSettingService } from '../../../core/services/store-setting.service';
import { ProductApiService, type CategoryDto } from '../../../core/services/product-api.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly storeSetting = inject(StoreSettingService);
  private readonly productApi = inject(ProductApiService);

  readonly auth = this.authService;
  readonly cart = this.cartService;

  readonly shopName = computed(() => this.storeSetting.setting()?.name ?? 'E‑Commerce');
  readonly logoUrl = computed(() => this.storeSetting.setting()?.logoUrl ?? null);

  readonly searchSuggestions = signal<CategoryDto[]>([]);

  ngOnInit(): void {
    this.productApi.getCategories().subscribe({
      next: (cats) => {
        this.searchSuggestions.set(cats.slice(0, 5));
      },
      error: (err) => console.error('Failed to load search category suggestions', err),
    });
  }
}
