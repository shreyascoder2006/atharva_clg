import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, ArrowLeft, Droplets, Lock, Move3d, Orbit, Thermometer, Vibrate } from 'lucide-react';

import { Chip, Dot, Sparkline } from '@/components/hud/ui';
import { SHIPMENT } from '@/data/shipment';
import { formatLatLonShort } from '@/lib/format';
import { PALETTE } from '@/lib/palette';
import { cargoAt } from '@/lib/schedule';
import { useSchedule, useShipment, useViewHour } from '@/store/shipment';
import { ContainerScene } from './ContainerScene';
import { STATUS_COLOR, palletPositions, type PalletStatus } from './containerModel';
import { telemetry, type Sample } from './telemetry';

const STATUS_LABEL: Record<PalletStatus, string> = {
  cleared: 'Inspected · cleared',
  pending: 'Awaiting gate scan',
  variance: 'Weight variance',
  flagged: 'RMS examination',
};

/** Inspection state per pallet, derived from what has actually happened to the box. */
function usePalletStatuses(): PalletStatus[] {
  const customs = useShipment((s) => s.customs);
  const docsVerified = useShipment((s) => s.docsVerified);
  const gatedIn = useShipment((s) => s.actuals.gateIn !== undefined);
  return useMemo(() => {
    const n = palletPositions().length;
    return Array.from({ length: n }, (_, i) => {
      if (customs === 'active' && (i === 13 || i === 15)) return 'flagged';
      if (!docsVerified && (i === 5 || i === 22)) return 'variance';
      // The last row by the doors is scanned at the port gate.
      if (!gatedIn && i >= n - 4) return 'pending';
      return 'cleared';
    });
  }, [customs, docsVerified, gatedIn]);
}

export function CargoTwinModal() {
  const twin = useShipment((s) => s.twin);
  return <AnimatePresence>{twin === 'open' && <TwinView key="twin" />}</AnimatePresence>;
}

function TwinView() {
  const close = useShipment((s) => s.closeTwin);
  const statuses = usePalletStatuses();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const counts = statuses.reduce<Record<PalletStatus, number>>(
    (acc, s) => ({ ...acc, [s]: acc[s] + 1 }),
    { cleared: 0, pending: 0, variance: 0, flagged: 0 },
  );

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label="3D cargo twin"
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_40%_35%,#fbfdff_0%,#f1f5fa_45%,#e3ebf6_100%)]" />
      <div className="absolute inset-0">
        <Canvas
          shadows="percentage"
          flat
          dpr={[1, 2]}
          camera={{ fov: 34, near: 0.1, far: 200, position: [4, 34, 8] }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <ContainerScene statuses={statuses} onHover={(i, x, y) => setHover(i === null ? null : { i, x: x!, y: y! })} />
        </Canvas>
      </div>

      {/* Header. */}
      <div className="pointer-events-none absolute top-4 right-4 left-4 flex items-start justify-between gap-4">
        <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl py-2.5 pr-4 pl-2.5">
          <button
            onClick={close}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-[12px] font-semibold text-white transition-transform active:scale-[0.98]"
          >
            <ArrowLeft size={14} /> Back to orbit
          </button>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-ink">3D Cargo Twin</span>
              <span className="num text-[12px] font-semibold text-cobalt">{SHIPMENT.container}</span>
            </div>
            <div className="text-[11px] text-muted">
              {SHIPMENT.equipment} · {SHIPMENT.packages} · {SHIPMENT.cargo}
            </div>
          </div>
        </div>
        <div className="glass pointer-events-auto hidden items-center gap-3 rounded-2xl px-3.5 py-2.5 md:flex">
          {(Object.keys(counts) as PalletStatus[])
            .filter((k) => counts[k] > 0)
            .map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STATUS_COLOR[k] }} />
                {STATUS_LABEL[k]} <span className="num text-muted">{counts[k]}</span>
              </span>
            ))}
        </div>
      </div>

      <TelemetryPanel />

      <div className="glass pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-muted">
        <Orbit size={13} className="text-cobalt" /> Drag to orbit · scroll to zoom · hover a pallet · Esc to return
      </div>

      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass-strong pointer-events-none fixed z-[60] rounded-xl px-3 py-2"
            style={{ left: hover.x + 14, top: hover.y + 14 }}
          >
            <div className="num text-[11.5px] font-semibold text-ink">PLT-{String(hover.i + 1).padStart(2, '0')}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: STATUS_COLOR[statuses[hover.i]] }}>
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[statuses[hover.i]] }} />
              {STATUS_LABEL[statuses[hover.i]]}
            </div>
            <div className="num mt-0.5 text-[10px] text-muted">40 pcs · 356.9 kg gross</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TelemetryPanel() {
  const schedule = useSchedule();
  const h = useViewHour();
  const cargo = cargoAt(schedule, h);
  const [, setTick] = useState(0);

  useEffect(() => {
    telemetry.prime();
    const id = setInterval(() => {
      telemetry.onRoad = useShipment.getState().actuals.gateIn === undefined;
      telemetry.sample();
      setTick((n) => n + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const hist = telemetry.history;
  const last: Sample = telemetry.latest();
  const series = (k: keyof Sample) => hist.map((s) => s[k] as number);
  const shockPeak = Math.max(...series('shock'));

  return (
    <motion.aside
      initial={{ x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass absolute top-[88px] right-4 bottom-4 w-[330px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[22px] p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-cobalt" />
          <span className="text-[13px] font-semibold text-ink">Live IoT telemetry</span>
        </div>
        <Chip tone="emerald">
          <Dot tone="emerald" pulse size={5} /> 2 Hz
        </Chip>
      </div>
      <div className="num mt-1 text-[10.5px] text-muted">
        {formatLatLonShort(cargo.lat, cargo.lon)} · {cargo.phase === 'port' ? 'at JNPT terminal' : cargo.leg.mode}
      </div>

      <div className="mt-3 space-y-2">
        <Reading
          icon={<Thermometer size={14} />}
          label="Temperature"
          value={`${last.temp.toFixed(1)}°C`}
          band="15–25°C"
          values={series('temp')}
          bandRange={[15, 25]}
          tone="cobalt"
        />
        <Reading
          icon={<Droplets size={14} />}
          label="Humidity"
          value={`${last.rh.toFixed(0)}% RH`}
          band="< 70% RH"
          values={series('rh')}
          bandRange={[40, 70]}
          tone="sky"
        />
        <Reading
          icon={<Vibrate size={14} />}
          label="Shock"
          value={`${last.shock.toFixed(2)} g`}
          band={`peak ${shockPeak.toFixed(2)} g · limit 2.5 g`}
          values={series('shock')}
          bandRange={[0, 2.5]}
          tone={shockPeak > 1.5 ? 'amber' : 'violet'}
        />
        <Reading
          icon={<Move3d size={14} />}
          label="Tilt"
          value={`${last.tilt.toFixed(1)}°`}
          band="limit 15°"
          values={series('tilt')}
          bandRange={[0, 15]}
          tone="emerald"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Fact icon={<Lock size={12} />} label="e-Seal" value={SHIPMENT.seal} sub="Intact · RFID" />
        <Fact icon={<Lock size={12} />} label="Door" value="Closed" sub="0 open events" />
      </div>
      <p className="mt-3 text-[10.5px] leading-snug text-muted">
        Sensor readings stream through the same pipe as ULIP milestones, so a breach or excursion becomes an alert for every party at once.
      </p>
    </motion.aside>
  );
}

function Reading({
  icon,
  label,
  value,
  band,
  values,
  bandRange,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  band: string;
  values: number[];
  bandRange: [number, number];
  tone: 'cobalt' | 'sky' | 'violet' | 'emerald' | 'amber';
}) {
  return (
    <div className="rounded-2xl bg-white/75 p-3 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <span style={{ color: PALETTE[tone] }}>{icon}</span>
          {label}
        </span>
        <span className="text-[9.5px] text-subtle">{band}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="num text-[20px] leading-none font-semibold text-ink">{value}</span>
        <Sparkline values={values.slice(-48)} tone={tone} width={150} height={32} band={bandRange[1] - bandRange[0] < 40 ? bandRange : undefined} />
      </div>
    </div>
  );
}

function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white/75 px-2.5 py-2 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
      <div className="flex items-center gap-1 text-[9.5px] font-semibold tracking-[0.08em] text-subtle uppercase">
        <span className="text-emerald">{icon}</span>
        {label}
      </div>
      <div className="num text-[12px] font-semibold text-ink">{value}</div>
      <div className="text-[10px] text-emerald">{sub}</div>
    </div>
  );
}
