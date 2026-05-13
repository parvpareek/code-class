import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  onComplete: () => void;
  reducedMotion: boolean;
  displayName: string;
};

/**
 * Editorial opener: warm white field → deep red diagonal slice → name fades in. No blur/glow.
 */
export default function MarlboroIntro({ onComplete, reducedMotion, displayName }: Props) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (reducedMotion) {
      const t = window.setTimeout(onComplete, 320);
      return () => window.clearTimeout(t);
    }
    /* Name fully visible ~1.3s; hold ~1.2s (~40% less than prior ~2s) then fade */
    const t1 = window.setTimeout(() => setPhase('out'), 2520);
    const t2 = window.setTimeout(onComplete, 3720);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onComplete, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-[#faf9f7] transition-opacity duration-1000 ease-out',
        phase === 'out' && 'pointer-events-none opacity-0'
      )}
      role="presentation"
      aria-hidden
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[min(38vh,22rem)] w-[165vw] max-w-none -translate-x-1/2 -translate-y-1/2 bg-[#b3131d] motion-reduce:animate-none animate-pf-marlboro-slice"
        aria-hidden
      />

      <div
        className={cn(
          'relative z-[1] max-w-[min(92vw,28rem)] px-6 text-center motion-reduce:animate-none animate-pf-marlboro-intro-text'
        )}
      >
        <p className="pf-display text-[clamp(2rem,8vw,3.25rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[#0c0c0c]">
          {displayName.trim() || 'Portfolio'}
        </p>
      </div>
    </div>
  );
}
