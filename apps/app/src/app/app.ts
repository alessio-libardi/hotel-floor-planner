import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  authErrorMessage,
  firebaseAuth,
  signInWithGoogle,
  signOutUser,
  useFirebaseEmulators,
} from './firebase.client';

@Component({
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly title = 'Hotel Floor Planner';
  protected readonly isEmulatorMode = useFirebaseEmulators;
  protected readonly authUser = signal<User | null | undefined>(undefined);
  protected readonly authBusy = signal(false);
  protected readonly authError = signal<string | null>(null);

  constructor() {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      this.authUser.set(user);
      this.authError.set(null);
    });

    this.destroyRef.onDestroy(unsubscribe);
  }

  protected get isLoadingAuth(): boolean {
    return this.authUser() === undefined;
  }

  protected async signIn(): Promise<void> {
    this.authBusy.set(true);
    this.authError.set(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      const message = authErrorMessage(error);

      // Redirect fallback is expected behavior for popup-restricted browsers.
      if (message !== 'Redirecting to Google sign-in...') {
        this.authError.set(message);
      }
    } finally {
      this.authBusy.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    this.authBusy.set(true);
    this.authError.set(null);

    try {
      await signOutUser();
    } catch (error) {
      this.authError.set(
        error instanceof Error ? error.message : 'Sign-out failed.'
      );
    } finally {
      this.authBusy.set(false);
    }
  }
}
