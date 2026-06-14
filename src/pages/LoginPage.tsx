import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LogIn, Mail, Lock, Loader2, ArrowLeft, ArrowRight, ShieldCheck, User, LayoutGrid } from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';

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
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[480px] relative z-10"
      >
        <div className="bg-slate-900/80 border border-amber-600/15 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl rounded-[40px] overflow-hidden p-8 sm:p-11">
          <div className="flex items-center justify-between mb-8">
            <Link to="/">
              <div className="flex items-center gap-2 group cursor-pointer">
                <div className="w-9 h-9 bg-amber-600 rounded-xl flex items-center justify-center border border-amber-500/20 shadow-md shadow-amber-600/10">
                  <LayoutGrid className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-xs tracking-tight text-foreground uppercase italic leading-none">
                    L & P <span className="text-amber-600">TRADING</span>
                  </span>
                  <span className="font-bold text-[7px] tracking-wider text-stone-400 uppercase mt-0.5">STAFF TERMINAL</span>
                </div>
              </div>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="text-[10px] font-bold text-stone-500 hover:text-foreground uppercase tracking-widest hover:bg-amber-600/5 h-8 px-3 rounded-lg">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Exit
              </Button>
            </Link>
          </div>

          <div className="mb-8 text-left">
            <h1 className="text-3xl font-black text-foreground tracking-tight leading-none mb-2 uppercase">
              {role === 'admin' ? 'Strategic' : 'Operational'} <br /> 
              <span className="text-amber-600">Secure Entry.</span>
            </h1>
            <p className="text-xs font-semibold text-stone-500">Provide official email coordinates to authorize this session.</p>
          </div>

          <div className="bg-slate-800/80 p-1 rounded-2xl mb-8 flex border border-stone-700/50">
            <button 
              type="button"
              onClick={() => setRole('employee')}
              className={`flex-1 flex items-center justify-center rounded-xl h-10 text-xs font-bold transition-all duration-300 ${role === 'employee' ? 'bg-slate-700 text-foreground shadow-sm' : 'text-stone-500 hover:text-foreground'}`}
            >
              <User className="w-3.5 h-3.5 mr-1.5" /> Employee Portal
            </button>
            <button 
              type="button"
              onClick={() => setRole('admin')}
              className={`flex-1 flex items-center justify-center rounded-xl h-10 text-xs font-bold transition-all duration-300 ${role === 'admin' ? 'bg-amber-600 text-white shadow-sm' : 'text-stone-500 hover:text-foreground'}`}
            >
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Administrator
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded-2xl font-bold uppercase tracking-widest leading-relaxed">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-stone-400 tracking-widest ml-1 text-left block">Identity coordinate</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@lptradingandservices.com" 
                  className="pl-12 h-13 rounded-2xl border-stone-700/50 bg-slate-800/50 focus:bg-slate-800 text-foreground text-sm font-medium transition-all" 
                  required
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-stone-400 tracking-widest ml-1 text-left block">Security passcode</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="pl-12 h-13 rounded-2xl border-stone-700/50 bg-slate-800/50 focus:bg-slate-800 text-foreground text-sm font-medium transition-all" 
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit"
              className={`w-full h-15 rounded-full ${role === 'admin' ? 'bg-stone-900 hover:bg-stone-800 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'} transition-all active:scale-95 font-bold uppercase tracking-widest text-xs mt-4`}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="flex items-center text-inherit justify-center gap-2">
                  Authorize Credentials
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {role === 'employee' && (
            <div className="mt-8">
              <div className="w-full relative py-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200/60"></div>
                </div>
                <div className="relative bg-slate-900 px-3 text-[9px] font-black text-stone-400 uppercase tracking-widest">Single Sign On</div>
              </div>

              <Button 
                onClick={handleGoogleLogin} 
                type="button"
                variant="ghost"
                className="w-full h-12 rounded-2xl flex items-center justify-center border border-stone-250 bg-stone-50/50 hover:bg-amber-50/30 transition-all font-bold uppercase tracking-widest text-[9px] text-stone-600"
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mr-2 shrink-0">
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
