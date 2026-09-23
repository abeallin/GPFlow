// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

type AccountsModule = typeof import('@/lib/accounts');

async function loadAccounts(ipcFake: any): Promise<AccountsModule> {
  vi.resetModules();
  vi.doMock('@/lib/ipc-client', () => ({ ipc: ipcFake }));
  return await import('@/lib/accounts');
}

function fakeIpc(overrides: Partial<Record<string, any>> = {}) {
  return {
    saveCredentials: vi.fn().mockResolvedValue(undefined),
    getCredentials: vi.fn().mockResolvedValue(null),
    deleteCredentials: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('savePassword', () => {
  it('in Electron only goes through ipc.saveCredentials and never touches sessionStorage', async () => {
    const ipc = fakeIpc();
    const { savePassword } = await loadAccounts(ipc);
    await savePassword('acc1', 'user@nhs.net', 'secret');

    expect(ipc.saveCredentials).toHaveBeenCalledWith({
      accountId: 'acc1', username: 'user@nhs.net', password: 'secret', licenseKey: '',
    });
    expect(sessionStorage.getItem('gpflow_passwords')).toBeNull();
  });

  it('in Electron rethrows when ipc.saveCredentials fails', async () => {
    const ipc = fakeIpc({ saveCredentials: vi.fn().mockRejectedValue(new Error('keychain locked')) });
    const { savePassword } = await loadAccounts(ipc);
    await expect(savePassword('acc1', 'user@nhs.net', 'secret')).rejects.toThrow('keychain locked');
    expect(sessionStorage.getItem('gpflow_passwords')).toBeNull();
  });

  it('on the web stores in sessionStorage', async () => {
    const { savePassword, getPasswordSync } = await loadAccounts(null);
    await savePassword('acc1', 'user@nhs.net', 'secret');
    expect(getPasswordSync('acc1')).toBe('secret');
  });
});

describe('removeAccount', () => {
  it('in Electron calls ipc.deleteCredentials with the account id', async () => {
    const ipc = fakeIpc();
    const { addAccount, removeAccount, getAccounts } = await loadAccounts(ipc);
    const account = await addAccount('user@nhs.net', 'secret');
    await removeAccount(account.id);
    expect(ipc.deleteCredentials).toHaveBeenCalledWith(account.id);
    expect(getAccounts()).toEqual([]);
  });

  it('on the web removes the sessionStorage password entry', async () => {
    const { addAccount, removeAccount, getPasswordSync, getAccounts } = await loadAccounts(null);
    const a = await addAccount('a@nhs.net', 'pa');
    const b = await addAccount('b@nhs.net', 'pb');
    await removeAccount(a.id);
    expect(getPasswordSync(a.id)).toBeNull();
    expect(getPasswordSync(b.id)).toBe('pb');
    expect(getAccounts().map((x) => x.id)).toEqual([b.id]);
  });
});

describe('labels', () => {
  it('appends the domain when the local part collides with an existing account', async () => {
    const { addAccount } = await loadAccounts(null);
    const first = await addAccount('admin@nhs.net', 'p1');
    const second = await addAccount('admin@x.com', 'p2');
    expect(first.label).toBe('admin');
    expect(second.label).not.toBe('admin');
    expect(second.label).toContain('x.com');
  });
});

describe('getAccounts', () => {
  it('returns [] for corrupt JSON', async () => {
    localStorage.setItem('gpflow_accounts', '{oops');
    const { getAccounts } = await loadAccounts(null);
    expect(getAccounts()).toEqual([]);
  });

  it('returns [] for a non-array value', async () => {
    localStorage.setItem('gpflow_accounts', '{"id":"x"}');
    const { getAccounts } = await loadAccounts(null);
    expect(getAccounts()).toEqual([]);
  });
});
