import { Injectable } from '@angular/core';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { Observable } from 'rxjs';
import { firebaseAuth, useFirebaseEmulators } from '@data-access/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user$: Observable<User | null> = new Observable((subscriber) => {
    return onAuthStateChanged(
      firebaseAuth,
      (user) => subscriber.next(user),
      (err) => subscriber.error(err)
    );
  });

  async login(): Promise<void> {
    if (useFirebaseEmulators) {
      await signInAnonymously(firebaseAuth);
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(firebaseAuth, provider);
  }

  async signOut(): Promise<void> {
    await signOut(firebaseAuth);
  }

  requireUser(): User {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user;
  }
}
