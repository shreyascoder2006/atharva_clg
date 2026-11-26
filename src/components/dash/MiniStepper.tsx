import { motion } from 'motion/react';
import { Check } from 'lucide-react';

import { formatStamp } from '@/lib/format';
import { TONE_HEX, type Tone } from '@/lib/palette';
import type { PortfolioStep, StepStatus } from './usePortfolio';

const TONE: Record<StepStatus, Tone> = {
  done: 'emerald',
  active: 'cobalt',
  forecast: 'cobalt',
  risk: 'amber',
  blocked: 'crimson',
  pending: 'slate',
};

const WORD: Record<StepStatus, string> = {
  done: 'Done',
  active: 'Next',
  forecast: 'Forecast',
  risk: 'At risk',
  blocked: 'Blocked',
  pending: 'Planned',
};

/** A compact horizontal milestone stepper. Scrolls sideways when the journey is long. */
export function MiniStepper({ steps, tz = 'Asia/Kolkata' }: { steps: PortfolioStep[]; tz?: string }) {
  return (
    <ol className="scroll-quiet flex overflow-x-auto pt-1 pb-2" aria-label="Milestones">
      {steps.map((s, i) => {
        const hex = TONE_HEX[TONE[s.status]];
        const next = steps[i + 1];
        const solid = s.status === 'done';
        return (
          <motion.li
            key={`${s.label}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.025, duration: 0.25 }}
            className="relative flex w-[118px] shrink-0 flex-col items-start pr-3"
          >
            <div className="flex w-full items-center">
              <span
                className="relative grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                style={{
                  background: solid ? hex : 'white',
                  boxShadow: solid ? `0 4px 10px -4px ${hex}` : `inset 0 0 0 1.5px color-mix(in oklab, ${hex} ${s.status === 'pending' ? 35 : 80}%, transparent)`,
                }}
              >
                {solid && <Check size={10} strokeWidth={3} className="text-white" />}
                {(s.status === 'active' || s.status === 'risk' || s.status === 'blocked') && (
                  <>
                    <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: hex }} />
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: hex }} />
                  </>
                )}
              </span>
              {next && (
                <span
                  className="mx-1 h-[2px] flex-1 rounded-full"
                  style={{ background: solid && next.status === 'done' ? TONE_HEX.emerald : 'repeating-linear-gradient(90deg, rgba(15,23,42,0.16) 0 4px, transparent 4px 8px)' }}
                />
              )}
            </div>
            <div className="mt-1.5 line-clamp-2 text-[11px] leading-snug font-medium text-ink" title={s.label}>
              {s.label}
            </div>
            <div className="num mt-0.5 text-[10px]" style={{ color: s.status === 'pending' ? '#94A3B8' : hex }}>
              {WORD[s.status]} · {formatStamp(s.atH, tz).slice(4, 16)}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
