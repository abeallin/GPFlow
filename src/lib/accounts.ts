import { ipc } from './ipc-client';
import { readJson } from './storage';

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

function isAccountArray(v: unknown): v is Account[] {
  return Array.isArray(v) && v.every(
    (a) => typeof a === 'object' && a !== null
      && typeof (a as Account).id === 'string'
      && typeof (a as Account).username === 'string',
  );
}

export function getAccounts(): Account[] {
  if (typeof window === 'undefined') return [];
  return readJson<Account[]>(localStorage, ACCOUNTS_KEY, [], isAccountArray);
}

function readWebPasswords(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return readJson<Record<string, string>>(
    sessionStorage,
    PASSWORDS_KEY,
    {},
    (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
  );
}

function writeWebPasswords(passwords: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
}

/** Get password — Electron encrypted storage, or sessionStorage on the web */
export async function getPasswordAsync(accountId: string): Promise<string | null> {
  if (ipc) {
    try {
      const creds = await ipc.getCredentials(accountId);
      return creds?.password || null;
    } catch {
      return null;
    }
  }
  return getPasswordSync(accountId);
}

/** Synchronous password getter (web-only, from sessionStorage) */
export function getPasswordSync(accountId: string): string | null {
  return readWebPasswords()[accountId] || null;
}

/**
 * Store password. In Electron the plaintext ONLY goes through the encrypted
 * IPC store and any failure is rethrown; sessionStorage is web-only.
 */
export async function savePassword(accountId: string, username: string, password: string): Promise<void> {
  if (ipc) {
    await ipc.saveCredentials({ accountId, username, password, licenseKey: '' });
    return;
  }
  const passwords = readWebPasswords();
  passwords[accountId] = password;
  writeWebPasswords(passwords);
}

/** Derive a label that is unique among `existing`: local part, plus domain on collision. */
export function makeLabel(username: string, existing: Account[]): string {
  const [local, domain] = username.split('@');
  const base = local || `Account ${existing.length + 1}`;
  const taken = new Set(existing.map((a) => a.label.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  const withDomain = domain ? `${base}@${domain}` : base;
  if (!taken.has(withDomain.toLowerCase())) return withDomain;
  let n = 2;
  while (taken.has(`${withDomain} (${n})`.toLowerCase())) n++;
  return `${withDomain} (${n})`;
}

export async function addAccount(username: string, password: string): Promise<Account> {
  const accounts = getAccounts();
  const account: Account = {
    id: generateId(),
    label: makeLabel(username, accounts),
    username,
  };
  accounts.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

  await savePassword(account.id, username, password);
  return account;
}

/** Remove an account and its stored credential (IPC store in Electron, sessionStorage on the web). */
export async function removeAccount(id: string): Promise<void> {
  const accounts = getAccounts().filter((a) => a.id !== id);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

  const passwords = readWebPasswords();
  if (id in passwords) {
    delete passwords[id];
    writeWebPasswords(passwords);
  }

  if (ipc) {
    await ipc.deleteCredentials(id);
  }
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
