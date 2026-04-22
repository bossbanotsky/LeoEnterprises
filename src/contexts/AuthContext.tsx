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
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Optimize: Use single fetch instead of onSnapshot to save quota
        const fetchUserData = async () => {
          try {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              setUserData(userDoc.data() as UserData);
              setLoading(false);
            } else {
              // Case-insensitive check for admin email
              const adminEmail = "marqueznorthed@gmail.com";
              if (currentUser.email?.toLowerCase() === adminEmail.toLowerCase()) {
                const adminData: UserData = { role: 'admin', email: currentUser.email!, fullName: 'Administrator' };
                setUserData(adminData);
                // Provision the user document if missing
                try {
                  const { setDoc } = await import('firebase/firestore');
                  await setDoc(userDocRef, adminData);
                } catch (e) {
                  console.error("Error provisioning admin user:", e);
                }
                setLoading(false);
              } else {
                // Try to find a matching employee by email using a targeted query (Quota optimization)
                try {
                  const { collection, getDocs, setDoc, query, where } = await import('firebase/firestore');
                  
                  const normalizedCurrentEmail = currentUser.email?.trim().toLowerCase();
                  if (!normalizedCurrentEmail) {
                    setUserData(null);
                    setLoading(false);
                    return;
                  }

                  // Use a specific query instead of fetching all employees
                  const q = query(collection(db, 'employees'), where('email', '==', currentUser.email));
                  const snapshot = await getDocs(q);
                  
                  let matchedEmployeeDoc = null;
                  if (!snapshot.empty) {
                    matchedEmployeeDoc = snapshot.docs[0];
                  } else {
                    // Fallback search if email casing/spacing in DB is different
                    // Note: Firestore '==' is case-sensitive, but we can't efficiently do case-insensitive search 
                    // without a normalized field. For now, we stay with targeted query and suggest data normalization.
                    setUserData(null);
                    setLoading(false);
                    return;
                  }
                  
                  if (matchedEmployeeDoc) {
                    const employeeRecord = matchedEmployeeDoc.data();
                    const empData: UserData = { 
                      role: employeeRecord.role || 'employee', 
                      email: currentUser.email!,
                      employeeId: matchedEmployeeDoc.id,
                      fullName: employeeRecord.fullName,
                      photoURL: employeeRecord.photoURL
                    };
                    setUserData(empData);
                    await setDoc(userDocRef, empData);
                  } else {
                    setUserData(null);
                  }
                  setLoading(false);
                } catch (error) {
                  console.error("Error finding employee:", error);
                  setUserData(null);
                  setLoading(false);
                }
              }
            }
          } catch (error: any) {
            // Silently handle quota errors to prevent crashing the UI experience
            const isQuotaError = error?.message?.toLowerCase().includes('quota') || 
                               error?.message?.toLowerCase().includes('resource-exhausted');
            
            if (!isQuotaError) {
              console.error("Error fetching user data:", error);
            }
            
            setUserData(null);
            setLoading(false);
          }
        };

        fetchUserData();
      }
 else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData,
      loading, 
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
