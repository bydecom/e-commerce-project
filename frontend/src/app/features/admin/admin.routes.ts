import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/admin.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./products/product-list/product-list.component').then(
            (m) => m.AdminProductListComponent
          ),
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
    ],
  },
];
