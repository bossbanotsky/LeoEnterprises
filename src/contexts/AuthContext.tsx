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
              // Try to find a matching employee by email (Case-insensitive & trimmed)
              try {
                const { collection, getDocs, setDoc } = await import('firebase/firestore');
                
                // Fetch all employees to allow robust casing/spacing matching
                // (This is highly efficient for standard employee sizes)
                const snapshot = await getDocs(collection(db, 'employees'));
                let matchedEmployeeDoc = null;
                const normalizedCurrentEmail = currentUser.email?.trim().toLowerCase();

                for (const doc of snapshot.docs) {
                  const data = doc.data();
                  if (data.email && data.email.trim().toLowerCase() === normalizedCurrentEmail) {
                    matchedEmployeeDoc = doc;
                    break;
                  }
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
      changePassword,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
