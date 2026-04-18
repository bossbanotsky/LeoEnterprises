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
    <div className="h-full flex flex-col w-full">
      <h1 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight">System Logs & Errors</h1>
      <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
        {logs.map(log => (
          <div key={log.id} className="bento-card bg-white p-4 flex gap-4 border-black/5 shadow-sm">
            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border ${log.level === 'error' ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-inner' : 'bg-blue-50 text-blue-600 border-blue-100 shadow-inner'}`}>
              {log.level === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 text-sm leading-tight">{log.message}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 opacity-70">{format(parseISO(log.createdAt), 'MMM dd, yyyy • HH:mm:ss')}</div>
              {log.details && (
                <pre className="mt-3 text-[11px] bg-slate-50 p-3 rounded-xl overflow-x-auto text-slate-600 border border-slate-100 leading-relaxed italic">
                  {log.details}
                </pre>
              )}
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center py-12 text-slate-400 italic text-sm">
            No system activity logs found.
          </div>
        )}
      </div>
    </div>
  );
}
