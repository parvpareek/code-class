import React from 'react';
import type { PortfolioHeatmapMode } from '@/types/portfolio';
import { cn } from '@/lib/utils';

const MODES: { id: PortfolioHeatmapMode; label: string }[] = [
  { id: 'practice', label: 'DSA problems' },
  { id: 'github', label: 'GitHub' },
  { id: 'combined', label: 'Both' },
];

type Props = {
  mode: PortfolioHeatmapMode;
  onMode: (m: PortfolioHeatmapMode) => void;
  className?: string;
};

/** Small, low-contrast control to pick which calendar is shown. */
export function PortfolioHeatmapModeToggle({ mode, onMode, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-1', className)} role="tablist" aria-label="Which calendar to show">
      <span className="text-[10px] uppercase tracking-wider text-[var(--pf-muted)] opacity-65">View</span>
      <div className="flex flex-wrap gap-0.5">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            className={cn(
              'relative rounded px-2 py-1 text-[11px] font-medium transition-colors',
              mode === id
                ? 'bg-[color-mix(in_srgb,var(--pf-accent)_10%,var(--pf-surface))] text-[var(--pf-text)] after:absolute after:inset-x-1 after:bottom-0 after:h-px after:rounded-full after:bg-[color-mix(in_srgb,var(--pf-accent)_55%,var(--pf-border))]'
                : 'text-[var(--pf-muted)] hover:bg-[color-mix(in_srgb,var(--pf-surface)_88%,transparent)] hover:text-[var(--pf-text)]'
            )}
            onClick={() => onMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
