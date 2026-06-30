import { Route } from '@angular/router';
import { FloorConfigPageComponent } from './floor-config-page.component';
import { FloorOverviewPageComponent } from './floor-overview-page.component';
import { PlanPageComponent } from './plan-page.component';

export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'configure',
  },
  {
    path: 'configure',
    component: FloorConfigPageComponent,
  },
  {
    path: 'overview',
    component: FloorOverviewPageComponent,
  },
  {
    path: 'plan',
    component: PlanPageComponent,
  },
  {
    path: '**',
    redirectTo: 'configure',
  },
];
