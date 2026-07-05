import {
  EnvironmentProviders,
  inject,
  isDevMode,
  makeEnvironmentProviders,
} from '@angular/core';
import { EnvironmentService } from '@util/env';

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

import { provideFirebaseApp } from '@angular/fire/app';
import { provideAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';

export function provideApi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideFirebaseApp(() => {
      const environment = inject(EnvironmentService).environment;
      return initializeApp(environment);
    }),

    provideAuth(() => {
      const auth = getAuth();

      if (isDevMode()) {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099');
      }

      return auth;
    }),

    provideFirestore(() => {
      const firestore = getFirestore();

      if (isDevMode()) {
        connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
      }

      return firestore;
    }),
  ]);
}
