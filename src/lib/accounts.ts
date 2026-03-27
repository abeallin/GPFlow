export interface Account {
  id: string;
  label: string;
  username: string;
}

// Passwords stored separately in sessionStorage (cleared on app close)
// Never persisted to localStorage/disk in plaintext

const ACCOUNTS_KEY = 'gpflow_accounts';
const PASSWORDS_KEY = 'gpflow_passwords'; // sessionStorage only

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getAccounts(): Account[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ACCOUNTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getPassword(accountId: string): string | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(PASSWORDS_KEY);
  const passwords: Record<string, string> = stored ? JSON.parse(stored) : {};
  return passwords[accountId] || null;
}

export function addAccount(username: string, password: string): Account {
  const accounts = getAccounts();
  const account: Account = {
    id: generateId(),
    label: username.split('@')[0] || `Account ${accounts.length + 1}`,
    username,
  };
  accounts.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

  // Store password in sessionStorage only
  const stored = sessionStorage.getItem(PASSWORDS_KEY);
  const passwords: Record<string, string> = stored ? JSON.parse(stored) : {};
  passwords[account.id] = password;
  sessionStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));

  return account;
}

export function removeAccount(id: string): void {
  const accounts = getAccounts().filter((a) => a.id !== id);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

  // Remove password
  const stored = sessionStorage.getItem(PASSWORDS_KEY);
  if (stored) {
    const passwords: Record<string, string> = JSON.parse(stored);
    delete passwords[id];
    sessionStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
  }
}

export function getAccountById(id: string): Account | undefined {
  return getAccounts().find((a) => a.id === id);
}

export function clearAllAccounts(): void {
  localStorage.removeItem(ACCOUNTS_KEY);
  sessionStorage.removeItem(PASSWORDS_KEY);
}
