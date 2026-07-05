import { Route } from '@angular/router';
import { authenticatedGuard } from '@util/auth';
import { ShellComponent } from './components/shell/shell.component';

export const dashboardRoutes: Route[] = [
  {
    path: '',
    component: ShellComponent,
    canActivate: [authenticatedGuard],
    children: [
      {
        path: 'setup',
        loadComponent: () =>
          import('./pages/setup-page/setup-page.component').then(
            (m) => m.SetupPageComponent
          ),
      },
      {
        path: 'layout',
        loadComponent: () =>
          import('./pages/layout-page/layout-page.component').then(
            (m) => m.LayoutPageComponent
          ),
      },
      {
        path: 'seating',
        loadComponent: () =>
          import('./pages/seating-page/seating-page.component').then(
            (m) => m.SeatingPageComponent
          ),
      },
      {
        path: '**',
        redirectTo: 'setup',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
