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
    
    // Load from cache first for instant feedback if available
    const cachedEmps = localStorage.getItem('cache_employees');
    const cachedUsers = localStorage.getItem('cache_users');
    const cachedJobs = localStorage.getItem('cache_pakyawJobs');
    const cachedAnn = localStorage.getItem('cache_announcements');
    const cachedCA = localStorage.getItem('cache_cashAdvances');

    if (cachedEmps) setEmployees(JSON.parse(cachedEmps));
    if (cachedUsers) setUsers(JSON.parse(cachedUsers));
    if (cachedJobs) setPakyawJobs(JSON.parse(cachedJobs));
    if (cachedAnn) setAnnouncements(JSON.parse(cachedAnn));
    if (cachedCA) setCashAdvances(JSON.parse(cachedCA));

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
      const uniqueEmps = Array.from(new Map(emps.map(e => [e.id, e])).values());
      const sortedEmps = uniqueEmps.sort((a, b) => a.fullName.localeCompare(b.fullName));
      
      const usersList: any[] = [];
      usersSnap.forEach(doc => usersList.push({ id: doc.id, ...doc.data() }));
      const uniqueUsers = Array.from(new Map(usersList.map(u => [u.id, u])).values());

      const jobsList: PakyawJob[] = [];
      jobsSnap.forEach(doc => jobsList.push({ id: doc.id, ...doc.data() } as PakyawJob));
      const uniqueJobs = Array.from(new Map(jobsList.map(j => [j.id, j])).values());

      const annList: Announcement[] = [];
      annSnap.forEach(doc => annList.push({ id: doc.id, ...doc.data() } as Announcement));
      const uniqueAnn = Array.from(new Map(annList.map(a => [a.id, a])).values());

      const caList: CashAdvance[] = [];
      caSnap.forEach(doc => caList.push({ id: doc.id, ...doc.data() } as CashAdvance));
      const uniqueCA = Array.from(new Map(caList.map(c => [c.id, c])).values());

      setEmployees(sortedEmps);
      setUsers(uniqueUsers);
      setPakyawJobs(uniqueJobs);
      setAnnouncements(uniqueAnn);
      setCashAdvances(uniqueCA);

      // Save to cache
      localStorage.setItem('cache_employees', JSON.stringify(sortedEmps));
      localStorage.setItem('cache_users', JSON.stringify(uniqueUsers));
      localStorage.setItem('cache_pakyawJobs', JSON.stringify(uniqueJobs));
      localStorage.setItem('cache_announcements', JSON.stringify(uniqueAnn));
      localStorage.setItem('cache_cashAdvances', JSON.stringify(uniqueCA));
      
      setLoading(false);
      setQuotaLimited(false);
    } catch (error: any) {
      const isQuota = error?.message?.toLowerCase().includes('quota') || 
                      error?.message?.toLowerCase().includes('resource-exhausted') ||
                      error?.message?.toLowerCase().includes('client is offline') ||
                      error?.code === 'resource-exhausted';
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
