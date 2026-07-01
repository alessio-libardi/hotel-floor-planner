import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase.config';

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const useFirebaseEmulators = shouldUseFirebaseEmulators();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

void setPersistence(firebaseAuth, browserLocalPersistence);

if (useFirebaseEmulators) {
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}

export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled in Firebase Authentication. Enable Google provider in the Firebase console.';
  }

  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Google sign-in. Add the current host to Firebase Authentication -> Settings -> Authorized domains.';
  }

  if (code === 'auth/popup-closed-by-user') {
    return 'The sign-in popup was closed before completing login. Please try again.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network error while signing in. Check your connection and try again.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Google sign-in failed. Check Firebase Authentication provider and authorized domains.';
}

export async function signInWithGoogle(): Promise<User> {
  if (useFirebaseEmulators) {
    const credential = await signInAnonymously(firebaseAuth);
    return credential.user;
  }

  try {
    const credential = await signInWithPopup(firebaseAuth, googleProvider);
    return credential.user;
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';

    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(firebaseAuth, googleProvider);
      throw new Error('Redirecting to Google sign-in...');
    }

    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(firebaseAuth);
}

export async function ensureSignedIn(): Promise<User> {
  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser;
  }

  const user = await new Promise<User | null>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (nextUser) => {
        unsubscribe();
        resolve(nextUser);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });

  if (!user) {
    throw new Error('Authentication required. Please sign in with Google.');
  }

  return user;
}

function shouldUseFirebaseEmulators(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}
