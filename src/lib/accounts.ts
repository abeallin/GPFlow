import { ipc, type ElectronAPI } from './ipc-client';
import { readJson } from './storage';

export interface Account {
  id: string;
  label: string;
  username: string;
  authMethod?: 'direct' | 'sso';
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

const isNativeIpc = (client: unknown): client is ElectronAPI =>
  Boolean(client && typeof client === 'object' && !('isWeb' in client));

function readWebPasswords(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  let map = readJson<Record<string, string>>(
    sessionStorage,
    PASSWORDS_KEY,
    {},
    (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
  );
  if (Object.keys(map).length === 0) {
    map = readJson<Record<string, string>>(
      localStorage,
      PASSWORDS_KEY,
      {},
      (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
    );
    if (Object.keys(map).length > 0) {
      sessionStorage.setItem(PASSWORDS_KEY, JSON.stringify(map));
    }
  }
  return map;
}

function writeWebPasswords(passwords: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  const json = JSON.stringify(passwords);
  sessionStorage.setItem(PASSWORDS_KEY, json);
  localStorage.setItem(PASSWORDS_KEY, json);
}

/** Get password — Electron encrypted storage, or sessionStorage/localStorage on the web */
export async function getPasswordAsync(accountId: string): Promise<string | null> {
  if (isNativeIpc(ipc)) {
    try {
      const creds = await ipc.getCredentials(accountId);
      return creds?.password || null;
    } catch {
      return null;
    }
  }
  return getPasswordSync(accountId);
}

/** Synchronous password getter (web-only) */
export function getPasswordSync(accountId: string): string | null {
  return readWebPasswords()[accountId] || null;
}

/**
 * Store password. In Electron the plaintext ONLY goes through the encrypted
 * IPC store and any failure is rethrown; web mode uses sessionStorage and localStorage.
 */
export async function savePassword(accountId: string, username: string, password: string): Promise<void> {
  if (isNativeIpc(ipc)) {
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

export async function addAccount(
  username: string,
  password: string,
  authMethod: 'direct' | 'sso' = 'direct',
): Promise<Account> {
  const accounts = getAccounts();
  const account: Account = {
    id: generateId(),
    label: makeLabel(username, accounts),
    username,
    authMethod,
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

  if (isNativeIpc(ipc)) {
    await ipc.deleteCredentials(id);
  }
}

/** Update an existing account's details and/or password without reassigning practices. */
export async function updateAccount(
  id: string,
  updates: { label?: string; username?: string; password?: string; authMethod?: 'direct' | 'sso' },
): Promise<Account> {
  const accounts = getAccounts();
  const index = accounts.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new Error('Account not found');
  }

  const existing = accounts[index];
  const updated: Account = {
    ...existing,
    label: updates.label !== undefined && updates.label.trim() ? updates.label.trim() : existing.label,
    username: updates.username !== undefined && updates.username.trim() ? updates.username.trim() : existing.username,
    authMethod: updates.authMethod !== undefined ? updates.authMethod : (existing.authMethod || 'direct'),
  };

  accounts[index] = updated;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

  if (updates.password !== undefined && updates.password.trim()) {
    await savePassword(id, updated.username, updates.password.trim());
  }

  return updated;
}

export function getAccountById(id: string): Account | undefined {
  return getAccounts().find((a) => a.id === id);
}

export function clearAllAccounts(): void {
  localStorage.removeItem(ACCOUNTS_KEY);
  sessionStorage.removeItem(PASSWORDS_KEY);
  localStorage.removeItem(PASSWORDS_KEY);
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
