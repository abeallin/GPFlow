'use client';

interface LogoFullProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showSubtitle?: boolean;
  subtitleText?: string;
}

/**
 * Typography-first logo. The serif wordmark IS the brand — no icon needed.
 * "GP Flow" in Instrument Serif with an accent-colored italic "Flow".
 * Inspired by Awwwards SOTD trend: text-based logos > SVG marks.
 */
export function LogoFull({ size = 'md', className = '', showSubtitle = false, subtitleText = 'Desktop' }: LogoFullProps) {
  const config = {
    sm: { text: 'text-base', gap: 'gap-0.5', label: 'text-[8px]' },
    md: { text: 'text-lg', gap: 'gap-0.5', label: 'text-[9px]' },
    lg: { text: 'text-2xl', gap: 'gap-1', label: 'text-[10px]' },
  };

  const { text, gap, label } = config[size];

  return (
    <div className={`flex flex-col ${gap} ${className}`}>
      <div className={`${text} leading-none tracking-[-0.03em]`}>
        <span className="font-[var(--font-display)] text-text-primary">GP</span>
        <span className="font-[var(--font-display)] italic text-accent ml-[0.15em]">Flow</span>
      </div>
      {showSubtitle && (
        <span className={`${label} font-[var(--font-body)] text-text-muted uppercase tracking-[0.12em] font-medium`}>
          {subtitleText}
        </span>
      )}
    </div>
  );
}

/**
 * Hero logo for the login screen.
 * Large serif wordmark with staggered emphasis.
 * "GP" in primary white, "Flow" in accent italic — editorial feel.
 */
export function LogoHero({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Wordmark */}
      <h1 className="text-6xl leading-none tracking-[-0.04em] mb-4">
        <span className="font-[var(--font-display)] text-text-primary">GP</span>
        <span className="font-[var(--font-display)] italic text-accent ml-[0.08em]">Flow</span>
      </h1>

      {/* Thin accent line */}
      <div
        className="w-12 h-px mb-4"
        style={{ background: 'linear-gradient(90deg, transparent, #10E0A0, transparent)' }}
      />

      {/* Tagline */}
      <p className="text-text-muted text-xs font-[var(--font-body)] uppercase tracking-[0.15em] font-medium">
        Accurx Template Automation
      </p>
    </div>
  );
}
