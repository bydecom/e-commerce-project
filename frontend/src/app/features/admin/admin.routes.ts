import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./shop-settings/shop-settings.component').then((m) => m.AdminShopSettingsComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./products/product-list/product-list.component').then(
            (m) => m.AdminProductListComponent
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./categories/category-list/category-list.component').then(
            (m) => m.AdminCategoryListComponent
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./users/user-list.component').then((m) => m.AdminUserListComponent),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./products/product-form/product-form.component').then(
            (m) => m.AdminProductFormComponent
          ),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./orders/order-list/order-list.component').then((m) => m.AdminOrderListComponent),
      },
      {
        path: 'orders/:id',
        loadComponent: () =>
          import('./orders/order-detail/order-detail.component').then(
            (m) => m.AdminOrderDetailComponent
          ),
      },
      {
        path: 'feedbacks',
        loadComponent: () =>
          import('./feedbacks/feedback-list.component').then((m) => m.AdminFeedbackListComponent),
      },
      {
        path: 'feedback-types',
        loadComponent: () =>
          import('./feedbacks/feedback-type-settings.component').then(
            (m) => m.FeedbackTypeSettingsComponent
          ),
      },
      {
        path: 'system-logs',
        loadComponent: () =>
          import('./system-log/system-log.component').then(
            (m) => m.AdminSystemLogComponent
          ),
      },
      {
        path: 'system-config',
        loadComponent: () =>
          import('./system-config/system-config.component').then(
            (m) => m.AdminSystemConfigComponent
          ),
      },
    ],
  },
];
