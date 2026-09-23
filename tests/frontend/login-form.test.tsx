// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/lib/ipc-client', () => ({ ipc: null }));

import { LoginForm } from '@/components/LoginForm';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe('LoginForm accessibility', () => {
  it('exposes the remove-account button by accessible name', async () => {
    localStorage.setItem('gpflow_accounts', JSON.stringify([
      { id: 'acc1', label: 'admin', username: 'admin@nhs.net' },
    ]));
    render(<LoginForm onSuccess={() => {}} />);
    expect(await screen.findByText('admin@nhs.net')).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove account admin/i })).toBeTruthy();
  });

  it('exposes the show/hide password toggle by accessible name', () => {
    render(<LoginForm onSuccess={() => {}} />);
    expect(screen.getByRole('button', { name: /show password/i })).toBeTruthy();
  });
});
