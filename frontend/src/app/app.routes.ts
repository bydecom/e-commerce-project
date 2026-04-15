import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { EditProfileComponent } from './features/profile';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () =>
      import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/layout/user-layout.component').then((m) => m.UserLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then(
            (m) => m.ProductListComponent
          ),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./features/products/product-detail/product-detail.component').then(
            (m) => m.ProductDetailComponent
          ),
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('./features/cart/cart.component').then((m) => m.CartComponent),
      },
      {
        path: 'checkout',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent),
      },
      {
        path: 'checkout/result',
        loadComponent: () =>
          import('./features/checkout/checkout-result.component').then((m) => m.CheckoutResultComponent),
      },
      {
        path: 'orders',
        canActivate: [authGuard],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/orders/order-list/order-list.component').then(
                (m) => m.OrderListComponent
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/orders/order-detail/order-detail.component').then(
                (m) => m.OrderDetailComponent
              ),
          },
        ],
      },
      {
        path: 'profile/edit',
        canActivate: [authGuard],
        component: EditProfileComponent,
      },
      {
        path: 'profile/change-password',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/profile/change-password.component').then((m) => m.ChangePasswordComponent),
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/info/about/about.component').then((m) => m.AboutComponent),
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./features/info/contact/contact.component').then((m) => m.ContactComponent),
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./features/info/privacy/privacy.component').then((m) => m.PrivacyComponent),
      },
      {
        path: 'terms',
        loadComponent: () =>
          import('./features/info/terms/terms.component').then((m) => m.TermsComponent),
      },
      {
        path: 'shipping',
        loadComponent: () =>
          import('./features/info/shipping-policy/shipping-policy.component').then(
            (m) => m.ShippingPolicyComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
