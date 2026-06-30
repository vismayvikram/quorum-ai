import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut, Auth } from 'firebase/auth';

let appInstance: any = null;
let authInstance: Auth | null = null;
let initPromise: Promise<Auth | null> | null = null;

export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

/**
 * Lazy, async getter for the Firebase Auth instance.
 * Excludes build-time dependencies on firebase-applet-config.json.
 */
export async function getFirebaseAuth(): Promise<Auth | null> {
  if (authInstance) return authInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let config: any = null;
      try {
        const response = await fetch('/api/firebase-config');
        if (response.ok) {
          config = await response.json();
        }
      } catch (err) {
        console.warn('Failed to fetch firebase config from server API:', err);
      }

      // Fallback configuration if API returns nothing or fails
      if (!config || !config.apiKey) {
        const metaEnv = (import.meta as any).env || {};
        config = {
          apiKey: metaEnv.VITE_FIREBASE_API_KEY || "",
          authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "",
          projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || "",
          storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "",
          messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
          appId: metaEnv.VITE_FIREBASE_APP_ID || ""
        };
      }

      // If configuration is completely empty, Firebase Auth will fail to initialize.
      // But we will return null instead of crashing the front-end bundle.
      if (!config.apiKey) {
        console.warn('Firebase API key is not configured. Google sign-in features will be unavailable.');
        return null;
      }

      appInstance = getApps().length === 0 ? initializeApp(config) : getApps()[0];
      authInstance = getAuth(appInstance);
      return authInstance;
    } catch (error) {
      console.error('Error during lazy Firebase Auth initialization:', error);
      return null;
    }
  })();

  return initPromise;
}

// Load cached token from memory
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  let active = true;
  let unsubscribe: (() => void) | null = null;

  getFirebaseAuth().then((auth) => {
    if (!active) return;
    if (!auth) {
      if (onAuthFailure) onAuthFailure();
      return;
    }

    unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  }).catch((err) => {
    console.error('Error in initGoogleAuth subscription:', err);
    if (onAuthFailure) onAuthFailure();
  });

  return () => {
    active = false;
    if (unsubscribe) {
      unsubscribe();
    }
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const auth = await getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Auth is not configured. Please supply Firebase credentials.');
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get Google Calendar access token from Auth response.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Calendar sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  const auth = await getFirebaseAuth();
  if (auth) {
    await signOut(auth);
  }
  cachedAccessToken = null;
};
