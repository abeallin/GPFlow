// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadError } from '@/components/ui/LoadError';
import { StatCard } from '@/components/ui/StatCard';
import { Tabs } from '@/components/ui/Tabs';
import { Alert } from '@/components/ui/Alert';

describe('LoadError (docs/ui-rules.md §6)', () => {
  it('is an alert with a retry button and cannot be dismissed', () => {
    const onRetry = vi.fn();
    render(<LoadError title="Couldn't load practices" message="Nothing has changed." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load practices/i);
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows its pending state on the retry button', () => {
    render(<LoadError message="x" onRetry={() => {}} retrying />);
    expect(screen.getByRole('button', { name: /retrying/i })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('StatCard: a zero is a claim', () => {
  it('renders a dash while the value is unknown', () => {
    render(<StatCard label="Total runs" value={null} icon={<span />} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
  it('renders the number once known', () => {
    render(<StatCard label="Total runs" value={0} icon={<span />} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('Tabs keep their panels mounted and are keyboard operable', () => {
  const tabs = [
    { id: 'a', label: 'Create', content: <input aria-label="name-a" /> },
    { id: 'b', label: 'Delete', content: <input aria-label="name-b" /> },
  ];

  it('has tablist/tab/tabpanel roles and the inactive panel is hidden, not unmounted', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Create' })).toHaveAttribute('aria-selected', 'true');
    const a = screen.getByLabelText('name-a') as HTMLInputElement;
    fireEvent.change(a, { target: { value: 'Flu' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Create' }));
    expect((screen.getByLabelText('name-a') as HTMLInputElement).value).toBe('Flu');
  });

  it('arrow keys move between tabs', () => {
    render(<Tabs tabs={tabs} />);
    const first = screen.getByRole('tab', { name: 'Create' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Delete' })).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Delete' }));
  });
});

describe('Alert roles', () => {
  it('error alerts are role=alert, others are role=status', () => {
    const { rerender } = render(<Alert variant="error">Boom</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    rerender(<Alert variant="success">Done</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Done');
  });
});
