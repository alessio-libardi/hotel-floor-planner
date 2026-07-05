import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { Observable, from } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly auth = inject(Auth);

  readonly user$: Observable<User | null> = new Observable((subscriber) => {
    return onAuthStateChanged(
      this.auth,
      (user) => subscriber.next(user),
      (err) => subscriber.error(err)
    );
  });

  async login(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(this.auth, provider);
  }

  signOut(): Observable<void> {
    return from(signOut(this.auth));
  }

  requireUser(): User {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user;
  }
}
