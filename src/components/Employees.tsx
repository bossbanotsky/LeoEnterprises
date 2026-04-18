import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Employee } from '../types';
import { Search, Plus, Briefcase, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { SmartText } from './ui/SmartText';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ customId: '', fullName: '', position: '', dailySalary: '' });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const emps: Employee[] = [];
      snapshot.forEach((doc) => emps.push({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'employees'));
    return () => unsubscribe();
  }, [user]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const dailySalary = parseFloat(form.dailySalary);
      const hourlyRate = dailySalary / 8;
      
      if (editingEmployee) {
        await updateDoc(doc(db, 'employees', editingEmployee.id), {
          customId: form.customId || '',
          fullName: form.fullName,
          position: form.position || 'Staff',
          dailySalary,
          hourlyRate,
        });
        setEditingEmployee(null);
      } else {
        await addDoc(collection(db, 'employees'), {
          customId: form.customId || '',
          fullName: form.fullName,
          position: form.position || 'Staff',
          status: 'active',
          dailySalary,
          hourlyRate,
          createdAt: new Date().toISOString(),
          uid: user.uid
        });
      }
      setIsAddOpen(false);
      setForm({ customId: '', fullName: '', position: '', dailySalary: '' });
    } catch (error) {
      handleFirestoreError(error, editingEmployee ? OperationType.UPDATE : OperationType.CREATE, 'employees');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
      setSelectedEmployee(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'employees');
    }
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      customId: emp.customId || '',
      fullName: emp.fullName,
      position: emp.position || '',
      dailySalary: emp.dailySalary.toString()
    });
    setSelectedEmployee(null);
    setIsAddOpen(true);
  };

  const handleUpdateStatus = async (emp: Employee) => {
    if (!user) return;
    try {
      const newStatus = emp.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'employees', emp.id), { status: newStatus });
      setSelectedEmployee({ ...emp, status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'employees');
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (emp.position && emp.position.toLowerCase().includes(searchQuery.toLowerCase()))
  ).sort((a, b) => a.fullName.localeCompare(b.fullName));

  return (
    <div className="h-full flex flex-col relative">
      <div className="mb-4">
        <SmartText as="h1" className="text-2xl font-bold text-slate-900 mb-4">Employees</SmartText>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            placeholder="Search employees..." 
            className="pl-10 bg-white border-slate-200 rounded-xl h-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        {filteredEmployees.map(emp => (
          <div 
            key={emp.id} 
            onClick={() => setSelectedEmployee(emp)}
            className="bento-card bg-white p-4 flex flex-row items-center gap-4 cursor-pointer hover:border-blue-300 transition-colors"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg shrink-0 border border-blue-100">
              <SmartText>{emp.fullName.charAt(0).toUpperCase()}</SmartText>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <SmartText as="h3" className="font-bold text-slate-900 truncate leading-tight block">{emp.fullName}</SmartText>
                {emp.customId && (
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1 rounded uppercase tracking-tighter border border-slate-100">
                    {emp.customId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs mt-1">
                <div className="flex items-center gap-1 text-slate-500 truncate">
                  <Briefcase className="w-3 h-3" />
                  <span className="truncate">{emp.position || 'Staff'}</span>
                </div>
                <div className="font-bold text-blue-600 flex items-center gap-0.5 whitespace-nowrap">
                  <span className="text-[10px] opacity-70">₱</span>
                  <span>{emp.dailySalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                emp.status === 'active' || !emp.status 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : 'bg-slate-50 text-slate-600 border border-slate-100'
              }`}>
                {emp.status || 'Active'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        ))}
        {filteredEmployees.length === 0 && (
          <div className="text-center py-10 text-slate-400 italic text-sm">
            No employees found matching the search.
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) {
          setEditingEmployee(null);
          setForm({ customId: '', fullName: '', position: '', dailySalary: '' });
        }
      }}>
        <DialogTrigger render={<button className="absolute bottom-6 right-2 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 z-10" />}>
          <Plus className="w-6 h-6" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddEmployee} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Employee ID (Optional)</Label>
              <Input value={form.customId} onChange={e => setForm({...form, customId: e.target.value})} placeholder="e.g. EMP-001" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input required value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input required value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Daily Salary (Php)</Label>
              <Input required type="number" step="0.01" value={form.dailySalary} onChange={e => setForm({...form, dailySalary: e.target.value})} className="rounded-xl" />
            </div>
            <Button type="submit" className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700">
              {editingEmployee ? 'Update Employee' : 'Save Employee'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-2xl shrink-0 border border-blue-100">
                    <SmartText>{selectedEmployee.fullName.charAt(0).toUpperCase()}</SmartText>
                  </div>
                  <div>
                    <SmartText as="h3" className="font-bold text-xl text-slate-900 leading-tight block">{selectedEmployee.fullName}</SmartText>
                    <SmartText className="text-slate-500">
                      {selectedEmployee.customId ? `${selectedEmployee.customId} • ` : ''}{selectedEmployee.position || 'Staff'}
                    </SmartText>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEdit(selectedEmployee)} className="rounded-full w-10 h-10 border-slate-200">
                    <Edit2 className="w-4 h-4 text-slate-600" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteEmployee(selectedEmployee.id)} className="rounded-full w-10 h-10 border-red-100 hover:bg-red-50 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl col-span-2 border border-black/5">
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Employee ID</div>
                  <div className="font-bold text-slate-900">{selectedEmployee.customId || 'No ID assigned'}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-black/5">
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Daily Salary</div>
                  <div className="font-bold text-slate-900">₱ {selectedEmployee.dailySalary.toFixed(2)}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-black/5">
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Hourly Rate</div>
                  <div className="font-bold text-slate-900">₱ {selectedEmployee.hourlyRate.toFixed(2)}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <SmartText className="font-medium text-slate-900">Account Status</SmartText>
                    <SmartText className="text-sm text-slate-500">
                      Currently {selectedEmployee.status || 'active'}
                    </SmartText>
                  </div>
                  <Button 
                    variant={selectedEmployee.status === 'active' || !selectedEmployee.status ? 'destructive' : 'default'}
                    onClick={() => handleUpdateStatus(selectedEmployee)}
                    className="rounded-xl px-6"
                  >
                    {selectedEmployee.status === 'active' || !selectedEmployee.status ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
