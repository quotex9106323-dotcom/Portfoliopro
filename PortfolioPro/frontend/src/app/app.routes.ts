import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './shared/shell/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'markets',
        loadComponent: () =>
          import('./features/markets/markets.component').then((m) => m.MarketsComponent),
      },
      {
        path: 'stocks/:symbol',
        loadComponent: () =>
          import('./features/stock-detail/stock-detail.component').then((m) => m.StockDetailComponent),
      },
      {
        path: 'portfolio',
        loadComponent: () =>
          import('./features/portfolio/portfolio.component').then((m) => m.PortfolioComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/orders.component').then((m) => m.OrdersComponent),
      },
      {
        path: 'watchlist',
        loadComponent: () =>
          import('./features/watchlist/watchlist.component').then((m) => m.WatchlistComponent),
      },
      {
        path: 'analysis',
        loadComponent: () =>
          import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent),
      },
      {
        path: 'risk',
        loadComponent: () =>
          import('./features/risk/risk.component').then((m) => m.RiskComponent),
      },
      {
        path: 'wallet',
        loadComponent: () =>
          import('./features/wallet/wallet.component').then((m) => m.WalletComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
