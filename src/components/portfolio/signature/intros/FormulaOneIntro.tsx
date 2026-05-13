import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** Public asset: `public/f1-car.png`. */
const F1_CAR_SRC = '/f1-car.png';

type Props = {
  onComplete: () => void;
  reducedMotion: boolean;
};

/** Decorative skid marks — left behind as the reveal opens (no third-party marks). */
function TireSkids() {
  return (
    <svg
      className="pf-f1-intro-tires pointer-events-none absolute inset-x-0 bottom-[6%] z-[1] h-[min(26vmin,200px)] w-full overflow-visible"
      viewBox="0 0 1200 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <path
        d="M -40 142 Q 180 118 360 132 Q 520 148 700 128 Q 880 108 1240 124"
        fill="none"
        stroke="rgba(248,250,252,0.11)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M -20 168 Q 200 150 380 162 Q 560 176 720 154 Q 920 132 1260 148"
        fill="none"
        stroke="rgba(248,250,252,0.07)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M 80 98 Q 280 72 480 88 Q 640 102 820 84 Q 1000 66 1180 78"
        fill="none"
        stroke="rgba(61,212,192,0.14)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

/**
 * One continuous beat: portfolio clip + dimmer + car share the same duration, delay, and easing
 * (see `--pf-f1-*` in portfolio-themes.css). No mid-motion hold on the car.
 */
export default function FormulaOneIntro({ onComplete, reducedMotion }: Props) {
  const [phase, setPhase] = useState<'dramatic' | 'exit'>('dramatic');

  useEffect(() => {
    if (reducedMotion) {
      const t = window.setTimeout(onComplete, 320);
      return () => window.clearTimeout(t);
    }
    const delayMs = 80;
    const durMs = 2350;
    const motionEnd = delayMs + durMs + 40;
    const tExit = window.setTimeout(() => setPhase('exit'), motionEnd);
    const tDone = window.setTimeout(onComplete, motionEnd + 280);
    return () => {
      window.clearTimeout(tExit);
      window.clearTimeout(tDone);
    };
  }, [onComplete, reducedMotion]);

  if (reducedMotion) {
    return null;
  }

  return (
    <div
      className={cn(
        'pf-f1-intro-root pointer-events-none fixed inset-0 z-[60] flex flex-col bg-transparent',
        phase === 'exit' && 'opacity-0 transition-opacity duration-300 ease-out'
      )}
      role="presentation"
      aria-hidden
    >
      <div className="pf-f1-intro-dimmer pointer-events-none absolute inset-0 z-0 bg-[#06080d]" />

      <div className="pointer-events-none absolute inset-0 z-[2] opacity-[0.055] [background-image:repeating-linear-gradient(90deg,transparent,transparent_52px,rgba(200,214,232,0.1)_52px,rgba(200,214,232,0.1)_53px)]" />

      <TireSkids />

      <div className="relative z-[4] mx-auto mt-[min(6vh,3rem)] w-[min(94vw,44rem)] px-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.28em] text-slate-400/55">
          <span className="rounded-sm border border-white/20 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-[color:color-mix(in_srgb,var(--pf-accent)_75%,#e8eef5)]">
            Live
          </span>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2">
            <span>GAP</span>
            <span>Δ LAP</span>
            <span>DRS</span>
          </div>
          <span className="opacity-55">LAP 1 OF 72</span>
        </div>

        <div className="pf-f1-intro-hud-line mt-4 h-[2px] w-full bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      </div>

      <div className="pf-f1-intro-car-shell">
        <div className="pf-f1-intro-car flex w-[118%] items-center">
          <img
            src={F1_CAR_SRC}
            alt=""
            fetchPriority="high"
            draggable={false}
            className="pointer-events-none h-auto max-h-[min(48vh,15rem)] w-auto max-w-[min(92vw,28rem)] object-contain object-center brightness-[1.06] contrast-[1.05] saturate-[1.02] drop-shadow-[0_0_32px_rgba(61,212,192,0.22)] md:max-h-[min(52vh,17.5rem)] md:max-w-[32rem]"
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-[2] opacity-25 [background:radial-gradient(ellipse_90%_55%_at_50%_115%,rgba(61,212,192,0.07),transparent_58%)]" />
    </div>
  );
}
