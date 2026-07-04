import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth } from '@angular/fire/auth';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { firebaseConfig } from '@data-access/api';
import {
  provideFirebaseUI,
  provideFirebaseUIPolicies,
} from '@firebase-oss/ui-angular';
import { initializeUI } from '@firebase-oss/ui-core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => {
      const auth = getAuth();
      console.log(isDevMode());
      if (isDevMode()) {
        /** Enable emulators in development */
        connectAuthEmulator(auth, 'http://127.0.0.1:9099');
      }
      return auth;
    }),
    provideFirebaseUI((apps) => {
      console.log('Initializing FirebaseUI with app:', apps);
      return initializeUI({
        app: apps[0],
      });
    }),
    provideFirebaseUIPolicies(() => ({
      termsOfServiceUrl: 'https://www.google.com',
      privacyPolicyUrl: 'https://www.google.com',
    })),
  ],
};
