// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button unavailable state (docs/ui-rules.md §4)', () => {
  it('stays in the tab order, is aria-disabled, states the reason, and refuses the press', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabledReason="Assign a file to an account to continue">Continue</Button>);

    const btn = screen.getByRole('button', { name: /continue/i });
    expect(btn).not.toHaveAttribute('disabled');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(btn.getAttribute('aria-describedby')!)?.textContent)
      .toMatch(/assign a file/i);

    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('never fades: no opacity class is applied when unavailable', () => {
    render(<Button disabledReason="Nothing selected">Go</Button>);
    expect(screen.getByRole('button').className).not.toMatch(/opacity/);
  });

  it('a working button keeps its label semantics and reports aria-busy', () => {
    render(<Button pending pendingLabel="Deleting…">Delete</Button>);
    const btn = screen.getByRole('button', { name: /deleting/i });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('exposes the four house variants and no gradient', () => {
    for (const variant of ['primary', 'secondary', 'destructive', 'ghost'] as const) {
      const { unmount } = render(<Button variant={variant}>x</Button>);
      expect(screen.getByRole('button').className).not.toMatch(/gradient/);
      unmount();
    }
  });
});
