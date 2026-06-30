import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

export function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState('02:16 am');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      setTime(`${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/anonymous', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to enter guest demo');
      }

      if (data.token) {
        localStorage.setItem('session_token', data.token);
      }

      if (data.user && data.user.id) {
        localStorage.setItem('lmls_user_id', data.user.id);
      }

      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.token) {
        localStorage.setItem('session_token', data.token);
      }

      if (data.user && data.user.id) {
        localStorage.setItem('lmls_user_id', data.user.id);
      }

      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans bg-zinc-50 overflow-hidden select-none">
      {/* Left panel (dark, brand side) */}
      <div className="hidden lg:flex relative flex-col justify-center items-center p-12 bg-zinc-950 text-zinc-100 border-r border-zinc-900 min-h-screen w-full">
        {/* Absolute top-left clock with improved legibility */}
        <div className="absolute top-10 left-10 font-mono text-[10px] tracking-widest text-zinc-400 uppercase">
          {time}
        </div>

        {/* Centerpiece brand & decomposition SVG */}
        <div className="flex flex-col justify-center items-start space-y-6 max-w-sm w-full my-auto">
          <div className="space-y-1.5">
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Quorum
            </h1>
            <p className="italic text-zinc-400 text-base font-light tracking-wide">
              Decisions made. Deadlines kept.
            </p>
          </div>

          {/* Symmetrical & elegant static decomposition node SVG with higher visual weight and clear line visibility */}
          <div className="w-full">
            <svg viewBox="0 0 300 160" className="w-full max-w-[280px] h-auto my-4" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Symmetrical connecting lines - 0.35 opacity for optimal legibility */}
              {/* Root to middle */}
              <line x1="30" y1="80" x2="130" y2="40" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1" />
              <line x1="30" y1="80" x2="130" y2="80" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1" />
              <line x1="30" y1="80" x2="130" y2="120" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1" />

              {/* Middle top to branch end */}
              <line x1="130" y1="40" x2="230" y2="20" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1" />
              <line x1="130" y1="40" x2="230" y2="60" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1" />

              {/* Middle center to branch end */}
              <line x1="130" y1="80" x2="230" y2="80" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1" />

              {/* Middle bottom to branch end */}
              <line x1="130" y1="120" x2="230" y2="100" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1" />
              <line x1="130" y1="120" x2="230" y2="140" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1" />

              {/* Symmetrical nodes - weighted hierarchy */}
              {/* Root (Large & Brightest) */}
              <circle cx="30" cy="80" r="12" fill="rgba(255, 255, 255, 0.25)" />
              <circle cx="30" cy="80" r="6" fill="#ffffff" />

              {/* Middle Tier (Substantial) */}
              <circle cx="130" cy="40" r="4.5" fill="#e4e4e7" />
              <circle cx="130" cy="80" r="4.5" fill="#e4e4e7" />
              <circle cx="130" cy="120" r="4.5" fill="#e4e4e7" />

              {/* Leaf Tier (Refined details) */}
              <circle cx="230" cy="20" r="3" fill="#a1a1aa" />
              <circle cx="230" cy="60" r="3" fill="#a1a1aa" />
              <circle cx="230" cy="80" r="3" fill="#a1a1aa" />
              <circle cx="230" cy="100" r="3" fill="#a1a1aa" />
              <circle cx="230" cy="140" r="3" fill="#a1a1aa" />
            </svg>
          </div>

          <p className="text-xs text-zinc-400 font-light tracking-wide leading-relaxed max-w-[280px] text-balance">
            One goal, decomposed into a plan you'll actually follow.
          </p>
        </div>
      </div>

      {/* Right panel (light, form side) */}
      <div className="flex flex-col justify-center items-center px-8 py-16 sm:px-16 md:px-24 bg-zinc-50 text-zinc-900 min-h-screen w-full">
        <div className="w-full max-w-sm space-y-8 my-auto">
          <div className="space-y-2">
            {/* Mobile Branding (only visible when Left panel is hidden) */}
            <div className="lg:hidden flex flex-col space-y-1.5 mb-8">
              <span className="font-semibold text-2xl tracking-tight text-zinc-900">Quorum</span>
              <span className="text-xs text-zinc-500 italic">Decisions made. Deadlines kept.</span>
            </div>

            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
              {isLogin ? 'Sign in' : 'Create account'}
            </h2>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-600 leading-relaxed"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3.5 text-sm font-light text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all shadow-sm"
                placeholder="name@company.com"
                required
                disabled={loading}
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3.5 text-sm font-light text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all shadow-sm"
                placeholder="Password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-white font-medium rounded-xl py-3.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-sm mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Continuing...
                </span>
              ) : (
                'Continue'
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-200"></div>
              <span className="flex-shrink mx-4 text-zinc-400 text-[10px] uppercase font-mono tracking-wider">or</span>
              <div className="flex-grow border-t border-zinc-200"></div>
            </div>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-medium rounded-xl py-3.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center cursor-pointer shadow-sm"
            >
              Enter as Guest / Judge Demo
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="text-xs text-zinc-500 font-light">
              {isLogin ? "No account? " : 'Already have an account? '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                  setPassword('');
                }}
                className="font-medium text-zinc-900 hover:underline hover:text-black focus:outline-none cursor-pointer"
                disabled={loading}
              >
                {isLogin ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
