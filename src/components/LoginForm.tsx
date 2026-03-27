'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Trash2, Plus, ArrowRight } from 'lucide-react';
import { LogoHero } from './ui/Logo';
import { type Account, getAccounts, addAccount, removeAccount } from '@/lib/accounts';
import { ipc } from '@/lib/ipc-client';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(true);

  // Load accounts from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const saved = getAccounts();
    setAccounts(saved);
    if (saved.length > 0) setShowForm(false);
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    if (accounts.some((a) => a.username.toLowerCase() === username.trim().toLowerCase())) {
      setError('This account has already been added');
      return;
    }

    const account = addAccount(username.trim(), password);

    if (ipc) {
      try {
        await ipc.saveCredentials({ username: account.username, password: account.password, licenseKey: '' });
      } catch {}
    }

    setAccounts(getAccounts());
    setUsername('');
    setPassword('');
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    removeAccount(id);
    const remaining = getAccounts();
    setAccounts(remaining);
    if (remaining.length === 0) setShowForm(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-bg-root relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute w-[600px] h-[600px] -top-40 -left-40 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #10E0A0, transparent 70%)' }} />
        <div className="absolute w-[500px] h-[500px] -bottom-32 -right-32 rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #6C8EEF, transparent 70%)' }} />
      </div>
      <div className="absolute inset-0 noise-overlay pointer-events-none" />

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

        {/* Account list + add button header */}
        {accounts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Accounts ({accounts.length})
              </p>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add account
                </button>
              )}
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {accounts.map((account) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12, height: 0 }}
                    className="flex items-center justify-between glass-card rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{account.label}</p>
                        <p className="text-xs text-text-muted truncate">{account.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(account.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Add Account Form */}
        <AnimatePresence mode="wait">
          {showForm && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="glass-card-strong rounded-2xl p-8 mb-4"
              style={{ boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04)' }}
            >
              {accounts.length > 0 && (
                <div className="flex items-center justify-between mb-5">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                    Add Another Account
                  </p>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <form onSubmit={handleAddAccount} className="space-y-5">
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
                      placeholder="Enter your Accurx password"
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
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 inline-flex items-center justify-center gap-2 active:scale-[0.98] ${
                    accounts.length === 0
                      ? 'text-text-on-accent bg-accent hover:bg-accent-hover'
                      : 'text-text-primary glass-card border border-border-strong hover:border-accent/40 hover:text-accent'
                  }`}
                  style={accounts.length === 0 ? { boxShadow: '0 0 20px rgba(16, 224, 160, 0.25), 0 4px 12px rgba(16, 224, 160, 0.15)' } : undefined}
                >
                  <Plus className="w-4 h-4" />
                  {accounts.length === 0 ? 'Sign In' : 'Add Account'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button */}
        {accounts.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSuccess()}
            className="group w-full py-3.5 rounded-xl text-sm font-semibold text-text-on-accent bg-accent hover:bg-accent-hover transition-all duration-200 inline-flex items-center justify-center gap-2"
            style={{ boxShadow: '0 0 24px rgba(16, 224, 160, 0.3), 0 4px 16px rgba(16, 224, 160, 0.2)' }}
          >
            Continue to Data
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </motion.button>
        )}

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
