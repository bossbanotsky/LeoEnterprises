import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from '../firebase';

interface UserData {
  role: 'admin' | 'employee' | 'ceo';
  email: string;
  employeeId?: string;
  fullName?: string;
  photoURL?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  isQuotaLimited: boolean;
  setQuotaLimited: (limited: boolean) => void;
  loginWithGoogleContext: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  registerWithEmail: (e: string, p: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isQuotaLimited: false,
  setQuotaLimited: () => {},
  loginWithGoogleContext: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  changePassword: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isQuotaLimited, setIsQuotaLimited] = useState(false);

  // Auto-reset quota limited state after some time or on certain actions
  const setQuotaLimited = (limited: boolean) => {
    setIsQuotaLimited(limited);
    if (limited) {
      // Clear it after 5 minutes potentially or leave it until next reload
      setTimeout(() => setIsQuotaLimited(false), 300000);
    }
  };

  const loginWithEmail = async (e: string, p: string) => {
    await signInWithEmailAndPassword(auth, e, p);
  };
  
  const registerWithEmail = async (e: string, p: string) => {
    await createUserWithEmailAndPassword(auth, e, p);
  };

  const changePassword = async (newPassword: string) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    const { updatePassword } = await import('firebase/auth');
    await updatePassword(auth.currentUser, newPassword);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Immediate completion of loading for Auth state
        setLoading(false);
        
        const userDocRef = doc(db, 'users', currentUser.uid);
        const ADMIN_EMAIL = "marqueznorthed@gmail.com".toLowerCase();
        
        // Try to load from cache first for zero-read fast startup
        const cachedUserData = localStorage.getItem(`userData_${currentUser.uid}`);
        if (cachedUserData) {
          try {
            setUserData(JSON.parse(cachedUserData));
          } catch (e) {
            console.error("Error parsing cached user data", e);
          }
        }

        // Background fetch of fresh user data
        const fetchUserData = async () => {
          try {
            // Failsafe: If the user is the hardcoded admin, grant access immediately 
            if (currentUser.email?.toLowerCase() === ADMIN_EMAIL) {
              const adminData: UserData = { role: 'admin', email: currentUser.email!, fullName: 'Administrator' };
              setUserData(adminData);
              localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify(adminData));
              // We don't return here, we still try to sync with DB if possible for fresh name/photo
            }

            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const data = userDoc.data() as UserData;
              setUserData(data);
              localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify(data));
            } else {
              // Case-insensitive check for admin email
              if (currentUser.email?.toLowerCase() === ADMIN_EMAIL) {
                const adminData: UserData = { role: 'admin', email: currentUser.email!, fullName: 'Administrator' };
                setUserData(adminData);
                localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify(adminData));
                try {
                  const { setDoc } = await import('firebase/firestore');
                  await setDoc(userDocRef, adminData);
                } catch (e) { console.error("Admin provision error", e); }
              } else {
                // Secondary check: search employees by email
                try {
                  const { collection, getDocs, setDoc, query, where } = await import('firebase/firestore');
                  const q = query(collection(db, 'employees'), where('email', '==', currentUser.email));
                  const snapshot = await getDocs(q);
                  
                  if (!snapshot.empty) {
                    const matchedEmployeeDoc = snapshot.docs[0];
                    const employeeRecord = matchedEmployeeDoc.data();
                    const empData: UserData = { 
                      role: (employeeRecord.role as any) || 'employee', 
                      email: currentUser.email!,
                      employeeId: matchedEmployeeDoc.id,
                      fullName: employeeRecord.fullName,
                      photoURL: employeeRecord.photoURL
                    };
                    setUserData(empData);
                    localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify(empData));
                    await setDoc(userDocRef, empData);
                  }
                } catch (error) {
                  console.error("Error finding employee:", error);
                }
              }
            }
          } catch (error: any) {
            const isQuotaError = error?.message?.toLowerCase().includes('quota') || 
                               error?.message?.toLowerCase().includes('resource-exhausted');
            if (isQuotaError) setQuotaLimited(true);
            
            // Failsafe fallback
            if (currentUser.email?.toLowerCase() === ADMIN_EMAIL) {
              setUserData(prev => prev || { role: 'admin', email: currentUser.email!, fullName: 'Administrator' });
            }
          }
        };

        fetchUserData();
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData,
      loading, 
      isQuotaLimited,
      setQuotaLimited,
      loginWithGoogleContext: loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      changePassword,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
