import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { environment } from '../environments/environment';
import { provideEnvironment } from '@util/env';
import { provideApi } from '@data-access/api';
import { provideUI } from '@ui/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideEnvironment(environment),
    provideApi(),
    provideUI(),
    provideRouter(appRoutes),
  ],
};
