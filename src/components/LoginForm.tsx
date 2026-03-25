'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Key } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { LicenseValidator } from './LicenseValidator';
import { LogoHero } from './ui/Logo';
import { ipc } from '@/lib/ipc-client';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [licenseValid, setLicenseValid] = useState(true); // TODO: restore to false when MongoDB is connected
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    setLoading(true);
    try {
      if (ipc) {
        await ipc.saveCredentials({ username, password, licenseKey: '' });
      }
      onSuccess();
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-bg-root relative overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0">
        <div
          className="absolute w-[600px] h-[600px] -top-40 -left-40 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #10E0A0, transparent 70%)' }}
        />
        <div
          className="absolute w-[500px] h-[500px] -bottom-32 -right-32 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #6C8EEF, transparent 70%)' }}
        />
        <div
          className="absolute w-[400px] h-[400px] top-1/3 right-1/4 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #10E0A0, transparent 70%)' }}
        />
      </div>

      {/* Noise overlay */}
      <div className="absolute inset-0 noise-overlay pointer-events-none" />

      {/* Floating orbs */}
      <motion.div
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[15%] left-[12%] w-2 h-2 rounded-full bg-accent/20 blur-[1px]"
      />
      <motion.div
        animate={{ y: [6, -6, 6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[25%] right-[18%] w-1.5 h-1.5 rounded-full bg-accent/15 blur-[1px]"
      />
      <motion.div
        animate={{ y: [-4, 10, -4] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[40%] right-[10%] w-1 h-1 rounded-full bg-info/20 blur-[1px]"
      />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
          className="mb-10"
        >
          <LogoHero />
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="glass-card-strong rounded-2xl p-8"
          style={{ boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary tracking-wide uppercase">
                Username
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your Accurx username"
                  className="w-full pl-11 pr-4 py-3 bg-bg-input border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary tracking-wide uppercase">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-4 py-3 bg-bg-input border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-all duration-200"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-error bg-error/10 border border-error/20 rounded-xl px-4 py-3 backdrop-blur-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-text-on-accent bg-accent hover:bg-accent-hover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ boxShadow: loading ? 'none' : '0 0 20px rgba(16, 224, 160, 0.25), 0 4px 12px rgba(16, 224, 160, 0.15)' }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-10 text-center text-text-muted/40 text-xs font-mono"
        >
          v8.0.0
        </motion.p>
      </motion.div>
    </div>
  );
}
