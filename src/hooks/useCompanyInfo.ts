import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface CompanyInfo {
  name: string;
  address: string;
  contact: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

const defaultCompany: CompanyInfo = {
  name: 'Leo Enterprises',
  address: 'Santa Maria, Bauan, Batangas',
  contact: '0994-606-4463'
};

export function useCompanyInfo() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(defaultCompany);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const { getDoc } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'settings', 'company'));
        if (docSnap.exists()) {
          setCompanyInfo({ ...defaultCompany, ...docSnap.data() });
        }
        setLoading(false);
      } catch (error: any) {
        // Silently handle quota errors
        if (!error?.message?.toLowerCase().includes('quota')) {
          console.error("Error fetching company info:", error);
        }
        setLoading(false);
      }
    };
    fetchCompany();
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
