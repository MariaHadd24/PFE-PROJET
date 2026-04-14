import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import logoImage from '../assets/leoni-logo.svg';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const REMEMBERED_EMAIL_KEY = 'leoni.rememberedEmail';

const DEMO_ACCOUNTS = [
  { role: 'Administrateur IT', email: 'admin@leoni.example' },
  { role: 'Technicien', email: 'tech@leoni.example' },
  { role: 'Manager', email: 'manager@leoni.example' },
  { role: 'Lecteur', email: 'reader@leoni.example' },
] as const;

const DEMO_PASSWORD = '123456';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    try {
      const remembered = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (remembered) {
        setEmail(remembered);
        setRememberEmail(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');

    const nextEmail = email.trim();
    const nextPassword = password;

    if (!nextEmail || !nextPassword) {
      setError('Please fill in all fields');
      setIsSubmitting(false);
      return;
    }

    try {
      const success = await login(nextEmail, nextPassword);
      if (success) {
        try {
          if (rememberEmail) localStorage.setItem(REMEMBERED_EMAIL_KEY, nextEmail);
          else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        } catch {
          // ignore
        }
        return;
      }
      setError('Incorrect email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-dvh bg-gradient-to-br from-[#0A1929] via-[#1B4F91] to-[#0F2744] flex items-center justify-center p-2 sm:p-3 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Aurora layer */}
        <div className="absolute inset-0 opacity-60 bg-gradient-to-r from-[#1B4F91]/30 via-purple-500/20 to-cyan-500/20 animate-gradient" />

        {/* Floating orbs */}
        <div className="absolute top-16 left-16 w-96 h-96 bg-blue-500/18 rounded-full blur-3xl animate-float-slower" />
        <div className="absolute bottom-16 right-16 w-80 h-80 bg-purple-500/18 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-cyan-500/12 rounded-full blur-3xl animate-float-slower" style={{ animationDelay: '0.8s' }} />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'center center'
          }}></div>
        </div>
        
        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
        <div className="absolute top-3/4 right-1/3 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
      </div>

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14, filter: 'blur(8px)' }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
      >
        {/* Logo Section */}
        <div className="text-center mb-2">
          {/* Premium Logo Container */}
          <motion.div
            className="relative inline-block mb-2"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
            transition={shouldReduceMotion ? undefined : { type: 'spring', stiffness: 260, damping: 22 }}
          >
            {/* Outer glow ring - animated */}
            <div className="absolute -inset-5">
              <div className="w-full h-full rotate-0 animate-spin-slow">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-purple-500 opacity-30 blur-2xl"></div>
              </div>
            </div>
            
            {/* Middle ring - counter rotation */}
            <div className="absolute -inset-3">
              <div className="w-full h-full -rotate-45 animate-reverse-spin">
                <div className="absolute top-0 left-1/2 w-3 h-3 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"></div>
                <div className="absolute bottom-0 right-1/2 w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50"></div>
                <div className="absolute top-1/2 right-0 w-2.5 h-2.5 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50"></div>
              </div>
            </div>
            
            {/* Logo Card */}
            <div className="relative">
              {/* Glass effect background */}
              <div className="absolute inset-0 bg-white/10 backdrop-blur-2xl rounded-[2rem] border border-white/20 shadow-2xl"></div>
              
              {/* Inner glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-transparent to-purple-400/20 rounded-[2rem]"></div>

              {/* Subtle highlight */}
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/10 via-transparent to-transparent"></div>
              
              {/* Logo container */}
              <div className="relative px-7 py-5">
                <div className="relative">
                  {/* Logo shadow */}
                  <div className="absolute inset-0 blur-xl bg-gradient-to-r from-blue-500 to-purple-500 opacity-50"></div>
                  <img src={logoImage} alt="LEONI" className="h-16 w-auto block mx-auto relative z-10 drop-shadow-2xl" />
                </div>
              </div>
              
              {/* Animated corner accents */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-blue-400/60 rounded-tl-2xl animate-pulse"></div>
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-2xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-purple-400/60 rounded-bl-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-blue-400/60 rounded-br-2xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
            </div>
          </motion.div>
          
          {/* Brand Title */}
          <div className="mb-1 space-y-1">
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-10 bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                <span className="text-xs font-bold text-blue-100 tracking-wider">LEONI SYSTEMS</span>
              </div>
              <div className="h-px w-10 bg-gradient-to-l from-transparent via-blue-400 to-transparent"></div>
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-6 bg-gradient-to-r from-transparent to-blue-400/50"></div>
              <p className="text-blue-200 text-sm font-semibold tracking-wide">
                Enterprise Asset Management
              </p>
              <div className="h-px w-6 bg-gradient-to-l from-transparent to-blue-400/50"></div>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="relative">
          {/* Form glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-3xl opacity-25 blur-xl"></div>
          
          {/* Form card */}
          <div className="relative bg-white/92 backdrop-blur-xl rounded-3xl shadow-2xl p-5 border border-white/25 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-blue-50/30"></div>
            <div className="pointer-events-none absolute -top-24 -right-24 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl"></div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-[#1B4F91] to-[#2563EB] bg-clip-text text-transparent mb-3">
              Secure Sign In
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-1.5">
                  Email
                </label>
                <div className="group relative">
                  <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-[#1B4F91]/30 via-[#2563EB]/30 to-cyan-500/30 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="relative w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/80 border border-gray-200/90 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-[#1B4F91]/40 focus:border-transparent outline-none transition-all shadow-sm"
                    placeholder="votre.email@leoni.com"
                    autoComplete="username"
                    inputMode="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-1.5">
                  Password
                </label>
                <div className="group relative">
                  <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-[#1B4F91]/30 via-[#2563EB]/30 to-cyan-500/30 opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setIsCapsLockOn(e.getModifierState('CapsLock'))}
                    onKeyDown={(e) => setIsCapsLockOn(e.getModifierState('CapsLock'))}
                    className="relative w-full pl-11 pr-11 py-2.5 rounded-xl bg-white/80 border border-gray-200/90 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-[#1B4F91]/40 focus:border-transparent outline-none transition-all shadow-sm"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember + CapsLock */}
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#1B4F91] focus:ring-[#1B4F91]/40"
                  />
                  Remember email
                </label>

                <AnimatePresence initial={false}>
                  {isCapsLockOn && (
                    <motion.div
                      key="caps"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="text-xs font-semibold text-amber-700"
                    >
                      Caps Lock is ON
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Error Message */}
              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    key="error"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full relative group overflow-hidden bg-gradient-to-r from-[#1B4F91] via-[#2563EB] to-[#3B82F6] text-white py-2.5 rounded-xl font-bold transition-all duration-300 ${
                  isSubmitting
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-[1.02]'
                }`}
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute -left-1/3 top-0 h-full w-1/3 rotate-12 bg-white/20 blur-md" />
                </div>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </form>

            {/* Demo Info */}
            <div className="mt-3 p-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-0.5">Demo accounts</p>
                  <p className="text-xs text-blue-700">
                    Password (test): <span className="font-mono">{DEMO_PASSWORD}</span>
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-0.5">
                    {DEMO_ACCOUNTS.map((a) => (
                      <div key={a.email} className="text-xs text-blue-800">
                        <span className="font-semibold">{a.role}:</span> <span className="font-mono">{a.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-2 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
            <p className="text-blue-200 text-xs font-medium">
              Secure and encrypted system
            </p>
          </div>
          <p className="text-blue-300/60 text-xs">© 2026 LEONI. All rights reserved.</p>
        </div>
      </motion.div>
    </div>
  );
}