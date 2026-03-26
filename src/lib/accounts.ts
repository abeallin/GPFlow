export interface Account {
  id: string;
  label: string;
  username: string;
  password: string;
}

const STORAGE_KEY = 'gpflow_accounts';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getAccounts(): Account[] {
  if (typeof window === 'undefined') return [];
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addAccount(username: string, password: string): Account {
  const accounts = getAccounts();
  const account: Account = {
    id: generateId(),
    label: username.split('@')[0] || `Account ${accounts.length + 1}`,
    username,
    password,
  };
  accounts.push(account);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  return account;
}

export function removeAccount(id: string): void {
  const accounts = getAccounts().filter((a) => a.id !== id);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function getAccountById(id: string): Account | undefined {
  return getAccounts().find((a) => a.id === id);
}
