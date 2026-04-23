import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { Employee, PakyawJob, Announcement, CashAdvance } from '../types';

interface DataContextType {
  employees: Employee[];
  users: any[];
  pakyawJobs: PakyawJob[];
  announcements: Announcement[];
  cashAdvances: CashAdvance[];
  loading: boolean;
  refreshData: (collectionName?: string) => Promise<void>;
}

const DataContext = createContext<DataContextType>({
  employees: [],
  users: [],
  pakyawJobs: [],
  announcements: [],
  cashAdvances: [],
  loading: true,
  refreshData: async () => {},
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setQuotaLimited } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [pakyawJobs, setPakyawJobs] = useState<PakyawJob[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollections = useCallback(async () => {
    if (!user) return;
    
    try {
      
      // Parallel fetch to save time and reduce overhead
      const snapsPromise = Promise.all([
        getDocs(collection(db, 'employees')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'pakyawJobs'), orderBy('startDate', 'desc'))),
        getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'cashAdvances'), orderBy('date', 'desc'), limit(500)))
      ]);

      let snaps;
      try {
        snaps = await snapsPromise;
      } catch (e: any) {
         console.warn("DataContext server fetch failed", e.message);
         throw e; // rethrow to be caught by the outer catch
      }

      const [empsSnap, usersSnap, jobsSnap, annSnap, caSnap] = snaps;

      const emps: Employee[] = [];
      empsSnap.forEach(doc => emps.push({ id: doc.id, ...doc.data() } as Employee));
      const sortedEmps = emps.sort((a, b) => a.fullName.localeCompare(b.fullName));
      
      const usersList: any[] = [];
      usersSnap.forEach(doc => usersList.push({ id: doc.id, ...doc.data() }));

      const jobsList: PakyawJob[] = [];
      jobsSnap.forEach(doc => jobsList.push({ id: doc.id, ...doc.data() } as PakyawJob));

      const annList: Announcement[] = [];
      annSnap.forEach(doc => annList.push({ id: doc.id, ...doc.data() } as Announcement));

      const caList: CashAdvance[] = [];
      caSnap.forEach(doc => caList.push({ id: doc.id, ...doc.data() } as CashAdvance));

      setEmployees(sortedEmps);
      setUsers(usersList);
      setPakyawJobs(jobsList);
      setAnnouncements(annList);
      setCashAdvances(caList);
      
      setLoading(false);
      setQuotaLimited(false);
    } catch (error: any) {
      const isQuota = error?.message?.toLowerCase().includes('quota') || 
                      error?.message?.toLowerCase().includes('resource-exhausted') ||
                      error?.message?.toLowerCase().includes('client is offline');
      if (isQuota) {
        setQuotaLimited(true);
      } else {
        handleFirestoreError(error, OperationType.GET, 'data_provider_fetch');
      }
      setLoading(false);
    }
  }, [user, setQuotaLimited]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchCollections();
  }, [user, fetchCollections]);

  const refreshData = async (collectionName?: string) => {
    await fetchCollections();
  };

  return (
    <DataContext.Provider value={{ 
      employees, 
      users, 
      pakyawJobs,
      announcements,
      cashAdvances,
      loading, 
      refreshData 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
