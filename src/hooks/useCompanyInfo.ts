import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface CompanyInfo {
  name: string;
  address: string;
  contact: string;
}

const defaultCompany: CompanyInfo = {
  name: 'Leo Enterprises',
  address: '',
  contact: ''
};

export function useCompanyInfo() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(defaultCompany);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'company'), (docSnap) => {
      if (docSnap.exists()) {
        setCompanyInfo({ ...defaultCompany, ...docSnap.data() });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching company info:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateCompanyInfo = async (data: Partial<CompanyInfo>) => {
    try {
      await setDoc(doc(db, 'settings', 'company'), { ...companyInfo, ...data }, { merge: true });
    } catch (e) {
      console.error("Error updating company info:", e);
      throw e;
    }
  };

  return { companyInfo, updateCompanyInfo, loading };
}
