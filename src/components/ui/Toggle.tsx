'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /** Why it can't be changed right now; shown beside the control (never an opacity fade). */
  disabledReason?: string;
}

export function Toggle({ checked, onChange, label, disabledReason }: ToggleProps) {
  const unavailable = Boolean(disabledReason);
  return (
    <label className={`flex items-center gap-3 ${unavailable ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={unavailable || undefined}
        onClick={() => { if (!unavailable) onChange(!checked); }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 motion-reduce:transition-none
          ${unavailable ? 'bg-disabled-fill border border-edge' : checked ? 'bg-accent' : 'bg-bg-overlay border border-edge'}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none
            ${checked ? 'translate-x-6 bg-text-on-accent' : 'translate-x-1 bg-text-secondary'}`}
        />
      </button>
      {label && <span className="text-sm text-text-primary">{label}</span>}
      {disabledReason && <span className="text-xs text-text-secondary">{disabledReason}</span>}
    </label>
  );
}
