import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BatteryFull,
  Camera,
  CheckCheck,
  ChevronLeft,
  Link2,
  Lock,
  MapPin,
  ShieldCheck,
  Signal,
  Smartphone,
  Wifi,
  X,
} from 'lucide-react';

import { ESCROW, ROLES, SHIPMENT } from '@/data/shipment';
import { formatDuration, formatTime } from '@/lib/format';
import { PALETTE } from '@/lib/palette';
import { useSchedule, useShipment } from '@/store/shipment';

type Stage = 'idle' | 'camera' | 'uploading' | 'done';

/**
 * The truck driver's side of the platform: no app install, just a magic link opened
 * from a chat message. One tap uploads a geo-tagged gate-in photo and closes the loop
 * back to the command centre.
 */
export function DriverPhone() {
  const open = useShipment((s) => s.phoneOpen);
  const setPhone = useShipment((s) => s.setPhone);

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setPhone(true)}
            className="glass absolute bottom-4 left-[calc(var(--rail)+16px)] z-30 grid h-[56px] w-[56px] place-items-center rounded-2xl text-violet transition-transform hover:scale-[1.04]"
            title="Driver mobile simulator"
            aria-label="Open driver mobile simulator"
          >
            <Smartphone size={20} />
            <PhoneBadge />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.94 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-4 left-[calc(var(--rail)+16px)] z-40 origin-bottom-left"
          >
            <PhoneFrame onClose={() => setPhone(false)}>
              <DriverChat />
            </PhoneFrame>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PhoneBadge() {
  const pending = useShipment((s) => s.actuals.gateIn === undefined && !s.driving);
  if (!pending) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet opacity-50" />
      <span className="relative grid h-4 w-4 place-items-center rounded-full bg-violet text-[9px] font-bold text-white shadow-[0_0_0_2px_white]">1</span>
    </span>
  );
}

function PhoneFrame({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const nowH = useShipment((s) => s.nowH);
  return (
    <div className="relative h-[560px] w-[278px] rounded-[46px] bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0] p-[9px] shadow-[0_40px_80px_-20px_rgb(15_23_42/0.45),0_0_0_1px_rgb(15_23_42/0.12),inset_0_1px_0_white]">
      <button
        onClick={onClose}
        className="absolute -top-2 -right-2 z-20 grid h-7 w-7 place-items-center rounded-full bg-white text-muted shadow-[0_4px_12px_rgb(15_23_42/0.18)] transition-colors hover:text-ink"
        aria-label="Close driver simulator"
      >
        <X size={14} />
      </button>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[38px] bg-[#f3f5f9] shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)]">
        {/* Status bar + island. */}
        <div className="relative flex h-9 shrink-0 items-center justify-between px-6 pt-1 text-[11px] font-semibold text-ink">
          <span className="num">{formatTime(nowH)}</span>
          <span className="absolute top-2 left-1/2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-[#0b1020]" />
          <span className="flex items-center gap-1 text-ink">
            <Signal size={11} />
            <Wifi size={11} />
            <BatteryFull size={13} />
          </span>
        </div>
        {children}
        <div className="mx-auto mb-1.5 h-1 w-[96px] shrink-0 rounded-full bg-ink/80" />
      </div>
    </div>
  );
}

function DriverChat() {
  const schedule = useSchedule();
  const nowH = useShipment((s) => s.nowH);
  const gateIn = useShipment((s) => s.actuals.gateIn);
  const driving = useShipment((s) => s.driving);
  const highway = useShipment((s) => s.highway);
  const confirm = useShipment((s) => s.confirmGateIn);
  const [localStage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);

  // The store is the source of truth: gate-in can also complete or be reset from the
  // command centre, so the phone's own stage only covers the capture animation.
  const stage: Stage =
    gateIn !== undefined ? 'done' : localStage === 'done' && !driving ? 'idle' : localStage === 'done' ? 'uploading' : localStage;

  const shoot = () => {
    setStage('camera');
    setTimeout(() => {
      setStage('uploading');
      setProgress(0);
      const t0 = performance.now();
      const id = setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / 1100);
        setProgress(p);
        if (p >= 1) {
          clearInterval(id);
          confirm();
          setStage('done');
        }
      }, 40);
    }, 900);
  };

  const eta = Math.max(0, schedule.gateInH - nowH);
  const viaRail = highway === 'rail';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Chat header. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-900/[0.06] bg-white/90 px-3 py-2">
        <ChevronLeft size={16} className="text-cobalt" />
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-cobalt to-violet text-[10px] font-bold text-white">OS</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[12px] font-semibold text-ink">OneShip Driver Desk</div>
          <div className="flex items-center gap-1 text-[9.5px] text-emerald">
            <Lock size={8} /> verified business · magic link
          </div>
        </div>
      </div>

      <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 py-3">
        <DayChip>Today</DayChip>
        <Bubble>
          Namaste {ROLES.transporter.person.split(' ')[0]} 👋 Trip <b className="num">TRP-4471</b>: Chakan → JNPT Gate 4.
          <div className="num mt-1 text-[10px] text-muted">
            {SHIPMENT.container} · seal {SHIPMENT.seal}
          </div>
        </Bubble>
        <LinkCard />
        {highway === 'active' && (
          <Bubble tone="alert">⚠ Standstill reported at Khandala Ghat. Hold position; the control tower is re-planning your route.</Bubble>
        )}
        {(highway === 'nh48' || highway === 'rail') && (
          <Bubble>
            {viaRail
              ? '🚆 New plan: hand the box over at Talegaon ICD. CONCOR rake 18:40 takes it to JNPT.'
              : '🧭 New route: exit at Lonavala onto old NH-48 via Khopoli and rejoin at Panvel. Gate 4 slot rebooked.'}
          </Bubble>
        )}
        {gateIn === undefined && !driving && (
          <Bubble>
            {viaRail ? 'Rail gate-in at JNPT is expected in ' : "You're "}
            <b className="num">{formatDuration(eta)}</b>
            {viaRail ? '. Confirm the hand-over below.' : ' from Gate 4. On arrival, upload the gate-in photo below.'}
          </Bubble>
        )}

        <AnimatePresence>
          {stage === 'camera' && <CameraFrame key="cam" />}
          {stage === 'uploading' && (
            <motion.div key="up" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-auto w-[82%]">
              <PhotoThumb />
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-cobalt/15">
                <div className="h-full rounded-full bg-cobalt transition-[width] duration-75" style={{ width: `${progress * 100}%` }} />
              </div>
              <div className="num mt-0.5 text-right text-[9px] text-muted">Uploading · geo-tag 18.9496°N 72.9511°E</div>
            </motion.div>
          )}
          {stage === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
              <div className="ml-auto w-[82%]">
                <PhotoThumb />
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-muted">
                  {formatTime(gateIn ?? nowH)} <CheckCheck size={11} className="text-sky" />
                </div>
              </div>
              <Bubble tone="success">
                ✅ Gate-in confirmed at JNPT Gate 4
                <div className="num mt-0.5 text-[10px] text-muted">OCR match {SHIPMENT.container} · {SHIPMENT.truck}</div>
              </Bubble>
              <Bubble tone="success">
                💰 Escrow released: <b className="num">{ESCROW[0].amount}</b> → {ESCROW[0].party}
              </Bubble>
              <Bubble>🔁 Baton handed to the Customs Broker. Safe drive back, {ROLES.transporter.person.split(' ')[0]}!</Bubble>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-slate-900/[0.06] bg-white/90 p-2.5">
        {stage === 'done' ? (
          <div className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-emerald/10 text-[12px] font-semibold text-emerald">
            <ShieldCheck size={15} /> Trip closed · payment released
          </div>
        ) : (
          <button
            onClick={shoot}
            disabled={stage !== 'idle' || driving}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#22c55e] to-emerald px-3 py-2 text-[12px] leading-tight font-semibold text-white shadow-[0_8px_20px_-8px_rgb(5_150_105/0.9),inset_0_1px_0_rgb(255_255_255/0.3)] transition-all active:scale-[0.98] disabled:opacity-70"
          >
            <Camera size={16} className="shrink-0" />
            {stage === 'idle' ? 'Upload Gate-In Photo & Confirm Arrival' : 'Capturing…'}
          </button>
        )}
      </div>
    </div>
  );
}

function DayChip({ children }: { children: ReactNode }) {
  return <div className="mx-auto rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold text-muted shadow-sm">{children}</div>;
}

function Bubble({ children, tone }: { children: ReactNode; tone?: 'alert' | 'success' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="max-w-[88%] rounded-2xl rounded-tl-md px-2.5 py-1.5 text-[11.5px] leading-snug text-ink shadow-[0_1px_1px_rgb(15_23_42/0.06)]"
      style={{ background: tone === 'alert' ? '#fef2f2' : tone === 'success' ? '#ecfdf5' : 'white' }}
    >
      {children}
    </motion.div>
  );
}

function LinkCard() {
  return (
    <div className="max-w-[88%] overflow-hidden rounded-2xl rounded-tl-md bg-white shadow-[0_1px_1px_rgb(15_23_42/0.06)]">
      <div className="flex items-center gap-2 bg-gradient-to-r from-cobalt/10 to-violet/10 px-2.5 py-2">
        <Link2 size={13} className="text-cobalt" />
        <span className="num text-[10.5px] font-semibold text-cobalt">oneship.link/t/4471</span>
      </div>
      <div className="space-y-0.5 px-2.5 py-1.5 text-[10.5px] text-muted">
        <div className="flex items-center gap-1">
          <ShieldCheck size={10} className="text-emerald" /> VAHAN: RC & permit valid
        </div>
        <div className="flex items-center gap-1">
          <ShieldCheck size={10} className="text-emerald" /> e-Way Bill active · 36h left
        </div>
        <div className="flex items-center gap-1">
          <MapPin size={10} className="text-violet" /> Pre-gate token PG-0482 · Gate 4
        </div>
      </div>
    </div>
  );
}

function CameraFrame() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative overflow-hidden rounded-2xl">
      <PhotoThumb />
      <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ delay: 0.55, duration: 0.35 }} />
      <div className="absolute inset-2 rounded-xl border-2 border-white/80" />
    </motion.div>
  );
}

/** Stylised gate-in photo: canopy, OCR lane, the box with its stencilled number. */
function PhotoThumb() {
  return (
    <svg viewBox="0 0 220 140" className="block w-full rounded-2xl" role="img" aria-label="Gate-in photo of the container at JNPT Gate 4">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dbeafe" />
          <stop offset="1" stopColor="#f1f5f9" />
        </linearGradient>
      </defs>
      <rect width="220" height="140" fill="url(#sky)" />
      <rect y="104" width="220" height="36" fill="#cbd5e1" />
      <rect x="8" y="22" width="204" height="10" rx="2" fill="#475569" />
      <rect x="14" y="32" width="6" height="74" fill="#64748b" />
      <rect x="200" y="32" width="6" height="74" fill="#64748b" />
      <text x="110" y="30" textAnchor="middle" fontSize="7" fill="white" fontFamily="monospace">JNPA · GATE 4 · OCR LANE</text>
      <rect x="40" y="50" width="140" height="48" rx="2" fill={PALETTE.cobalt} />
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x={46 + i * 10.4} y="53" width="1.4" height="42" fill="white" opacity="0.25" />
      ))}
      <rect x="48" y="56" width="70" height="12" rx="1" fill="white" opacity="0.92" />
      <text x="83" y="64.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
        {SHIPMENT.container}
      </text>
      <rect x="30" y="96" width="160" height="8" fill="#334155" />
      <circle cx="58" cy="106" r="6" fill="#1e293b" />
      <circle cx="160" cy="106" r="6" fill="#1e293b" />
      <rect x="150" y="70" width="22" height="9" rx="1.5" fill="#fde047" />
      <text x="161" y="76.5" textAnchor="middle" fontSize="4.5" fontWeight="700" fill="#0f172a" fontFamily="monospace">
        MH12TX4471
      </text>
      <rect x="6" y="6" width="74" height="12" rx="6" fill="rgb(15 23 42 / 0.55)" />
      <text x="43" y="14.3" textAnchor="middle" fontSize="6" fill="white" fontFamily="monospace">● 18.9496N 72.9511E</text>
    </svg>
  );
}
