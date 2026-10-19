'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Trash2, Plus, ArrowRight, Eye, EyeOff, CheckCircle2, AlertTriangle, ShieldCheck, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DialogPanel } from '@/components/ui/DialogPanel';
import { toast } from '@/components/ui/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { type Account, getAccounts, addAccount, removeAccount, updateAccount, getPasswordAsync } from '@/lib/accounts';
import { readJson, isArray, isStringRecord } from '@/lib/storage';
import { type Assignments, type PracticeLike, assignedAccountId } from '@/lib/assignments';

export default function AccountsPage() {
  usePageTitle('Accounts');
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [passwordsMap, setPasswordsMap] = useState<Record<string, boolean>>({});
  const [practiceCountMap, setPracticeCountMap] = useState<Record<string, number>>({});
  const [username, setUsername] = useState('');
  const [password, setPasswordInput] = useState('');
  const [authMethod, setAuthMethod] = useState<'direct' | 'sso'>('direct');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [removing, setRemoving] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAuthMethod, setEditAuthMethod] = useState<'direct' | 'sso'>('direct');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditAccount = (account: Account) => {
    setEditingAccount(account);
    setEditLabel(account.label);
    setEditUsername(account.username);
    setEditPassword('');
    setEditAuthMethod(account.authMethod || 'direct');
    setShowEditPassword(false);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditError('');

    if (!editUsername.trim()) {
      setEditError('Accurx email cannot be empty.');
      return;
    }

    setSavingEdit(true);
    try {
      await updateAccount(editingAccount.id, {
        label: editLabel.trim(),
        username: editUsername.trim(),
        password: editPassword,
        authMethod: editAuthMethod,
      });
      toast({
        tone: 'success',
        title: 'Account updated',
        message: `${editLabel.trim() || editUsername.trim()} has been updated.`,
      });
      setEditingAccount(null);
      await refreshAccountData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update account.');
    } finally {
      setSavingEdit(false);
    }
  };

  const refreshAccountData = async () => {
    const accs = getAccounts();
    setAccounts(accs);
    if (accs.length === 0) {
      setShowAddForm(true);
    }

    // Check passwords
    const pwMap: Record<string, boolean> = {};
    for (const a of accs) {
      const pw = await getPasswordAsync(a.id);
      pwMap[a.id] = Boolean(pw);
    }
    setPasswordsMap(pwMap);

    // Count practices assigned per account
    const practices = readJson<PracticeLike[]>(localStorage, 'gpflow_practices', [], isArray);
    const assignments = readJson<Assignments>(localStorage, 'gpflow_assignments', {}, isStringRecord);
    const countMap: Record<string, number> = {};
    for (const p of practices) {
      const accId = assignedAccountId(p, assignments);
      if (accId) {
        countMap[accId] = (countMap[accId] || 0) + 1;
      }
    }
    setPracticeCountMap(countMap);
  };

  useEffect(() => {
    void refreshAccountData();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUser = username.trim();
    const trimmedPw = password.trim();

    if (!trimmedUser || !trimmedPw) {
      setError('Enter both the Accurx email and password.');
      return;
    }

    if (accounts.some((a) => a.username.toLowerCase() === trimmedUser.toLowerCase())) {
      setError('This account has already been added.');
      return;
    }

    setSaving(true);
    try {
      await addAccount(trimmedUser, password, authMethod);
      toast({
        tone: 'success',
        title: 'Account added',
        message: `${trimmedUser} is ready for automation.`,
      });
      setUsername('');
      setPasswordInput('');
      setShowPassword(false);
      setShowAddForm(false);
      await refreshAccountData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await removeAccount(removing.id);
      toast({
        tone: 'success',
        title: 'Account removed',
        message: `${removing.label} was removed.`,
      });
      setRemoving(null);
      await refreshAccountData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Failed to remove account',
        message: err instanceof Error ? err.message : 'An error occurred.',
      });
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl text-text-primary font-[var(--font-display)] tracking-[-0.03em]">
            Accurx Accounts
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage the Accurx NHS accounts used to log in and automate practice templates.
          </p>
        </div>
        {!showAddForm && accounts.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddForm(true)}
            icon={<Plus className="w-4 h-4" aria-hidden="true" />}
          >
            Add account
          </Button>
        )}
      </div>

      {/* Account List */}
      <section aria-labelledby="accounts-heading" className="space-y-3">
        <h2 id="accounts-heading" className="text-xs font-semibold text-text-secondary font-[var(--font-body)] tracking-normal">
          Configured accounts ({accounts.length})
        </h2>

        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-raised p-8 text-center space-y-2">
            <p className="text-sm font-medium text-text-primary">No accounts added yet</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Add your Accurx account below so GPFlow can automate your templates across your practices.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5 list-none m-0 p-0">
            {accounts.map((account) => {
              const hasPw = passwordsMap[account.id];
              const practiceCount = practiceCountMap[account.id] || 0;

              return (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-bg-raised px-4 py-3.5"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0" aria-hidden="true">
                      <User className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-text-primary truncate">{account.label}</p>
                        {hasPw ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                            Password ready
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditAccount(account)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-colors"
                          >
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            Missing password — enter now
                          </button>
                        )}
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-bg-root border border-border text-text-muted">
                          {account.authMethod === 'sso' ? 'NHSmail SSO' : 'Direct Login'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-text-secondary">
                        <span className="truncate">{account.username}</span>
                        {practiceCount > 0 && (
                          <>
                            <span aria-hidden="true">•</span>
                            <span className="tabular-nums">{practiceCount} practice{practiceCount === 1 ? '' : 's'} assigned</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Edit account ${account.label}`}
                      onClick={() => openEditAccount(account)}
                      className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-sidebar-hover transition-colors"
                    >
                      <KeyRound className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove account ${account.label}`}
                      onClick={() => setRemoving(account)}
                      className="min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-error-text hover:bg-error-light transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Add Account Card */}
      {showAddForm && (
        <section aria-labelledby="add-account-heading" className="rounded-xl border border-border bg-bg-raised p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 id="add-account-heading" className="text-xs font-semibold text-text-secondary font-[var(--font-body)] tracking-normal">
              {accounts.length === 0 ? 'Add your first account' : 'Add another account'}
            </h2>
            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="min-h-9 px-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleAddAccount} noValidate className="space-y-4">
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Login method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMethod('direct')}
                  className={`p-2.5 text-xs rounded-xl border text-left transition-colors ${
                    authMethod === 'direct'
                      ? 'border-accent bg-accent/10 text-accent font-semibold'
                      : 'border-border bg-bg-root text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="font-medium block">Direct Accurx Form</span>
                  <span className="text-[11px] font-normal text-text-muted mt-0.5 block">Recommended — no fs.nhs.net</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('sso')}
                  className={`p-2.5 text-xs rounded-xl border text-left transition-colors ${
                    authMethod === 'sso'
                      ? 'border-accent bg-accent/10 text-accent font-semibold'
                      : 'border-border bg-bg-root text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="font-medium block">NHSmail SSO</span>
                  <span className="text-[11px] font-normal text-text-muted mt-0.5 block">Via fs.nhs.net / Microsoft</span>
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-error-text bg-error-light border border-error-text/20 rounded-xl px-4 py-3">
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
        </section>
      )}

      {/* Navigation action */}
      {accounts.length > 0 && (
        <div className="pt-2">
          <Button
            type="button"
            size="lg"
            onClick={() => router.push('/data')}
            className="w-full"
            icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
          >
            Continue to Data
          </Button>
        </div>
      )}

      {/* Remove Confirmation */}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.username}?`}
          body="Its stored password will be deleted from this device. Practices assigned to it will need to be reassigned before running."
          confirmLabel="Remove account"
          pendingLabel="Removing…"
          tone="destructive"
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <DialogPanel
          labelledBy="edit-dialog-title"
          describedBy="edit-dialog-desc"
          onClose={() => setEditingAccount(null)}
          initialFocus="#edit-password"
        >
          <div className="space-y-4">
            <div>
              <h2 id="edit-dialog-title" className="text-base font-semibold text-text-primary font-[var(--font-body)]">
                Update {editingAccount.label}
              </h2>
              <p id="edit-dialog-desc" className="text-xs text-text-secondary mt-1">
                Update credentials or display name. Practice assignments are preserved.
              </p>
            </div>

            <form onSubmit={handleSaveEdit} noValidate className="space-y-4">
              <Input
                label="Display name"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="e.g. Surgery 1"
              />

              <Input
                label="Accurx email"
                type="email"
                autoComplete="username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="name@nhs.net"
                icon={<User className="w-4 h-4" />}
              />

              <div className="relative">
                <Input
                  id="edit-password"
                  label="Accurx password"
                  type={showEditPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={passwordsMap[editingAccount.id] ? '••••••••  (leave blank to keep current)' : 'Enter password'}
                  hint={passwordsMap[editingAccount.id] ? 'Leave blank to keep current password, or type a new one.' : 'Enter your password to enable automation.'}
                  icon={<Lock className="w-4 h-4" />}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showEditPassword}
                  className="absolute right-1 bottom-6 min-w-9 min-h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                >
                  {showEditPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Login method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAuthMethod('direct')}
                    className={`p-2.5 text-xs rounded-xl border text-left transition-colors ${
                      editAuthMethod === 'direct'
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-border bg-bg-root text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <span className="font-medium block">Direct Accurx Form</span>
                    <span className="text-[11px] font-normal text-text-muted mt-0.5 block">Recommended — no fs.nhs.net</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAuthMethod('sso')}
                    className={`p-2.5 text-xs rounded-xl border text-left transition-colors ${
                      editAuthMethod === 'sso'
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-border bg-bg-root text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <span className="font-medium block">NHSmail SSO</span>
                    <span className="text-[11px] font-normal text-text-muted mt-0.5 block">Via fs.nhs.net / Microsoft</span>
                  </button>
                </div>
              </div>

              {editError && (
                <p role="alert" className="text-xs text-error-text bg-error-light border border-error-text/20 rounded-xl px-4 py-3">
                  {editError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditingAccount(null)}>
                  Cancel
                </Button>
                <Button type="submit" pending={savingEdit} pendingLabel="Saving…">
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </DialogPanel>
      )}
    </div>
  );
}
