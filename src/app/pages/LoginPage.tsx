import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import logoImage from '../assets/leoni-logo.svg';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const REMEMBERED_EMAIL_KEY = 'leoni.rememberedEmail';

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
    <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-2 py-4 sm:px-4 sm:py-6">
      {/* Background layers */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_85%_25%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_50%_85%,rgba(96,165,250,0.10),transparent_30%)] animate-gradient opacity-90" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04)_0%,transparent_30%,rgba(255,255,255,0.03)_70%,transparent_100%)] opacity-60" />

        <div className="absolute -top-24 -left-20 h-[28rem] w-[28rem] rounded-full bg-cyan-500/18 blur-3xl animate-float-slower" />
        <div className="absolute -bottom-28 -right-16 h-[24rem] w-[24rem] rounded-full bg-blue-500/18 blur-3xl animate-float-slow" />
        <div className="absolute top-1/3 right-[-6rem] h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" style={{ animationDelay: '0.8s' }} />

        <div className="absolute inset-0 opacity-[0.09]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(148, 163, 184, 0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.28) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
              transform: 'perspective(900px) rotateX(66deg) rotateZ(45deg)',
              transformOrigin: 'center center',
            }}
          />
        </div>

        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/8 via-white/0 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/20 via-black/0 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_68%,rgba(8,15,30,0.22)_100%)]" />

        <div className="absolute top-1/4 left-[18%] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.75)] animate-pulse" style={{ animationDelay: '0s' }} />
        <div className="absolute top-[68%] right-[22%] h-2 w-2 rounded-full bg-blue-300 shadow-[0_0_16px_rgba(96,165,250,0.75)] animate-pulse" style={{ animationDelay: '0.7s' }} />
        <div className="absolute top-[38%] right-[10%] h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-[0_0_14px_rgba(165,180,252,0.7)] animate-pulse" style={{ animationDelay: '1.1s' }} />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-[24rem]"
        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14, filter: 'blur(8px)' }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
      >
        {/* Logo Section */}
        <div className="mb-4 text-center">
          {/* Premium Logo Container */}
          <motion.div
            className="relative mx-auto mb-2 inline-block"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
            transition={shouldReduceMotion ? undefined : { type: 'spring', stiffness: 260, damping: 22 }}
          >
            {/* Outer glow ring - animated */}
            <div className="absolute -inset-3">
              <div className="w-full h-full rotate-0 animate-spin-slow">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 opacity-25 blur-2xl"></div>
              </div>
            </div>
            
            {/* Middle ring - counter rotation */}
            <div className="absolute -inset-1">
              <div className="w-full h-full -rotate-45 animate-reverse-spin">
                <div className="absolute top-0 left-1/2 w-3 h-3 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"></div>
                <div className="absolute bottom-0 right-1/2 w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50"></div>
                <div className="absolute top-1/2 right-0 w-2.5 h-2.5 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50"></div>
              </div>
            </div>
            
            {/* Logo Card */}
            <div className="relative">
              {/* Glass effect background */}
              <div className="absolute inset-0 bg-white/8 backdrop-blur-2xl rounded-[1.7rem] border border-white/16 shadow-[0_18px_80px_-28px_rgba(15,23,42,0.7)]"></div>
              
              {/* Inner glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/14 via-transparent to-blue-500/14 rounded-[1.7rem]"></div>

              {/* Subtle highlight */}
              <div className="absolute inset-0 rounded-[1.7rem] bg-gradient-to-b from-white/10 via-transparent to-transparent"></div>
              
              {/* Logo container */}
              <div className="relative px-6 py-3.5 sm:px-7 sm:py-4">
                <div className="relative">
                  {/* Logo shadow */}
                  <div className="absolute inset-0 blur-2xl bg-gradient-to-r from-blue-500 to-cyan-400 opacity-35"></div>
                  <img src={logoImage} alt="LEONI" className="h-11 w-auto block mx-auto relative z-10 drop-shadow-[0_16px_28px_rgba(15,23,42,0.42)] sm:h-12" />
                </div>
              </div>
              
              {/* Animated corner accents */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-300/60 rounded-tl-2xl animate-pulse"></div>
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-blue-300/60 rounded-tr-2xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-indigo-300/60 rounded-bl-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-300/60 rounded-br-2xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
            </div>
          </motion.div>
          
          {/* Brand Title */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-10 bg-gradient-to-r from-transparent via-cyan-300 to-transparent"></div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/8 backdrop-blur-md border border-white/12 rounded-full shadow-sm">
                <div className="w-2 h-2 bg-cyan-300 rounded-full animate-pulse shadow-lg shadow-cyan-300/50"></div>
                <span className="text-[11px] font-bold text-blue-100 tracking-[0.22em]">LEONI SYSTEMS</span>
              </div>
              <div className="h-px w-10 bg-gradient-to-l from-transparent via-cyan-300 to-transparent"></div>
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-6 bg-gradient-to-r from-transparent to-cyan-300/50"></div>
              <p className="text-cyan-100 text-sm font-semibold tracking-wide">
                Enterprise Asset Management
              </p>
              <div className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-300/50"></div>
            </div>
          </div>
        </div>

        {/* Login Form */}
          <div className="relative">
          {/* Form glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 rounded-[2rem] opacity-22 blur-xl"></div>
          
          {/* Form card */}
          <div className="relative overflow-hidden rounded-[1.9rem] border border-white/18 bg-slate-950/72 p-4.5 shadow-[0_30px_120px_-35px_rgba(2,6,23,0.9)] backdrop-blur-2xl sm:p-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_30%)]" />
            <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="mb-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100">
                Secure access
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300/50 to-transparent" />
            </div>

            <h2 className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-200 via-blue-100 to-white bg-clip-text text-transparent">
              Enterprise Sign In
            </h2>
            <p className="mb-4 mt-2 text-sm leading-6 text-slate-300">
              Access the LEONI platform with your enterprise credentials.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-200">
                  Email
                </label>
                <div className="group relative">
                  <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-cyan-400/30 via-blue-400/30 to-indigo-400/30 opacity-0 transition-opacity group-focus-within:opacity-100" />
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-300" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="relative w-full rounded-xl border border-white/10 bg-slate-900/75 py-3 pl-11 pr-4 text-slate-100 outline-none transition-all placeholder:text-slate-500 shadow-sm focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="your.email@leoni.com"
                    autoComplete="username"
                    inputMode="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-200">
                  Password
                </label>
                <div className="group relative">
                  <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-cyan-400/30 via-blue-400/30 to-indigo-400/30 opacity-0 transition-opacity group-focus-within:opacity-100" />
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-300" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setIsCapsLockOn(e.getModifierState('CapsLock'))}
                    onKeyDown={(e) => setIsCapsLockOn(e.getModifierState('CapsLock'))}
                    className="relative w-full rounded-xl border border-white/10 bg-slate-900/75 py-3 pl-11 pr-11 text-slate-100 outline-none transition-all placeholder:text-slate-500 shadow-sm focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-cyan-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember + CapsLock */}
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex select-none items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-400/40"
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
                      className="text-xs font-semibold text-amber-300"
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
                      className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#163B78] via-[#1E63C6] to-cyan-500 py-3 font-bold text-white transition-all duration-300 ${
                  isSubmitting
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:scale-[1.01] hover:shadow-2xl hover:shadow-cyan-500/25'
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
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-2 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse shadow-lg shadow-cyan-300/50"></div>
            <p className="text-slate-300 text-xs font-medium">
              Secure and encrypted system
            </p>
          </div>
          <p className="text-slate-400/70 text-xs">© 2026 LEONI. All rights reserved.</p>
        </div>
      </motion.div>
    </div>
  );
}