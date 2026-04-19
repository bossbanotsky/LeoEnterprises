import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from '../firebase';

interface UserData {
  role: 'admin' | 'employee';
  email: string;
  employeeId?: string;
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          } else {
            // Case-insensitive check for admin email
            const adminEmail = "marqueznorthed@gmail.com";
            if (currentUser.email?.toLowerCase() === adminEmail.toLowerCase()) {
              const adminData: UserData = { role: 'admin', email: currentUser.email! };
              setUserData(adminData);
              // Provision the user document if missing
              try {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(userDocRef, adminData);
              } catch (e) {
                console.error("Error provisioning admin user:", e);
              }
            } else {
              // Try to find a matching employee by email (also case-insensitive if possible, but Firestore == is case-sensitive)
              // We'll trust the email if provided by the provider
              const { collection, query, where, getDocs, setDoc } = await import('firebase/firestore');
              const q = query(collection(db, 'employees'), where('email', '==', currentUser.email));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const employeeDoc = querySnapshot.docs[0];
                const empData: UserData = { 
                  role: 'employee', 
                  email: currentUser.email!,
                  employeeId: employeeDoc.id 
                };
                setUserData(empData);
                await setDoc(userDocRef, empData);
              } else {
                setUserData(null);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
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
