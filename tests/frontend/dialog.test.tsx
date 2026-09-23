// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

function Harness({ onConfirm, tone = 'destructive' as const }: { onConfirm: () => Promise<void>; tone?: 'destructive' | 'default' }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Other</button>
      {open && (
        <ConfirmDialog
          title="Delete 'Flu 2024' from 42 practices?"
          body="This removes the template from every selected practice."
          confirmLabel="Delete on 42 practices"
          pendingLabel="Deleting…"
          tone={tone}
          onCancel={() => setOpen(false)}
          onConfirm={async () => { await onConfirm(); setOpen(false); }}
        />
      )}
    </div>
  );
}

describe('ConfirmDialog (docs/ui-rules.md §5)', () => {
  it('is an alertdialog named by its heading, with Cancel first and focused', async () => {
    render(<Harness onConfirm={async () => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('alertdialog', { name: /delete 'flu 2024' from 42 practices\?/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const buttons = screen.getAllByRole('button').filter((b) => dialog.contains(b));
    expect(buttons[0]).toHaveTextContent(/cancel/i);
    expect(document.activeElement).toBe(buttons[0]);
    expect(screen.getByRole('button', { name: 'Delete on 42 practices' })).toBeTruthy();
  });

  it('Escape cancels and focus returns to the opener', async () => {
    render(<Harness onConfirm={async () => {}} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('Tab wraps inside the dialog', async () => {
    render(<Harness onConfirm={async () => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const cancel = screen.getByRole('button', { name: /cancel/i });
    const confirm = screen.getByRole('button', { name: 'Delete on 42 practices' });
    expect(document.activeElement).toBe(cancel);
    await userEvent.tab();
    expect(document.activeElement).toBe(confirm);
    await userEvent.tab();
    expect(document.activeElement).toBe(cancel);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('confirming relabels the button and refuses a second press; failure keeps the dialog open with the error', async () => {
    let resolveFirst!: () => void;
    const onConfirm = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => Promise.reject(new Error('Accurx is unreachable')));

    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    const confirm = screen.getByRole('button', { name: 'Delete on 42 practices' });
    await userEvent.click(confirm);
    expect(screen.getByRole('button', { name: 'Deleting…' })).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Deleting…' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolveFirst();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete on 42 practices' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Accurx is unreachable/));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing has changed/i);
  });
});
