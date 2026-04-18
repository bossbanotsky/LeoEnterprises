import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { Building2, Settings as SettingsIcon, Shield, Moon, Sun, ChevronRight, LogOut, AlertCircle, X, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const { companyInfo, updateCompanyInfo } = useCompanyInfo();
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: '', address: '', contact: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDarkMode(true);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Settings</h1>

      <div className="space-y-6 flex-1 overflow-y-auto pb-6 pr-1">
        {/* Profile Section */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bento-card flex-col bg-white dark:bg-slate-800 p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-6 flex items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold text-3xl shadow-lg transform group-hover:scale-105 transition-transform duration-300">
                  {user?.email?.[0].toUpperCase() || 'A'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-white dark:border-slate-800 rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-slate-900 dark:text-white text-xl truncate">{user?.email}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider rounded-md">Admin</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{companyInfo.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Organization</h3>
          <div className="bento-card flex-col bg-white dark:bg-slate-800 p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-sm">
            <div 
              className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
              onClick={() => {
                setCompanyForm(companyInfo);
                setShowCompanyDialog(true);
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="block font-semibold text-slate-900 dark:text-white">Company Info</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Business details & branding</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <SettingsIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <span className="block font-semibold text-slate-900 dark:text-white">Payroll Settings</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Rates, taxes & deductions</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors" />
            </div>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <span className="block font-semibold text-slate-900 dark:text-white">User Roles</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Permissions & access control</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>
          </div>
        </div>

        {/* System Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">System</h3>
          <div className="bento-card flex-col bg-white dark:bg-slate-800 p-0 overflow-hidden border-slate-200 dark:border-slate-700 shadow-sm">
            <div 
              className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
              onClick={() => navigate('/settings/logs')}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <span className="block font-semibold text-slate-900 dark:text-white">Logs & Errors</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">System health & audit trails</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" />
            </div>
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
              onClick={toggleDarkMode}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isDarkMode ? <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <Sun className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
                </div>
                <div>
                  <span className="block font-semibold text-slate-900 dark:text-white">Dark Mode</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Adjust visual appearance</span>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full p-1 transition-all duration-300 ${isDarkMode ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button 
            variant="ghost" 
            className="w-full h-14 rounded-2xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-300 font-bold border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
            onClick={logout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out of Account
          </Button>
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-4 uppercase tracking-[0.2em]">
            {companyInfo.name} v1.0.4
          </p>
        </div>
      </div>

      {/* Company Info Dialog */}
      <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Company Info</DialogTitle>
            </div>
            <DialogClose className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </DialogClose>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Company Name</Label>
              <Input
                id="companyName"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900"
                placeholder="e.g. Leo Enterprises"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Business Address</Label>
              <Input
                id="companyAddress"
                value={companyForm.address}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900"
                placeholder="Complete Business Address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyContact" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contact Info</Label>
              <Input
                id="companyContact"
                value={companyForm.contact}
                onChange={(e) => setCompanyForm({ ...companyForm, contact: e.target.value })}
                className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900"
                placeholder="Phone or Email"
              />
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
            <Button
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
              disabled={isSaving || !companyForm.name.trim()}
              onClick={async () => {
                try {
                  setIsSaving(true);
                  await updateCompanyInfo(companyForm);
                  setShowCompanyDialog(false);
                } catch (e) {
                  // error handled in hook
                } finally {
                  setIsSaving(false);
                }
              }}
            >
              {isSaving ? 'Saving...' : (
                <span className="flex items-center justify-center gap-2">
                  <Save className="w-5 h-5" /> Save Changes
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
