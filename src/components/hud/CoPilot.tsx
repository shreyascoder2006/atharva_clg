import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Clock3, DollarSign, Leaf, Loader2, Sparkles, TriangleAlert } from 'lucide-react';

import { DISRUPTIONS, type RecoveryOption } from '@/data/shipment';
import { formatDelta, formatKg, formatUsd } from '@/lib/format';
import { PALETTE, TONE_HEX } from '@/lib/palette';
import { buildSchedule } from '@/lib/schedule';
import { demurrageUsd, inputsOf, inputsWithRecovery, planOf, useShipment, type ActiveDisruption } from '@/store/shipment';
import { Chip } from './ui';

/** Ticks straight from the clock with requestAnimationFrame, outside React state. */
function DemurrageCounter({ rate, startedMs }: { rate: number; startedMs: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const usd = demurrageUsd(rate, (performance.now() - startedMs) / 1000);
      if (ref.current) ref.current.textContent = formatUsd(usd, true);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rate, startedMs]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-crimson/[0.08] to-crimson/[0.02] p-3 shadow-[inset_0_0_0_1px_rgb(220_38_38/0.16)]">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-semibold tracking-[0.12em] text-crimson/80 uppercase">Projected demurrage & detention</span>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-crimson" />
        </span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span ref={ref} className="num text-[28px] leading-none font-semibold tracking-tight text-crimson">
          $0.00
        </span>
        <span className="num pb-0.5 text-right text-[11px] font-semibold text-crimson/80">
          {formatUsd(rate)}/day
          <span className="block text-[9px] font-medium text-subtle">demo clock · 1s = 1h</span>
        </span>
      </div>
    </div>
  );
}

interface Evaluated {
  option: RecoveryOption;
  etaDeltaH: number;
  co2DeltaKg: number;
  co2Ratio: number;
  makesCutoff: boolean;
}

export function CoPilot() {
  const disruption = useShipment((s) => s.disruption);
  return (
    <AnimatePresence>
      {disruption && (
        <motion.div
          key={disruption.kind}
          initial={{ opacity: 0, x: -24, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -24, scale: 0.98 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto"
        >
          {/* Passed as a prop: AnimatePresence keeps these props for the exit animation,
              after the store has already cleared the disruption. */}
          <CoPilotCard disruption={disruption} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CoPilotCard({ disruption }: { disruption: ActiveDisruption }) {
  const execute = useShipment((s) => s.executeRecovery);
  const def = DISRUPTIONS[disruption.kind];
  const [choice, setChoice] = useState(def.options.find((o) => o.recommended)?.id ?? def.options[0].id);
  const [running, setRunning] = useState<number | null>(null);

  // Each option is run through the same schedule engine the globe uses, so the
  // trade-offs on the card are exactly what the arc will show after execution.
  const evaluated = useMemo<Evaluated[]>(() => {
    const s = useShipment.getState();
    const inputs = inputsOf(s);
    const plan = planOf(inputs);
    return def.options.map((option) => {
      const after = buildSchedule(inputsWithRecovery(inputs, disruption.kind, option.id));
      return {
        option,
        etaDeltaH: after.deliveredH - plan.deliveredH,
        co2DeltaKg: after.co2Kg - plan.co2Kg,
        co2Ratio: after.co2Kg / plan.co2Kg,
        makesCutoff: !after.rolled,
      };
    });
  }, [def, disruption.kind]);

  const selected = evaluated.find((e) => e.option.id === choice)!;

  const run = () => {
    if (running !== null) return;
    setRunning(0);
    const steps = selected.option.steps.length;
    for (let i = 1; i <= steps; i++) setTimeout(() => setRunning(i), i * 420);
    setTimeout(() => execute(choice), steps * 420 + 260);
  };

  return (
    <div className="glass-strong flex max-h-[calc(100vh-330px)] min-h-[420px] w-[372px] flex-col overflow-hidden rounded-[22px]">
      <div className="shrink-0 px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cobalt to-[#7c9bff] text-white shadow-[0_4px_12px_-4px_rgb(37_99_235/0.7)]">
            <Sparkles size={14} />
          </span>
          <div className="leading-tight">
            <div className="shimmer-text text-[13px] font-semibold">Agentic AI Recovery Co-Pilot</div>
            <div className="text-[10.5px] text-muted">2 plans simulated against the live schedule</div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-crimson/15 bg-white/70 p-2.5">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-crimson" />
          <div className="text-[11px] leading-snug">
            <div className="font-semibold text-ink">
              {def.title} <span className="font-medium text-muted">· {def.where}</span>
            </div>
            <div className="mt-0.5 line-clamp-2 text-muted" title={def.detail}>
              {def.detail}
            </div>
          </div>
        </div>

        <div className="mt-2.5">
          <DemurrageCounter rate={def.ratePerDay} startedMs={disruption.startedMs} />
        </div>
      </div>

      <div className="scroll-quiet min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3" role="radiogroup" aria-label="Recovery options">
        {evaluated.map((e) => (
          <OptionCard
            key={e.option.id}
            e={e}
            showCutoff={disruption.kind !== 'red_sea'}
            selected={e.option.id === choice}
            onSelect={() => running === null && setChoice(e.option.id)}
          />
        ))}
      </div>

      <div className="hairline shrink-0 border-t bg-white/50 px-4 py-3">
        <AnimatePresence initial={false}>
          {running !== null && (
            <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-2.5 space-y-1 overflow-hidden">
              {selected.option.steps.map((step, i) => (
                <li key={step} className="flex items-center gap-2 text-[11px]">
                  {running > i ? (
                    <Check size={12} className="text-emerald" />
                  ) : (
                    <Loader2 size={12} className="animate-spin text-cobalt" />
                  )}
                  <span className={running > i ? 'text-ink' : 'text-muted'}>{step}</span>
                </li>
              ))}
            </motion.ol>
          )}
        </AnimatePresence>
        <button
          onClick={run}
          disabled={running !== null}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-cobalt text-[12.5px] font-semibold text-white shadow-[0_10px_24px_-10px_rgb(37_99_235/0.9),inset_0_1px_0_rgb(255_255_255/0.2)] transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-80"
        >
          {running === null ? (
            <>
              <Sparkles size={14} /> Execute Recovery Plan
            </>
          ) : (
            <>
              <Loader2 size={14} className="animate-spin" /> Executing & broadcasting…
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function OptionCard({ e, selected, onSelect, showCutoff }: { e: Evaluated; selected: boolean; onSelect: () => void; showCutoff: boolean }) {
  const co2Tone = e.co2Ratio > 2 ? 'crimson' : e.co2Ratio > 1.03 ? 'amber' : 'emerald';
  const co2Label =
    e.co2Ratio > 2 ? `×${e.co2Ratio.toFixed(1)}` : Math.abs(e.co2DeltaKg) < 1 ? '±0' : `${e.co2DeltaKg > 0 ? '+' : '−'}${formatKg(Math.abs(e.co2DeltaKg))}`;
  const etaTone = Math.abs(e.etaDeltaH) < 0.25 ? 'emerald' : e.etaDeltaH < 0 ? 'cobalt' : e.etaDeltaH > 48 ? 'amber' : 'slate';

  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="block w-full rounded-2xl p-3 text-left transition-all"
      style={{
        background: selected ? 'rgb(255 255 255 / 0.95)' : 'rgb(255 255 255 / 0.5)',
        boxShadow: selected ? `inset 0 0 0 1.5px ${PALETTE.cobalt}, 0 8px 24px -12px rgb(37 99 235 / 0.4)` : 'inset 0 0 0 1px rgb(15 23 42 / 0.07)',
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px]"
          style={{ borderColor: selected ? PALETTE.cobalt : '#cbd5e1' }}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-cobalt" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-ink">{e.option.title}</span>
          </div>
          <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-muted" title={e.option.summary}>
            {e.option.summary}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
        {e.option.recommended && <Chip tone="cobalt" solid>Recommended</Chip>}
        <Chip tone={etaTone}>
          <Clock3 size={10} /> ETA {formatDelta(e.etaDeltaH)}
        </Chip>
        <Chip tone="slate">
          <DollarSign size={10} />
          {e.option.costUsd.toLocaleString()}
        </Chip>
        <Chip tone={co2Tone}>
          <Leaf size={10} /> {co2Label} CO₂e
        </Chip>
        {showCutoff && (e.makesCutoff ? <Chip tone="emerald">makes cutoff</Chip> : <Chip tone="amber">rolls vessel</Chip>)}
      </div>
      <div className="mt-2 flex items-center gap-2 pl-6">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-900/[0.06]">
          <div className="h-full rounded-full" style={{ width: `${e.option.confidence * 100}%`, background: TONE_HEX.cobalt }} />
        </div>
        <span className="num text-[9.5px] text-subtle">{Math.round(e.option.confidence * 100)}% confidence</span>
      </div>
    </button>
  );
}
