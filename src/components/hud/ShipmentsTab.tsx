import { motion } from 'motion/react';
import { Plane, Ship, TrainFront, Truck } from 'lucide-react';

import { AMBIENT_ROUTES, FLEET, MODE_LABEL } from '@/data/fleet';
import { SHIPMENT_IDS, type Mode, type ShipmentId } from '@/data/shipment';
import { formatStamp } from '@/lib/format';
import { PALETTE, TONE_HEX } from '@/lib/palette';
import { cargoAt } from '@/lib/schedule';
import { usePlanFor, useScheduleFor, useShipment, useViewHour } from '@/store/shipment';
import { useShipmentStatus } from './shipmentStatus';
import { Chip, Dot, Eyebrow } from './ui';

const MODE_ICON: Record<Mode, typeof Ship> = { road: Truck, rail: TrainFront, sea: Ship, air: Plane };

function Row({ id }: { id: ShipmentId }) {
  const def = FLEET[id];
  const schedule = useScheduleFor(id);
  const plan = usePlanFor(id);
  const status = useShipmentStatus(id, schedule, plan);
  const selected = useShipment((s) => s.selected === id);
  const select = useShipment((s) => s.selectShipment);
  const h = useViewHour();
  const progress = Math.min(1, cargoAt(schedule, h).s / schedule.totalKm);

  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={() => select(id)}
      className="relative block w-full rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/80"
      title={`${id} · ${def.origin} → ${def.destination}`}
    >
      {selected && (
        <motion.span
          layoutId="shipment-row"
          className="absolute inset-0 rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.06),0_8px_20px_-10px_rgb(37_99_235/0.35),inset_0_0_0_1.5px_rgb(37_99_235/0.55)]"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative block">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-muted">
            {def.modes.map((m) => {
              const Icon = MODE_ICON[m];
              return <Icon key={m} size={12} aria-label={MODE_LABEL[m]} />;
            })}
          </span>
          <span className="num text-[12px] font-semibold text-ink">{id}</span>
          <span className="ml-auto">
            <Chip tone={status.tone}>
              <Dot tone={status.tone} pulse={status.alert} size={5} />
              {status.label}
            </Chip>
          </span>
        </span>
        <span className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-[11.5px] font-medium text-ink">
            {def.origin} → {def.destination}
          </span>
          <span className="num shrink-0 text-[10px] text-muted">ETA {formatStamp(schedule.deliveredH, def.destTz).slice(4, 10)}</span>
        </span>
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-900/[0.06]">
          <motion.span
            className="block h-full rounded-full"
            style={{ background: status.tone === 'crimson' ? PALETTE.crimson : PALETTE.emerald }}
            animate={{ width: `${Math.max(2, progress * 100)}%` }}
            transition={{ duration: 0.4 }}
          />
        </span>
      </span>
    </button>
  );
}

/** Left-sidebar list of the three live shipments, plus the ambient network corridors. */
export function ShipmentsTab() {
  const showNetwork = useShipment((s) => s.showNetwork);
  const toggle = useShipment((s) => s.toggleNetwork);
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Shipments" className="-mx-1.5 space-y-0.5">
        {SHIPMENT_IDS.map((id) => (
          <Row key={id} id={id} />
        ))}
      </div>
      <div className="hairline border-t pt-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <Eyebrow>Network corridors</Eyebrow>
          <button
            role="switch"
            aria-checked={showNetwork}
            aria-label="Show network corridors"
            onClick={toggle}
            className="relative h-[18px] w-8 rounded-full transition-colors"
            style={{ background: showNetwork ? TONE_HEX.cobalt : '#CBD5E1' }}
          >
            <motion.span
              className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow"
              animate={{ left: showNetwork ? 16 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            />
          </button>
        </div>
        <ul className="space-y-1">
          {AMBIENT_ROUTES.map((r) => (
            <li key={r.routeId} className={`flex items-center gap-2 text-[11px] transition-opacity ${showNetwork ? 'text-muted' : 'text-subtle opacity-60'}`}>
              <span className="h-[3px] w-4 shrink-0 rounded-full bg-[#4F6FA8]/50" />
              <span className="truncate">{r.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10.5px] leading-snug text-subtle">Click any shipment's route on the globe to select it.</p>
      </div>
    </div>
  );
}
