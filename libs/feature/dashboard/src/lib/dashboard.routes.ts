import { Route } from '@angular/router';
import { authenticatedGuard } from '@util/auth';
import { AppShellComponent } from './app-shell/app.component';

export const dashboardRoutes: Route[] = [
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authenticatedGuard],
    children: [
      {
        path: 'configure',
        loadComponent: () =>
          import('./floor-config-page/floor-config-page.component').then(
            (m) => m.FloorConfigPageComponent
          ),
      },
      {
        path: 'overview',
        loadComponent: () =>
          import('./floor-overview-page/floor-overview-page.component').then(
            (m) => m.FloorOverviewPageComponent
          ),
      },
      {
        path: 'plan',
        loadComponent: () =>
          import('./plan-page/plan-page.component').then(
            (m) => m.PlanPageComponent
          ),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'configure',
      },
      {
        path: '**',
        redirectTo: 'configure',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
