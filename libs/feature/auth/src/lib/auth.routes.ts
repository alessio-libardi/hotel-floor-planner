import { Route } from '@angular/router';
import { anonymousGuard } from '@util/auth';

import { SignInPageComponent } from './pages/sign-in-page/sign-in-page.component';

export const authRoutes: Route[] = [
  {
    path: 'auth',
    canActivate: [anonymousGuard],
    children: [
      {
        path: 'sign-in',
        component: SignInPageComponent,
      },
      {
        path: '**',
        redirectTo: 'sign-in',
      },
    ],
  },
];
