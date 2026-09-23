'use client';

import { useState, useEffect } from 'react';
import { User, Lock, Trash2, Plus, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LogoHero } from './ui/Logo';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { type Account, getAccounts, addAccount, removeAccount, allPasswordsReady } from '@/lib/accounts';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

interface LoginFormProps {
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [passwordsReady, setPasswordsReady] = useState<boolean | null>(null);
  const [removing, setRemoving] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = getAccounts();
    setAccounts(saved);
    if (saved.length > 0) {
      setShowForm(false);
      allPasswordsReady().then(setPasswordsReady);
    }
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Enter both the Accurx email and password');
      return;
    }

    if (accounts.some((a) => a.username.toLowerCase() === username.trim().toLowerCase())) {
      setError('This account has already been added');
      return;
    }

    setSaving(true);
    try {
      await addAccount(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
      setAccounts(getAccounts());
      setSaving(false);
      return;
    }
    setSaving(false);

    setAccounts(getAccounts());
    setUsername('');
    setPasswordInput('');
    setShowPassword(false);
    setShowForm(false);
    allPasswordsReady().then(setPasswordsReady);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    await removeAccount(removing.id);
    const remaining = getAccounts();
    setAccounts(remaining);
    setRemoving(null);
    if (remaining.length === 0) setShowForm(true);
    allPasswordsReady().then(setPasswordsReady);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-bg-root relative overflow-hidden">
      <main id="main" className="relative z-10 w-full max-w-md">
        <div className="mb-10">
          <LogoHero />
        </div>

        {accounts.length > 0 && (
          <section aria-labelledby="accounts-heading" className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 id="accounts-heading" className="text-xs font-semibold text-text-secondary font-[var(--font-body)] tracking-normal">
                Accounts ({accounts.length})
              </h2>
              {!showForm && (
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1 min-h-9 px-2 text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  Add account
                </button>
              )}
            </div>
            <ul className="space-y-2 list-none m-0 p-0">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-bg-raised px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0" aria-hidden="true">
                      <User className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{account.label}</p>
                      <p className="text-xs text-text-secondary truncate">{account.username}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove account ${account.label}`}
                    onClick={() => setRemoving(account)}
                    className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-error-text hover:bg-error-light transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {passwordsReady === false && (
              <p role="status" className="mt-2 text-xs text-warning">
                Some accounts have no stored password. Remove and re-add them before starting a run.
              </p>
            )}
          </section>
        )}

        {showForm && (
          <div className="rounded-2xl border border-border bg-bg-raised p-8 mb-4">
            {accounts.length > 0 && (
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs font-semibold text-text-secondary font-[var(--font-body)] tracking-normal">
                  Add another account
                </h2>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="min-h-9 px-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            <form onSubmit={handleAddAccount} noValidate className="space-y-5">
              <Input
                label="Accurx email"
                type="email"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@nhs.net"
                icon={<User className="w-4 h-4" />}
              />

              <div className="relative">
                <Input
                  label="Accurx password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password"
                  icon={<Lock className="w-4 h-4" />}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1 bottom-0.5 min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>

              {error && (
                <p role="alert" className="text-sm text-error-text bg-error-light border border-error-text/20 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                variant={accounts.length === 0 ? 'primary' : 'secondary'}
                pending={saving}
                pendingLabel="Saving…"
                icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                className="w-full"
              >
                {accounts.length === 0 ? 'Add account' : 'Add another account'}
              </Button>
            </form>
          </div>
        )}

        {accounts.length > 0 && (
          <Button type="button" size="lg" onClick={onSuccess} className="w-full" icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}>
            Continue to Data
          </Button>
        )}

        <p className="mt-10 text-center text-text-muted text-xs font-mono">
          v{APP_VERSION}
        </p>
      </main>

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.username}?`}
          body="Its stored password is deleted from this device. Practices assigned to it will need reassigning."
          confirmLabel="Remove account"
          pendingLabel="Removing…"
          tone="destructive"
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  );
}
