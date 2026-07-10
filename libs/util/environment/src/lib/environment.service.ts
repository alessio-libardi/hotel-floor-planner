import { inject, Injectable, InjectionToken } from '@angular/core';

export interface Environment {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const ENVIRONMENT = new InjectionToken<Environment>('environment');

export function provideEnvironment(environment: Environment) {
  return {
    provide: ENVIRONMENT,
    useValue: environment,
  };
}

@Injectable({
  providedIn: 'root',
})
export class EnvironmentService {
  readonly environment: Environment = inject(ENVIRONMENT);
}
