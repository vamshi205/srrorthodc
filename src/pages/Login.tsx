import React, { useState } from "react";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "@/firebase";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);

      // Clear procedure cache on login
      localStorage.removeItem("srrortho:procedures_cache");

      toast.success("Logged in successfully");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 400);
    } catch (error: any) {
      console.error("Login error:", error);
      let message = "Failed to login";
      if (error.code === "auth/user-not-found") message = "No account found with this email";
      else if (error.code === "auth/wrong-password") message = "Incorrect password";
      else if (error.code === "auth/invalid-credential") message = "Invalid email or password";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-teal-500 selection:text-white">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(rgba(15, 118, 110, 0.15) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Clean Shadcn Card */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          <CardHeader className="space-y-3 text-center pb-4 border-b border-slate-100 dark:border-slate-800/80 px-6 pt-6 flex flex-col items-center">
            {/* Logo inside card */}
            <img
              src="/srr-logo.png"
              alt="SRR Ortho Plus"
              className="h-12 sm:h-14 w-auto object-contain"
            />
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Sign in to workspace
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your credentials to access operations portal
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-5 px-6">
              {/* Email Input */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@srrortho.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-xs bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus-visible:ring-1 focus-visible:ring-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 h-10 text-xs bg-slate-50/70 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus-visible:ring-1 focus-visible:ring-teal-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-4 pb-6 px-6">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-sm gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer Security Badge */}
        <p className="text-center text-slate-400 dark:text-slate-500 text-[11px] font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Encrypted Portal Access</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
