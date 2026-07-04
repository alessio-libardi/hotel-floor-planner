import { Route } from '@angular/router';
import { FloorConfigPageComponent } from './floor-config-page/floor-config-page.component';
import { FloorOverviewPageComponent } from './floor-overview-page/floor-overview-page.component';
import { PlanPageComponent } from './plan-page/plan-page.component';
import { SignInComponent } from '../feature/auth/sign-in/sign-in.component';

export const appRoutes: Route[] = [
  {
    path: 'auth',
    children: [
      {
        path: 'sign-in',
        component: SignInComponent,
      },
    ],
  },
  {
    path: 'aa',
    children: [
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
    ],
  },
  {
    path: '**',
    redirectTo: 'auth/sign-in',
  },
];
