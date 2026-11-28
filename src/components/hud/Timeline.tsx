import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, CircleDot, Lock, Pause, Play, ShieldX, Timer } from 'lucide-react';

import { FLEET } from '@/data/fleet';
import { ROLES, T } from '@/data/shipment';
import { formatOffset, formatStamp } from '@/lib/format';
import { PALETTE, TONE_HEX } from '@/lib/palette';
import { escrowStatus, milestoneStatuses, type MilestoneStatus } from '@/lib/schedule';
import { useSelectedSchedule, useShipment, useViewHour } from '@/store/shipment';
import { RoleAvatar } from './ui';

const MIN = T.scrubMin;
const MAX = T.scrubMax;
const SNAP = 1.25;

const STATUS_HEX: Record<MilestoneStatus, string> = {
  done: PALETTE.emerald,
  forecast: '#6ee7b7',
  active: PALETTE.cobalt,
  blocked: PALETTE.crimson,
  risk: PALETTE.amber,
  pending: '#cbd5e1',
};

const pct = (h: number) => ((h - MIN) / (MAX - MIN)) * 100;

export function Timeline() {
  return (
    <div className="glass pointer-events-auto w-full overflow-visible rounded-[22px] px-4 pt-3 pb-3">
      <Scrubber />
      <EscrowBar />
    </div>
  );
}

function Scrubber() {
  const schedule = useSelectedSchedule();
  const nowH = useShipment((s) => s.nowH);
  const viewH = useShipment((s) => s.viewH);
  const scrub = useShipment((s) => s.scrub);
  const h = useViewHour();
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const live = viewH === null;
  const statuses = milestoneStatuses(schedule, h, nowH);

  const hourAt = useCallback(
    (clientX: number) => {
      const r = track.current!.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const v = MIN + t * (MAX - MIN);
      return Math.abs(v - nowH) < SNAP ? null : v;
    },
    [nowH],
  );

  // Forecast playback: sweep from the current view to +96h over ~14 seconds.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const s = useShipment.getState();
      const cur = s.viewH ?? s.nowH;
      const next = Math.min(MAX, cur + dt * 7);
      s.scrub(next);
      if (next >= MAX) setPlaying(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 6 : 1;
    if (e.key === 'ArrowRight') scrub(Math.min(MAX, h + step));
    else if (e.key === 'ArrowLeft') scrub(Math.max(MIN, h - step));
    else if (e.key === 'Home') scrub(MIN);
    else if (e.key === 'End') scrub(MAX);
    else if (e.key.toLowerCase() === 'l') scrub(null);
    else return;
    e.preventDefault();
  };

  const visible = useMemo(
    () => schedule.milestones.filter((m) => {
      const t = m.actualH ?? m.plannedH;
      return t >= MIN && t <= MAX;
    }),
    [schedule],
  );

  const ticks = [-48, -36, -24, -12, 0, 12, 24, 36, 48, 60, 72, 84, 96];

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow">4D Timeline</span>
          <span
            className="num rounded-md px-1.5 py-px text-[11px] font-semibold"
            style={{
              color: live ? PALETTE.emerald : h > nowH ? PALETTE.cobalt : PALETTE.muted,
              background: live ? 'rgb(5 150 105 / 0.1)' : h > nowH ? 'rgb(37 99 235 / 0.08)' : 'rgb(71 85 105 / 0.08)',
            }}
          >
            {live ? '● LIVE' : formatOffset(h - nowH)}
          </span>
          <span className="num hidden text-[11px] text-muted md:inline">{formatStamp(h)} IST</span>
          {!live && <span className="hidden text-[10.5px] text-subtle md:inline">{h > nowH ? 'Forecast view' : 'Replay view'}</span>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause forecast playback' : 'Play forecast'}
            className="flex h-7 items-center gap-1 rounded-lg border border-hairline bg-white/80 px-2 text-[11px] font-semibold text-ink transition-colors hover:bg-white"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            <span className="max-sm:hidden">{playing ? 'Pause' : 'Play forecast'}</span>
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              scrub(null);
            }}
            disabled={live}
            className="h-7 rounded-lg bg-emerald px-2.5 text-[11px] font-semibold text-white shadow-[0_4px_12px_-4px_rgb(5_150_105/0.7)] transition-opacity disabled:opacity-35"
          >
            Go live
          </button>
        </div>
      </div>

      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Shipment timeline"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(h - nowH)}
        aria-valuetext={live ? 'Live' : formatOffset(h - nowH)}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          setPlaying(false);
          scrub(hourAt(e.clientX));
        }}
        onPointerMove={(e) => dragging && scrub(hourAt(e.clientX))}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className="relative h-11 cursor-ew-resize touch-none select-none outline-none"
      >
        {/* Rail: replay (solid) and forecast (hatched). */}
        <div className="absolute top-[18px] right-0 left-0 h-[6px] overflow-hidden rounded-full bg-slate-900/[0.06]">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald/25 to-emerald/60" style={{ width: `${pct(Math.min(h, nowH))}%` }} />
          <div
            className="absolute inset-y-0"
            style={{
              left: `${pct(nowH)}%`,
              right: 0,
              backgroundImage: 'repeating-linear-gradient(135deg, rgb(37 99 235 / 0.14) 0 4px, transparent 4px 8px)',
            }}
          />
          {h > nowH && (
            <div className="absolute inset-y-0 bg-cobalt/30" style={{ left: `${pct(nowH)}%`, width: `${pct(h) - pct(nowH)}%` }} />
          )}
        </div>

        {/* Hour ticks. */}
        {ticks.map((t) => (
          <div key={t} className="absolute top-[28px]" style={{ left: `${pct(t)}%` }}>
            <div className="mx-auto h-1.5 w-px bg-slate-900/15" />
            <div className={`num mt-0.5 -translate-x-1/2 text-[9px] font-medium whitespace-nowrap text-subtle ${t % 24 === 0 ? '' : 'max-sm:hidden'}`}>
              {t === 0 ? '' : `${t > 0 ? '+' : ''}${t}h`}
            </div>
          </div>
        ))}

        {/* Vessel cutoff. */}
        {schedule.cutoffH !== null && (
          <div className="absolute top-[11px] h-[20px] w-px" style={{ left: `${pct(schedule.cutoffH)}%`, background: PALETTE.amber }} title="Vessel cutoff">
            <Timer size={10} className="absolute -top-3 -left-[5px]" style={{ color: PALETTE.amber }} />
          </div>
        )}

        {/* LIVE marker. */}
        <div className="absolute top-[8px]" style={{ left: `${pct(nowH)}%` }}>
          <div className="mx-auto h-[26px] w-[2px] -translate-x-1/2 rounded-full bg-emerald" />
          <div className="num absolute top-[27px] -translate-x-1/2 text-[9px] font-bold tracking-wider text-emerald">LIVE</div>
        </div>

        {/* Milestones. */}
        {visible.map((m) => {
          const t = m.actualH ?? m.plannedH;
          const st = statuses[m.id];
          return (
            <div
              key={m.id}
              className="absolute top-[14px] z-10"
              style={{ left: `${pct(t)}%` }}
              onPointerEnter={() => setHover(m.id)}
              onPointerLeave={() => setHover((x) => (x === m.id ? null : x))}
            >
              <motion.div
                className="h-[11px] w-[11px] -translate-x-1/2 rotate-45 rounded-[2.5px] border-[1.5px] border-white"
                animate={{ backgroundColor: STATUS_HEX[st], scale: st === 'active' || st === 'blocked' ? 1.18 : 1 }}
                transition={{ duration: 0.3 }}
                style={{ boxShadow: st === 'blocked' ? `0 0 0 3px ${PALETTE.crimson}33` : '0 1px 3px rgb(15 23 42 / 0.2)' }}
              />
              <AnimatePresence>
                {hover === m.id && !dragging && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="glass-strong absolute bottom-[22px] left-0 z-30 -translate-x-1/2 rounded-xl px-2.5 py-1.5 whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <RoleAvatar role={m.meta.owner} size={16} />
                      <span className="text-[11px] font-semibold text-ink">{m.label}</span>
                    </div>
                    <div className="num mt-0.5 text-[10px] text-muted">
                      {formatStamp(t)} · <span style={{ color: STATUS_HEX[st] === '#cbd5e1' ? PALETTE.muted : STATUS_HEX[st] }}>{statusLabel(st, m.blocked ?? m.atRisk)}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Thumb. */}
        <motion.div
          className="pointer-events-none absolute top-[9px] z-20"
          animate={{ left: `${pct(h)}%` }}
          transition={dragging ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
        >
          <div
            className="h-6 w-6 -translate-x-1/2 rounded-full border-[3px] bg-white shadow-[0_4px_14px_rgb(15_23_42/0.22)]"
            style={{ borderColor: live ? PALETTE.emerald : h > nowH ? PALETTE.cobalt : PALETTE.muted }}
          />
        </motion.div>
      </div>
    </div>
  );
}

function statusLabel(st: MilestoneStatus, note?: string) {
  if (note && (st === 'blocked' || st === 'risk')) return note;
  return { done: 'Completed', forecast: 'Forecast', active: 'Next up', blocked: 'Blocked', risk: 'At risk', pending: 'Pending' }[st];
}

/* --- Milestone escrow ---------------------------------------------------------------- */

function EscrowBar() {
  const schedule = useSelectedSchedule();
  const nowH = useShipment((s) => s.nowH);
  const h = useViewHour();
  const statuses = milestoneStatuses(schedule, h, nowH);
  const escrow = FLEET[useShipment((s) => s.selected)].escrow;
  const released = escrow.filter((e) => escrowStatus(statuses[e.trigger]) === 'released').length;

  return (
    <div className="hairline mt-2.5 border-t pt-2.5 max-sm:hidden">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="eyebrow">Milestone escrow</span>
        <span className="num text-[10px] text-subtle">
          {released}/{escrow.length} released · smart-contract triggers on milestone proof
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
        {escrow.map((e) => {
          const st = escrowStatus(statuses[e.trigger]);
          const tone = st === 'released' ? 'emerald' : st === 'scheduled' ? 'cobalt' : st === 'blocked' ? 'crimson' : 'slate';
          const hex = TONE_HEX[tone];
          return (
            <motion.div
              key={e.id}
              layout
              className="flex items-center gap-2 rounded-xl px-2 py-1.5"
              animate={{
                backgroundColor: st === 'released' ? 'rgba(5,150,105,0.08)' : 'rgba(255,255,255,0.7)',
              }}
              style={{ boxShadow: `inset 0 0 0 1px ${st === 'released' ? 'rgba(5,150,105,0.25)' : 'rgba(15,23,42,0.06)'}` }}
            >
              <RoleAvatar role={e.id} size={22} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-baseline gap-1">
                  <span className="num text-[11.5px] font-semibold text-ink">{e.amount}</span>
                  <span className="truncate text-[9.5px] text-subtle">{e.triggerLabel}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: hex }}>
                  {st === 'released' ? <BadgeCheck size={10} /> : st === 'blocked' ? <ShieldX size={10} /> : st === 'scheduled' ? <CircleDot size={10} /> : <Lock size={9} />}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={st}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      {st === 'released' ? 'Released' : st === 'scheduled' ? 'Releases on forecast' : st === 'blocked' ? 'Blocked' : 'Locked in Escrow'}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
              <span className="sr-only">{ROLES[e.id].label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
