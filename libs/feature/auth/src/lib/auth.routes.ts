import { Route } from '@angular/router';
import { anonymousGuard } from '@util/auth';

import { SignInComponent } from './sign-in-page/sign-in.component';

export const authRoutes: Route[] = [
  {
    path: 'auth',
    canActivate: [anonymousGuard],
    children: [
      {
        path: 'sign-in',
        component: SignInComponent,
      },
      {
        path: '**',
        redirectTo: 'sign-in',
      },
    ],
  },
];
