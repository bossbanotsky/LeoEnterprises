import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Creates a Firebase Auth user without logging out the current admin.
 * This is a workaround for the Firebase Client SDK's behavior of automatically
 * logging in any new user created via createUserWithEmailAndPassword.
 */
export async function createEmployeeAuth(email: string, pass: string) {
  const secondaryAppName = `secondary-auth-${Date.now()}`;
  let secondaryApp;
  
  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    // This creates the user in the secondary app context, leaving the primary auth alone
    const result = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    
    // Clean up
    await deleteApp(secondaryApp);
    return result.user;
  } catch (error) {
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch(e) {}
    }
    
    // If user already exists, we might want to just "inform" or maybe try to re-link
    throw error;
  }
}
