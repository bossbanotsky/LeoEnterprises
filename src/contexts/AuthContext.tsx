import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from '../firebase';

interface UserData {
  role: 'admin' | 'employee';
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  loginWithGoogleContext: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
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

  useEffect(() => {
    let unsubscribeUserData: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubscribeUserData) {
        unsubscribeUserData();
        unsubscribeUserData = null;
      }

      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Use onSnapshot for real-time updates of role and profile
        unsubscribeUserData = onSnapshot(userDocRef, async (userDoc) => {
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
              // Try to find a matching employee by email
              try {
                const { collection, query, where, getDocs, setDoc } = await import('firebase/firestore');
                const q = query(collection(db, 'employees'), where('email', '==', currentUser.email));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                  const employeeDoc = querySnapshot.docs[0];
                  const employeeRecord = employeeDoc.data();
                  const empData: UserData = { 
                    role: 'employee', 
                    email: currentUser.email!,
                    employeeId: employeeDoc.id,
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
        }, (error) => {
          console.error("Error listening to user data:", error);
          setUserData(null);
          setLoading(false);
        });
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserData) unsubscribeUserData();
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
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
