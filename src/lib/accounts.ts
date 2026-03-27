import { ipc } from './ipc-client';

export interface Account {
  id: string;
  label: string;
  username: string;
}

const ACCOUNTS_KEY = 'gpflow_accounts';
const PASSWORDS_KEY = 'gpflow_passwords'; // Web-only fallback (sessionStorage)

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getAccounts(): Account[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ACCOUNTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

/** Get password — tries Electron encrypted storage first, then sessionStorage fallback */
export async function getPasswordAsync(accountId: string): Promise<string | null> {
  // Electron: retrieve from OS-encrypted storage
  if (ipc) {
    try {
      const creds = await ipc.getCredentials(accountId);
      return creds?.password || null;
    } catch {
      return null;
    }
  }
  // Web fallback: sessionStorage
  return getPasswordSync(accountId);
}

/** Synchronous password getter (web-only, from sessionStorage) */
export function getPasswordSync(accountId: string): string | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(PASSWORDS_KEY);
  const passwords: Record<string, string> = stored ? JSON.parse(stored) : {};
  return passwords[accountId] || null;
}

/** Store password — Electron uses encrypted IPC, web uses sessionStorage */
export async function savePassword(accountId: string, username: string, password: string): Promise<void> {
  // Electron: save to OS-encrypted storage
  if (ipc) {
    try {
      await ipc.saveCredentials({ accountId, username, password, licenseKey: '' });
    } catch {}
  }
  // Web fallback: sessionStorage
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(PASSWORDS_KEY);
    const passwords: Record<string, string> = stored ? JSON.parse(stored) : {};
    passwords[accountId] = password;
    sessionStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
  }
}

export async function addAccount(username: string, password: string): Promise<Account> {
  const accounts = getAccounts();
  const account: Account = {
    id: generateId(),
    label: username.split('@')[0] || `Account ${accounts.length + 1}`,
    username,
  };
  accounts.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

  await savePassword(account.id, username, password);
  return account;
}

export function removeAccount(id: string): void {
  const accounts = getAccounts().filter((a) => a.id !== id);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getAccountById(id: string): Account | undefined {
  return getAccounts().find((a) => a.id === id);
}

export function clearAllAccounts(): void {
  localStorage.removeItem(ACCOUNTS_KEY);
  sessionStorage.removeItem(PASSWORDS_KEY);
}

/** Check if all accounts have passwords available */
export async function allPasswordsReady(): Promise<boolean> {
  const accounts = getAccounts();
  if (accounts.length === 0) return false;
  for (const a of accounts) {
    const pw = await getPasswordAsync(a.id);
    if (!pw) return false;
  }
  return true;
}
