import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Connection test function
export async function testConnection() {
  try {
    const { getDocFromServer, doc } = await import('firebase/firestore');
    // Using 'test/connection' as per standard recommendations
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test: SUCCESS");
    return true;
  } catch (error: any) {
    // If we get "insufficient permissions", it actually means we ARE connected to Firestore, 
    // but just don't have access to that specific document yet.
    if (error.code === 'permission-denied') {
      console.log("Firestore connection test: CONNECTED (but unauthorized, which is normal before login)");
      return true;
    }
    if (error.message && (error.message.includes('client is offline') || error.message.includes('unavailable'))) {
      console.warn("Firestore connection test: OFFLINE or UNAVAILABLE. App will operate in offline mode.");
    } else {
      console.error("Firestore connection test: NETWORK ERROR", error);
    }
    return false;
  }
}

// Run test on initialization
testConnection();

export const loginWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export async function addAuditLog(action: string, module: string, details?: any) {
  if (auth.currentUser) {
    try {
      await addDoc(collection(db, 'logs'), {
        message: `${module}: ${action}`,
        level: 'info',
        details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        createdAt: new Date().toISOString(),
        uid: auth.currentUser.uid,
        userEmail: auth.currentUser.email
      });
    } catch (logError) {
      console.error('Failed to log audit event to Firestore', logError);
    }
  }
}

export async function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (auth.currentUser) {
    // Don't try to log to Firestore if we already hit a quota limit or resource error
    const isQuotaError = errInfo.error.toLowerCase().includes('quota') || 
                        errInfo.error.toLowerCase().includes('resource-exhausted') ||
                        errInfo.error.toLowerCase().includes('client is offline');
    
    if (!isQuotaError) {
      try {
        await addDoc(collection(db, 'logs'), {
          message: `Firestore Error: ${operationType} on ${path}`,
          level: 'error',
          details: JSON.stringify(errInfo),
          createdAt: new Date().toISOString(),
          uid: auth.currentUser.uid
        });
      } catch (logError) {
        console.error('Failed to log error to Firestore', logError);
      }
    }
  }

  throw new Error(JSON.stringify(errInfo));
}
