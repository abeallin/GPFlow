// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/accounts',
}));
vi.mock('@/lib/ipc-client', () => ({ ipc: null }));

import AccountsPage from '@/app/accounts/page';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  push.mockReset();
});
afterEach(cleanup);

describe('AccountsPage', () => {
  it('renders heading and empty state when no accounts exist', async () => {
    render(<AccountsPage />);
    expect(await screen.findByRole('heading', { name: /accurx accounts/i })).toBeTruthy();
    expect(screen.getByText(/no accounts added yet/i)).toBeTruthy();
  });

  it('renders accounts from localStorage with labels and usernames', async () => {
    localStorage.setItem('gpflow_accounts', JSON.stringify([
      { id: 'acc1', label: 'admin', username: 'admin@nhs.net' },
    ]));
    render(<AccountsPage />);
    expect(await screen.findByText('admin')).toBeTruthy();
    expect(screen.getByText('admin@nhs.net')).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove account admin/i })).toBeTruthy();
  });

  it('allows adding an account and updating the list', async () => {
    render(<AccountsPage />);
    await screen.findByText(/no accounts added yet/i);

    fireEvent.change(screen.getByLabelText(/accurx email/i), { target: { value: 'doctor@nhs.net' } });
    fireEvent.change(screen.getByLabelText(/accurx password/i), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /^add account$/i }));

    expect(await screen.findByText('doctor@nhs.net')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('gpflow_accounts')!)).toHaveLength(1);
  });

  it('opens edit modal and updates password without removing account', async () => {
    localStorage.setItem('gpflow_accounts', JSON.stringify([
      { id: 'acc1', label: 'admin', username: 'admin@nhs.net' },
    ]));
    render(<AccountsPage />);
    expect(await screen.findByText('admin')).toBeTruthy();

    const editBtn = screen.getByRole('button', { name: /edit account admin/i });
    fireEvent.click(editBtn);

    const dialog = await screen.findByRole('dialog');
    const { within } = await import('@testing-library/react');
    const pwInput = within(dialog).getByLabelText(/accurx password/i);
    fireEvent.change(pwInput, { target: { value: 'brand-new-secret' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sessionStorage.getItem('gpflow_passwords')).toContain('brand-new-secret');
    expect(JSON.parse(localStorage.getItem('gpflow_accounts')!)).toHaveLength(1);
  });
});
