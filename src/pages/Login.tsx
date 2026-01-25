import React, { useState } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from '@/firebase';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, Eye, EyeOff, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Ensure persistence is set to local (survives browser restarts)
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);

      // Clear procedure cache on login as requested
      localStorage.removeItem('srrortho:procedures_cache');

      toast.success('Logged in successfully');

      // Use a small delay to ensure Auth state is updated before redirecting
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } catch (error: any) {
      console.error('Login error:', error);
      let message = 'Failed to login';
      if (error.code === 'auth/user-not-found') message = 'No user found with this email';
      else if (error.code === 'auth/wrong-password') message = 'Incorrect password';
      else if (error.code === 'auth/invalid-credential') message = 'Invalid email or password';

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up z-10">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-glow">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            SRR Ortho Implant
          </h1>
          <p className="text-muted-foreground">
            Delivery Challan Generator
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-8 border border-white/20 shadow-2xl backdrop-blur-xl bg-white/40">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl font-semibold text-slate-800">Sign In</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 bg-white/50 border-slate-200 focus:border-blue-500 rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 bg-white/50 border-slate-200 focus:border-blue-500 rounded-xl"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg transition-all duration-200 active:scale-[0.98] font-semibold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-muted-foreground text-sm mt-6">
          Secure access for authorized personnel only
        </p>
      </div>
    </div>
  );
};

export default Login;
