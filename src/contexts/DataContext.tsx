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

  // Cache timeout (1 hour)
  const CACHE_TIMEOUT = 3600000;

  const loadFromCache = () => {
    try {
      const cachedEmps = localStorage.getItem('cache_employees');
      const cachedUsers = localStorage.getItem('cache_users');
      const cachedJobs = localStorage.getItem('cache_pakyawJobs');
      const cachedAnn = localStorage.getItem('cache_announcements');
      const cachedCA = localStorage.getItem('cache_cashAdvances');
      const cachedTime = localStorage.getItem('cache_timestamp');

      if (cachedTime) {
        const timeDiff = Date.now() - parseInt(cachedTime);
        if (timeDiff < CACHE_TIMEOUT) {
          if (cachedEmps) setEmployees(JSON.parse(cachedEmps));
          if (cachedUsers) setUsers(JSON.parse(cachedUsers));
          if (cachedJobs) setPakyawJobs(JSON.parse(cachedJobs));
          if (cachedAnn) setAnnouncements(JSON.parse(cachedAnn));
          if (cachedCA) setCashAdvances(JSON.parse(cachedCA));
          return true;
        }
      }
    } catch (e) {
      console.error("Cache load error", e);
    }
    return false;
  };

  const fetchCollections = useCallback(async () => {
    if (!user) return;
    
    try {
      const { getDocsFromCache } = await import('firebase/firestore');
      
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
        // If server fails (quota), try cache for all
        console.warn("DataContext server fetch failed, trying cache...", e.message);
        snaps = await Promise.all([
          getDocsFromCache(collection(db, 'employees')),
          getDocsFromCache(collection(db, 'users')),
          getDocsFromCache(query(collection(db, 'pakyawJobs'), orderBy('startDate', 'desc'))),
          getDocsFromCache(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))),
          getDocsFromCache(query(collection(db, 'cashAdvances'), orderBy('date', 'desc'), limit(500)))
        ]);
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
      
      // Update cache
      localStorage.setItem('cache_employees', JSON.stringify(sortedEmps));
      localStorage.setItem('cache_users', JSON.stringify(usersList));
      localStorage.setItem('cache_pakyawJobs', JSON.stringify(jobsList));
      localStorage.setItem('cache_announcements', JSON.stringify(annList));
      localStorage.setItem('cache_cashAdvances', JSON.stringify(caList));
      localStorage.setItem('cache_timestamp', Date.now().toString());
      
      setLoading(false);
      setQuotaLimited(false);
    } catch (error: any) {
      const isQuota = error?.message?.toLowerCase().includes('quota') || 
                      error?.message?.toLowerCase().includes('resource-exhausted');
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

    const hasCache = loadFromCache();
    if (hasCache) {
      setLoading(false);
      // Wait a bit before background fetch to prioritize initial render
      const timer = setTimeout(() => {
        fetchCollections();
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      fetchCollections();
    }
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
