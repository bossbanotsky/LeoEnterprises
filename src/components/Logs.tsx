import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { AlertCircle, Info } from 'lucide-react';

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs: any[] = [];
      snapshot.forEach(doc => fetchedLogs.push({ id: doc.id, ...doc.data() }));
      setLogs(fetchedLogs);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'logs'));
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">System Logs & Errors</h1>
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {logs.map(log => (
          <div key={log.id} className="bento-card bg-white dark:bg-slate-800 p-4 flex gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${log.level === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {log.level === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 dark:text-white">{log.message}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{format(parseISO(log.createdAt), 'MMM dd, yyyy HH:mm:ss')}</div>
              {log.details && (
                <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded-lg overflow-x-auto text-slate-700 dark:text-slate-300">
                  {log.details}
                </pre>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400">
            No logs found.
          </div>
        )}
      </div>
    </div>
  );
}
