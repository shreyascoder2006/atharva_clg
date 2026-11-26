import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BadgeCheck, Check, Leaf, PackagePlus, Plane, Ship, X } from 'lucide-react';

import { CountUp } from '@/components/hud/ui';
import { LANES, type LaneTemplate } from '@/data/lanes';
import { INCUMBENT, PARTNER_IDS, PARTNERS } from '@/data/partners';
import { CO2_FACTOR, ROLES, type RouteId } from '@/data/shipment';
import { formatDuration, formatKg, formatStamp, formatUsd } from '@/lib/format';
import { getRoute } from '@/lib/route';
import { useShipment } from '@/store/shipment';

const FORWARDERS = [INCUMBENT.org, ...PARTNER_IDS.map((p) => PARTNERS[p].name)];

/**
 * Book a shipment on one of the lane templates. Creating it adds a row to Fleet
 * Command and registers the lane with the globe, which draws the corridor in.
 */
export function NewShipmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return createPortal(<AnimatePresence>{open && <Dialog onClose={onClose} />}</AnimatePresence>, document.body);
}

function Dialog({ onClose }: { onClose: () => void }) {
  const create = useShipment((s) => s.createShipment);
  const track = useShipment((s) => s.trackShipment);
  const nowH = useShipment((s) => s.nowH);
  const [laneId, setLaneId] = useState(LANES[0].id);
  const lane = LANES.find((l) => l.id === laneId)!;
  const [cargo, setCargo] = useState(lane.cargo);
  const [kg, setKg] = useState(8400);
  const [value, setValue] = useState(96000);
  const [exporter, setExporter] = useState(ROLES.exporter.org);
  const [forwarder, setForwarder] = useState(INCUMBENT.org);
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = (l: LaneTemplate) => {
    setLaneId(l.id);
    setCargo(l.cargo);
  };

  const km = getRoute(lane.route.id as RouteId).km;
  const co2 = (kg / 1000) * (km * CO2_FACTOR[lane.mode] + lane.roadKm * CO2_FACTOR.road);
  const freight = lane.ratePerKg * kg;
  const etaH = nowH + lane.leadH + lane.transitH;
  const valid = cargo.trim().length > 1 && kg >= 50 && kg <= 40000 && value > 0;

  const submit = () => {
    if (!valid) return;
    setCreated(create({ laneId, cargo: cargo.trim(), grossKg: kg, valueUsd: value, exporter: exporter.trim() || ROLES.exporter.org, forwarder }));
  };

  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[#eef3f9]/70 backdrop-blur-md" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="New shipment"
        initial={{ y: 18, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong relative flex max-h-[calc(100vh-32px)] w-[760px] max-w-full flex-col overflow-hidden rounded-[24px]"
      >
        <div className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.06)] px-5 py-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cobalt to-[#7c9bff] text-white shadow-[0_6px_16px_-6px_rgb(37_99_235/0.8)]">
            <PackagePlus size={17} />
          </span>
          <div className="flex-1 leading-tight">
            <div className="text-[15px] font-semibold text-ink">New shipment</div>
            <div className="text-[11.5px] text-muted">Book a lane. The corridor draws itself on the 3D globe and the forwarder picks up the baton.</div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-900/5 hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {created ? (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid place-items-center px-6 py-12 text-center">
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="grid h-14 w-14 place-items-center rounded-full bg-emerald text-white shadow-[0_12px_28px_-10px_rgb(5_150_105/0.8)]"
              >
                <BadgeCheck size={26} />
              </motion.span>
              <div className="num mt-4 text-[18px] font-semibold text-ink">{created} booked</div>
              <div className="mt-1 max-w-[420px] text-[12.5px] text-muted">
                {lane.label} · {lane.carrier}. Pickup in {formatDuration(lane.leadH)}; ETA {lane.destination} {formatStamp(etaH, lane.destTz).slice(0, 16)} local.
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={onClose} className="h-10 rounded-xl px-4 text-[12.5px] font-semibold text-muted hover:bg-slate-900/5 hover:text-ink">
                  Done
                </button>
                <button
                  onClick={() => {
                    track(created);
                    onClose();
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cobalt px-4 text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-10px_rgb(37_99_235/0.8)] hover:brightness-110"
                >
                  Track on 3D Globe <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0 }} className="scroll-quiet overflow-y-auto px-5 py-4">
              <div className="eyebrow mb-2">1 · Lane</div>
              <div role="radiogroup" aria-label="Lane" className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                {LANES.map((l) => {
                  const active = l.id === laneId;
                  const Icon = l.mode === 'air' ? Plane : Ship;
                  return (
                    <button
                      key={l.id}
                      role="radio"
                      aria-checked={active}
                      onClick={() => pick(l)}
                      className="relative flex items-center gap-3 rounded-2xl bg-white p-3 text-left transition-shadow"
                      style={{ boxShadow: active ? 'inset 0 0 0 1.5px rgba(37,99,235,0.6), 0 8px 20px -14px rgba(37,99,235,0.6)' : 'inset 0 0 0 1px rgba(15,23,42,0.08)' }}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${l.mode === 'air' ? 'bg-sky/10 text-sky' : 'bg-cobalt/10 text-cobalt'}`}>
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">{l.label}</span>
                        <span className="block truncate text-[10.5px] text-muted">
                          {l.mode === 'air' ? 'Air' : 'Sea'} · {formatDuration(l.transitH)} · {l.carrier}
                        </span>
                      </span>
                      {active && (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-cobalt text-white">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="eyebrow mt-4 mb-2">2 · Cargo & parties</div>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <Field label="Cargo description" className="col-span-2 max-sm:col-span-1">
                  <input value={cargo} onChange={(e) => setCargo(e.target.value)} className={input} />
                </Field>
                <Field label="Gross weight (kg)">
                  <input type="number" min={50} max={40000} value={kg} onChange={(e) => setKg(Number(e.target.value))} className={`${input} num`} />
                </Field>
                <Field label="Invoice value (USD)">
                  <input type="number" min={1} value={value} onChange={(e) => setValue(Number(e.target.value))} className={`${input} num`} />
                </Field>
                <Field label="Exporter">
                  <input value={exporter} onChange={(e) => setExporter(e.target.value)} className={input} />
                </Field>
                <Field label="Freight forwarder">
                  <select value={forwarder} onChange={(e) => setForwarder(e.target.value)} className={input}>
                    {FORWARDERS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[#F7F9FC] p-3 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)] max-sm:grid-cols-1">
                <Summary label="Freight estimate" value={<CountUp value={freight} format={(n) => formatUsd(n)} duration={0.5} />} />
                <Summary label={`ETA ${lane.destination}`} value={formatStamp(etaH, lane.destTz).slice(0, 16)} />
                <Summary
                  label="Scope 3 CO₂e"
                  value={
                    <span className={lane.mode === 'air' ? 'text-amber' : 'text-emerald'}>
                      <Leaf size={12} className="mr-1 inline" />
                      <CountUp value={co2 * 1000} format={(n) => formatKg(n)} duration={0.5} />
                    </span>
                  }
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!created && (
          <div className="flex items-center justify-between gap-3 border-t border-[rgba(15,23,42,0.06)] bg-white/70 px-5 py-3">
            <span className="text-[11px] text-muted">{valid ? `Books ${Math.round(km).toLocaleString('en-US')} km on ${lane.route.label}.` : 'Enter a cargo description, a weight between 50 and 40,000 kg, and a value.'}</span>
            <button
              onClick={submit}
              disabled={!valid}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-cobalt px-4 text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-10px_rgb(37_99_235/0.8)] transition-all hover:brightness-110 active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
            >
              <PackagePlus size={14} /> Create & draw on globe
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

const input =
  'h-9 w-full rounded-xl bg-white px-3 text-[12.5px] text-ink shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)] outline-none focus:shadow-[inset_0_0_0_1.5px_rgb(37_99_235/0.6),0_0_0_4px_rgb(37_99_235/0.08)]';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10.5px] font-semibold tracking-[0.06em] text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold tracking-[0.1em] text-subtle uppercase">{label}</div>
      <div className="num mt-0.5 text-[13px] font-semibold text-ink">{value}</div>
    </div>
  );
}
