import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  provideFirebaseUI,
  provideFirebaseUIPolicies,
} from '@firebase-oss/ui-angular';
import { initializeUI } from '@firebase-oss/ui-core';

export function provideUI(): EnvironmentProviders {
  return makeEnvironmentProviders([
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
  ]);
}
