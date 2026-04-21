import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { LogIn, Mail, Lock, Loader2, ArrowLeft, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import EtherealMeshBackground from '../components/EtherealMeshBackground';

export default function LoginPage() {
  const { user, userData, loading, loginWithEmail, loginWithGoogleContext } = useAuth();
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user && !loading) {
    return <Navigate to={userData?.role === 'admin' ? "/admin-dashboard" : "/employee-dashboard"} />;
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
        // We handle this as a standard UI feedback, not a system failure
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (errorCode === 'auth/invalid-email' || errorMessage.includes('auth/invalid-email')) {
        setError('Please enter a valid email address.');
      } else if (errorCode === 'auth/too-many-requests' || errorMessage.includes('auth/too-many-requests')) {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else {
        // Only log errors that are NOT standard credential failures
        console.error("Login error details:", err);
        setError(errorMessage || 'Authentication failed. Please try again.');
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
      console.error(err);
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <EtherealMeshBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] rounded-[2.5rem] overflow-hidden">
          <div className={`h-2 ${role === 'admin' ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-950' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-700'}`} />
          
          <div className="pt-6 px-6">
            <Link to="/">
              <Button variant="ghost" className="text-slate-500 hover:text-blue-900 gap-2 font-black uppercase tracking-wider text-xs">
                <ArrowLeft className="w-4 h-4" /> Back Home
              </Button>
            </Link>
          </div>
          
          <CardHeader className="text-center space-y-2 pt-2 pb-6">
            <div className={`w-20 h-20 ${role === 'admin' ? 'bg-slate-900' : 'bg-blue-600'} rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl ${role === 'admin' ? 'rotate-6' : '-rotate-6'} mb-4 text-white`}>
              {role === 'admin' ? <ShieldCheck className="w-10 h-10" /> : <LogIn className="w-10 h-10" />}
            </div>
            <CardTitle className="text-3xl font-black text-slate-900 tracking-tight">
              {role === 'admin' ? 'Admin Console' : 'Staff Portal'}
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium italic">
              {role === 'admin' ? 'Secure Company Administration' : 'Access records & attendance'}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-10 pb-12">
            <div className="bg-slate-100 p-1 rounded-2xl mb-8 flex">
                <Button 
                    variant={role === 'employee' ? 'default' : 'ghost'} 
                    className={`flex-1 rounded-xl h-10 ${role === 'employee' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    onClick={() => setRole('employee')}
                >
                    <User className="w-4 h-4 mr-2" /> Employee
                </Button>
                <Button 
                    variant={role === 'admin' ? 'default' : 'ghost'} 
                    className={`flex-1 rounded-xl h-10 ${role === 'admin' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'}`}
                    onClick={() => setRole('admin')}
                >
                    <ShieldCheck className="w-4 h-4 mr-2" /> Admin
                </Button>
            </div>

            {error && (
              <div className="mb-6 p-4 text-xs text-red-600 bg-red-50 rounded-2xl border border-red-100 font-bold uppercase tracking-wide">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com" 
                    className="pl-12 h-14 rounded-2xl border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all" 
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-400 ml-1 tracking-widest leading-none">{role === 'admin' ? 'Secret Key' : 'Security Pin'}</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="pl-12 h-14 rounded-2xl border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all" 
                    required
                  />
                </div>
              </div>
              
              <Button 
                type="submit"
                size="lg" 
                className={`w-full h-16 rounded-2xl ${role === 'admin' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'} text-white shadow-xl ${role === 'admin' ? 'shadow-slate-900/20' : 'shadow-blue-600/20'} transition-all active:scale-[0.98] font-black text-lg mt-4 group`}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{role === 'admin' ? 'Authorize' : 'Access Portal'} <ArrowRight className="inline ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>}
              </Button>
            </form>

            {role === 'employee' && (
                <>
                    <div className="w-full relative py-8 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative bg-white/0 px-4 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Quick SSO</div>
                    </div>

                    <Button 
                    onClick={handleGoogleLogin} 
                    type="button"
                    variant="outline"
                    size="lg" 
                    className="w-full h-14 rounded-2xl flex items-center justify-center space-x-3 transition-all font-black uppercase tracking-wider text-sm border-slate-200 hover:bg-slate-50"
                    disabled={isLoading}
                    >
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        <path d="M1 1h22v22H1z" fill="none" />
                    </svg>
                    <span>Continue with Google</span>
                    </Button>
                </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
