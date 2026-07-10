import { Route } from '@angular/router';
import { authRoutes } from '@feature/auth';
import { dashboardRoutes } from '@feature/dashboard';

export const appRoutes: Route[] = [...authRoutes, ...dashboardRoutes];
