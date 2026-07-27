import React, { useState } from 'react';
import { auth, hasFirebaseConfig } from '../firebase';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Lock, Mail, AlertCircle, Loader2, Key } from 'lucide-react';
import logoImg from '../assets/logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If Firebase is not configured yet, show setup instructions with a premium theme
  if (!hasFirebaseConfig) {
    return (
      <div className="w-full flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans z-10">
        <div className="sm:mx-auto sm:w-full sm:max-w-xl">
          <div className="bg-white/80 backdrop-blur-xl py-10 px-8 sm:px-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[32px] border border-white/60">
            <div className="flex items-center justify-between mb-6">
              <div className="relative w-40 h-20 flex items-center justify-center p-1">
                <img src={logoImg} alt="SRR Ortho Plus Logo" className="max-w-full max-h-full object-contain mix-blend-multiply" />
              </div>
              <div className="w-12 h-12 bg-[var(--srr-green-light)] rounded-xl flex items-center justify-center">
                <Key size={24} className="text-[var(--srr-green)]" />
              </div>
            </div>
            <h2 className="text-[26px] font-bold tracking-tight text-[var(--apple-black)] mb-3">
              Firebase Configuration Required
            </h2>
            <p className="text-[15px] text-[var(--apple-gray-5)] mb-6 leading-relaxed">
              To secure your quotation builder, you need to connect it to your free Firebase project. Follow these steps:
            </p>
            <ol className="list-decimal pl-5 space-y-3 text-[14px] text-[var(--apple-black)] mb-8">
              <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-[var(--srr-green)] hover:underline font-semibold">console.firebase.google.com</a> and click "Create a project".</li>
              <li>Once created, click the <strong>Web icon (&lt;/&gt;)</strong> to register an app.</li>
              <li>Copy the `firebaseConfig` block it gives you.</li>
              <li>Create a `.env.local` file in the root of this project and paste your keys like this:</li>
            </ol>
            <div className="bg-[var(--apple-gray-1)] p-5 rounded-2xl font-mono text-[13px] text-[var(--apple-gray-5)] mb-6 overflow-x-auto border border-[var(--apple-gray-2)]">
              VITE_FIREBASE_API_KEY=your_api_key<br/>
              VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com<br/>
              VITE_FIREBASE_PROJECT_ID=your_project_id<br/>
              VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com<br/>
              VITE_FIREBASE_MESSAGING_SENDER_ID=123456789<br/>
              VITE_FIREBASE_APP_ID=1:12345:web:abcde
            </div>
            <p className="text-[14px] text-[var(--apple-gray-5)] bg-[var(--srr-green-light)] p-4 rounded-xl text-[var(--srr-green)] font-medium">
              Restart your development server (`npm run dev`) after adding the `.env.local` file.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError('Google sign-in failed. Please ensure it is enabled in your Firebase console.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="sm:mx-auto sm:w-full sm:max-w-[420px]">
        {/* Glassmorphic Form Container */}
        <div className="bg-white/80 backdrop-blur-xl py-10 px-8 sm:px-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] rounded-[32px] border border-white/60">
          <form className="space-y-6" onSubmit={handleLogin}>
            
            {/* Logo inside card, on white background */}
            <div className="flex justify-center mb-6">
              <div className="w-48 h-24 flex items-center justify-center bg-white rounded-2xl p-2.5 border border-[var(--apple-gray-3)] shadow-sm">
                <img src={logoImg} alt="SRR Ortho Plus Logo" className="max-w-full max-h-full object-contain" />
              </div>
            </div>

            {error && (
              <div className="bg-red-50/80 backdrop-blur-sm text-red-600 p-4 rounded-2xl flex items-start gap-3 text-[14px] leading-snug border border-red-100 animate-in fade-in duration-300">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 border border-[var(--apple-gray-3)] rounded-2xl text-[15px] font-semibold text-[var(--apple-black)] bg-white hover:bg-[var(--apple-gray-1)] active:scale-[0.98] transition-all shadow-sm hover:border-[var(--srr-green)]/30 hover:shadow-[0_4px_12px_rgba(0,96,57,0.04)]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-[var(--apple-gray-2)]"></div>
              <span className="flex-shrink-0 mx-4 text-[var(--apple-gray-5)] text-[13px] font-medium">Or continue with email</span>
              <div className="flex-grow border-t border-[var(--apple-gray-2)]"></div>
            </div>

            <div>
              <label className="apple-label block mb-2 font-bold">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[var(--apple-gray-4)]" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="apple-input !pl-11 w-full focus:!border-[var(--srr-green)] focus:!shadow-[0_0_0_3px_rgba(0,96,57,0.15)]"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="apple-label block mb-2 font-bold">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[var(--apple-gray-4)]" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="apple-input !pl-11 w-full focus:!border-[var(--srr-green)] focus:!shadow-[0_0_0_3px_rgba(0,96,57,0.15)]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white bg-gradient-to-r from-[var(--srr-green)] to-[#10b981] hover:from-[var(--srr-green-hover)] hover:to-[#059669] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,96,57,0.15)] disabled:opacity-75 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
