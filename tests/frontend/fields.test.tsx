// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

describe('form fields (docs/ui-rules.md §8)', () => {
  it('Input: the visible label is tied to the control', () => {
    render(<Input label="Template name" />);
    expect(screen.getByLabelText('Template name').tagName).toBe('INPUT');
  });

  it('Input: hint and error are linked with aria-describedby and the field is aria-invalid', () => {
    render(<Input label="Email" hint="Your Accurx login" error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/);
    const described = ids.map((id) => document.getElementById(id)?.textContent).join(' ');
    expect(described).toMatch(/Your Accurx login/);
    expect(described).toMatch(/Enter a valid email/);
  });

  it('Select: the visible label is tied to the control', () => {
    render(<Select label="Screenshot mode"><option>Off</option></Select>);
    expect(screen.getByLabelText('Screenshot mode').tagName).toBe('SELECT');
  });

  it('Textarea: the visible label is tied to the control and errors are linked', () => {
    render(<Textarea label="Message" error="Required" />);
    const ta = screen.getByLabelText('Message');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(ta.getAttribute('aria-describedby')!)?.textContent).toMatch(/Required/);
  });

  it('a caller-supplied id is respected so external labels keep working', () => {
    render(<Input id="custom" label="Name" />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('id', 'custom');
  });
});
