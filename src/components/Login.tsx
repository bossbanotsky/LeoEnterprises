import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { user, userData, loading, loginWithEmail, loginWithGoogleContext } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // IMPORTANT: Wait for both auth state and user profile (role) to be ready before redirecting.
  // This prevents the "blank" or "wrong portal" redirect issue for admins.
  if (user && !loading && userData) {
    return <Navigate to="/" />;
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
      console.error(err);
      setError(err.code === 'auth/invalid-credential' 
        ? 'Invalid email or password.' 
        : err.message || 'Authentication failed. Please check your credentials.');
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Sea Waves */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-30">
        <svg className="absolute top-0 left-0 w-full h-64 -translate-y-1/2 fill-blue-400/20" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,144C672,139,768,181,864,181.3C960,181,1056,139,1152,122.7C1248,107,1344,117,1392,122.7L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
        </svg>
        <svg className="absolute bottom-0 left-0 w-full h-96 translate-y-1/3 fill-blue-500/10" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,250.7C960,235,1056,181,1152,149.3C1248,117,1344,107,1392,101.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      <Card className="w-full max-w-md relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-blue-100 dark:border-blue-900/30 shadow-2xl rounded-3xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-teal-400 to-blue-600"></div>
        <CardHeader className="text-center space-y-2 pt-10 pb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 rotate-3">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Banotsky</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400 font-medium">Manage HR, Attendance, and Payroll</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center pt-2 pb-10 space-y-6 px-8">
          {error && (
            <div className="w-full p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 font-medium">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com" 
                  className="pl-10 h-12 rounded-xl border-slate-200 focus:border-blue-500" 
                  required
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="pl-10 h-12 rounded-xl border-slate-200 focus:border-blue-500" 
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit"
              size="lg" 
              className="w-full h-14 rounded-2xl flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all active:scale-95 font-bold text-lg mt-2"
              disabled={isLoading}
            >
              {isLoading || (user && !userData) ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Sign In</span>}
            </Button>
          </form>

          <div className="w-full relative py-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative bg-white dark:bg-slate-900 px-4 text-xs font-medium text-slate-400">OR</div>
          </div>

          <Button 
            onClick={handleGoogleLogin} 
            type="button"
            variant="outline"
            size="lg" 
            className="w-full h-12 rounded-2xl flex items-center justify-center space-x-3 transition-all font-semibold"
            disabled={isLoading || (user && !userData)}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            <span>{user && !userData ? 'Identifying Admin...' : 'Continue with Google'}</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
