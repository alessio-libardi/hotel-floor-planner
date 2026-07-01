import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase.config';

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(firebaseAuth, googleProvider);
  return credential.user;
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
