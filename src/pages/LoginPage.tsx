import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LogIn, Mail, Lock, Loader2, ArrowLeft, ArrowRight, ShieldCheck, User, LayoutGrid } from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

export default function LoginPage() {
  const { user, userData, loading, loginWithEmail, loginWithGoogleContext } = useAuth();
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user && !loading) {
    if (userData?.role === 'admin') return <Navigate to="/admin-dashboard" />;
    if (userData?.role === 'ceo') return <Navigate to="/ceo-dashboard" />;
    return <Navigate to="/employee-dashboard" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    try {
      setError(null);
      setIsLoading(true);
      await loginWithEmail(email, password);
    } catch (err: any) {
      const errorCode = err.code || "";
      const errorMessage = err.message || "";
      
      if (
        errorCode === 'auth/invalid-credential' || 
        errorCode === 'auth/user-not-found' || 
        errorCode === 'auth/wrong-password' ||
        errorMessage.includes('auth/invalid-credential') ||
        errorMessage.includes('auth/user-not-found') ||
        errorMessage.includes('auth/wrong-password')
      ) {
        setError('Invalid credentials. Please attempt again.');
      } else {
        setError(errorMessage || 'Authentication failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setIsLoading(true);
      await loginWithGoogleContext();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[480px] relative z-10"
      >
        <div className="bg-black/25 border border-white/10 shadow-2xl rounded-[40px] overflow-hidden p-10 lg:p-14">
          <div className="flex items-center justify-between mb-12">
            <Link to="/">
              <div className="flex items-center gap-2 group cursor-pointer">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center rotate-3 border border-white/20 shadow-lg shadow-blue-500/20">
                  <LayoutGrid className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-sm tracking-tight text-white uppercase italic leading-none">LEO <span className="text-blue-500">ENTERPRISES</span></span>
                  <span className="font-bold text-[8px] tracking-[0.2em] text-white/40 uppercase mt-1">Operational Command</span>
                </div>
              </div>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="text-[11px] font-bold text-white/50 uppercase tracking-widest hover:text-white transition-colors hover:bg-white/5">
                <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Exit
              </Button>
            </Link>
          </div>

          <div className="mb-12 text-left">
            <h1 className="text-4xl font-black text-white tracking-[-0.04em] leading-none mb-3 uppercase italic">
              {role === 'admin' ? 'Strategic' : 'Operational'} <br /> 
              <span className="text-blue-500">Access Portal.</span>
            </h1>
            <p className="text-sm font-semibold text-white/80 tracking-tight">Enter your secure credentials to log into the command center.</p>
          </div>

          <div className="bg-white/5 p-1 rounded-2xl mb-10 flex border border-white/10">
              <button 
                  onClick={() => setRole('employee')}
                  className={`flex-1 flex items-center justify-center rounded-xl h-11 text-xs font-bold transition-all duration-300 ${role === 'employee' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                  <User className="w-3.5 h-3.5 mr-2" /> Employee
              </button>
              <button 
                  onClick={() => setRole('admin')}
                  className={`flex-1 flex items-center justify-center rounded-xl h-11 text-xs font-bold transition-all duration-300 ${role === 'admin' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                  <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Administrator
              </button>
          </div>

          {error && (
            <div className="mb-8 p-5 text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-2xl font-bold uppercase tracking-widest leading-relaxed">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-300 tracking-[2px] ml-1 text-left block">Identity Resource</label>
              <div className="relative">
                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@leoenterprises.ph" 
                  className="pl-14 h-14 md:h-16 rounded-[20px] border-white/10 bg-white/5 focus:bg-white/10 text-white text-[15px] font-medium transition-all focus:ring-4 focus:ring-blue-600/20" 
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-300 tracking-[2px] ml-1 text-left block">Security Descriptor</label>
              <div className="relative">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="pl-14 h-14 md:h-16 rounded-[20px] border-white/10 bg-white/5 focus:bg-white/10 text-white text-[15px] font-medium transition-all focus:ring-4 focus:ring-blue-600/20" 
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit"
              className={`w-full h-16 md:h-20 rounded-full ${role === 'admin' ? 'bg-white text-slate-950 border-white' : 'bg-blue-600'} text-white shadow-2xl ${role === 'admin' ? 'shadow-white/10' : 'shadow-blue-600/30'} transition-all active:scale-95 font-bold uppercase italic tracking-tighter text-lg mt-6 group border-0`}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="flex items-center text-inherit">{role === 'admin' ? <span className="text-slate-950">Authorize Application</span> : 'Authorize Application'} <ArrowRight className={`ml-3 w-5 h-5 group-hover:translate-x-2 transition-transform duration-300 ${role === 'admin' ? 'text-slate-950' : 'text-white'}`} /></span>}
            </Button>
          </form>

          {role === 'employee' && (
              <div className="mt-10">
                  <div className="w-full relative py-6 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative bg-transparent px-4 text-[10px] font-bold text-slate-300 uppercase tracking-[3px]">SSO Integration</div>
                  </div>

                  <Button 
                    onClick={handleGoogleLogin} 
                    type="button"
                    variant="ghost"
                    className="w-full h-14 rounded-2xl flex items-center justify-center border border-white/10 hover:bg-white/5 transition-all font-bold uppercase tracking-wider text-xs text-slate-300"
                    disabled={isLoading}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 mr-3">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </Button>
              </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

