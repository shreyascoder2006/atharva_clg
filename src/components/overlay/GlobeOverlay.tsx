import { Box, ChevronRight, Navigation } from 'lucide-react';

import { useAnchorRef } from '@/components/globe/anchors';
import { usePlaceSpecs, type LabelSpec } from '@/components/globe/placeSpecs';
import { DIORAMAS, type DioramaLabel } from '@/components/globe/dioramaData';
import { CountUp, RoleAvatar } from '@/components/hud/ui';
import { FLEET } from '@/data/fleet';
import { PORTS, ROLES, ULIP, type PortCongestion, type UlipConnector } from '@/data/shipment';
import { formatDuration, formatLatLonShort, formatStamp } from '@/lib/format';
import { portReading } from '@/lib/congestion';
import { PALETTE } from '@/lib/palette';
import { batonAt, cargoAt } from '@/lib/schedule';
import { useSelectedSchedule, useShipment, useViewHour } from '@/store/shipment';

/**
 * DOM layer for everything pinned to the globe. Positions and fades are written by
 * AnchorProjector inside the Canvas; this tree only owns content.
 */
export function GlobeOverlay() {
  const specs = usePlaceSpecs();
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden={false}>
      {specs.map((s) => (
        <PlaceTag key={s.id} spec={s} />
      ))}
      {PORTS.map((p) => (
        <PortTag key={p.id} port={p} />
      ))}
      {ULIP.map((c) => (
        <UlipTag key={c.id} c={c} />
      ))}
      <HubTag />
      {DIORAMAS.flatMap((d) => d.labels.map((l, i) => <DioramaTag key={`${d.id}:${i}`} id={`dio:${d.id}:${i}`} label={l} />))}
      <TelemetryPin />
    </div>
  );
}

function PlaceTag({ spec }: { spec: LabelSpec }) {
  const ref = useAnchorRef(`place:${spec.id}`);
  const left = spec.align === 'left';
  const below = spec.align === 'below';
  return (
    <div ref={ref} className="transition-opacity duration-300">
      <div
        className={`flex items-center gap-1.5 whitespace-nowrap ${left ? 'flex-row-reverse' : below ? 'flex-col' : ''}`}
        style={{ transform: below ? 'translate(-50%, -3px)' : `translate(${left ? 'calc(-100% + 3px)' : '-3px'}, -50%)` }}
      >
        <span className="h-[6px] w-[6px] shrink-0 rounded-full border-[1.5px] border-white bg-ink/75 shadow-[0_1px_3px_rgb(15_23_42/0.3)]" />
        <span
          className={`rounded-md px-1.5 text-[10.5px] leading-[18px] ${spec.strong ? 'font-semibold text-ink' : 'font-medium text-muted'}`}
          style={{ background: 'rgb(255 255 255 / 0.66)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          {spec.place.name}
          {spec.place.code && <span className="num ml-1 text-[9px] text-subtle">{spec.place.code}</span>}
        </span>
      </div>
    </div>
  );
}

function PortTag({ port }: { port: PortCongestion }) {
  const ref = useAnchorRef(`port:${port.id}`);
  const customs = useShipment((s) => s.customs);
  const redSea = useShipment((s) => s.redSea);
  const hold0494 = useShipment((s) => s.hold0494);
  const nowH = useShipment((s) => s.nowH);
  const r = portReading(port, { customs, redSea, hold0494 }, nowH * 3600);
  const hex = r.tone === 'crimson' ? PALETTE.crimson : r.tone === 'amber' ? PALETTE.amber : PALETTE.emerald;
  return (
    <div ref={ref} className="transition-opacity duration-300">
      <div className="glass -translate-x-1/2 -translate-y-full rounded-xl px-2.5 py-1.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex }} />
          <span className="text-[11px] font-semibold text-ink">{port.name}</span>
          <span className="num text-[9px] text-subtle">{port.code}</span>
        </div>
        <div className="num mt-0.5 text-[10px] font-medium" style={{ color: hex }}>
          {r.dwell.toFixed(1)}d dwell · {Math.round(r.util * 100)}% yard
        </div>
      </div>
    </div>
  );
}

// The four connectors sit within ~100 km of each other, so their tags fan out to the
// four quadrants rather than stacking on the port.
const ULIP_OFFSET: Record<string, string> = {
  fastag: 'translate(26px, -190%)',
  icegate: 'translate(calc(-100% - 26px), -230%)',
  vahan: 'translate(26px, 90%)',
  portgate: 'translate(calc(-100% - 26px), 120%)',
};

function UlipTag({ c }: { c: UlipConnector }) {
  const ref = useAnchorRef(`ulip:${c.id}`);
  const latest = useShipment((s) => s.ulipLog.find((e) => e.connector === c.id));
  const nowH = useShipment((s) => s.nowH);
  const fresh = !!latest && (nowH - latest.h) * 3600 < 3;
  return (
    <div ref={ref} className="transition-opacity duration-300">
      <div
        className="glass flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-1.5 whitespace-nowrap transition-shadow"
        style={{ transform: ULIP_OFFSET[c.id], boxShadow: fresh ? `0 0 0 2px ${PALETTE.sky}55, var(--shadow-glass)` : undefined }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky" />
        </span>
        <span className="text-[10.5px] font-semibold text-ink">{c.name}</span>
        <span className="num text-[9px] text-subtle">{c.latencyMs}ms</span>
      </div>
    </div>
  );
}

/** Micro-labels on the port dioramas; only present below the close-zoom threshold. */
function DioramaTag({ id, label }: { id: string; label: DioramaLabel }) {
  const ref = useAnchorRef(id);
  const hold = useShipment((s) => s.hold0494);
  const tone = label.tone === 'crimson' && hold !== 'active' ? 'emerald' : label.tone;
  const hex = tone === 'crimson' ? PALETTE.crimson : tone === 'amber' ? PALETTE.amber : tone === 'emerald' ? PALETTE.emerald : PALETTE.cobalt;
  return (
    <div ref={ref} className="transition-opacity duration-300">
      <div className="flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <div
          className="flex items-center gap-1 rounded-md border border-white/70 px-1.5 py-[1px] whitespace-nowrap shadow-[0_2px_8px_rgb(15_23_42/0.12)]"
          style={{ background: 'rgb(255 255 255 / 0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex }} />
          <span className="num text-[9.5px] font-semibold tracking-tight text-ink">{label.text}</span>
        </div>
        <span className="h-3 w-px bg-ink/30" />
      </div>
    </div>
  );
}

function HubTag() {
  const ref = useAnchorRef('hub');
  return (
    <div ref={ref} className="transition-opacity duration-300">
      <div className="glass-strong -translate-x-1/2 -translate-y-[calc(100%+18px)] rounded-full px-2.5 py-1 text-[10.5px] font-semibold whitespace-nowrap text-ink">
        One Platform <span className="num font-medium text-cobalt">· ULIP gateway</span>
      </div>
    </div>
  );
}

/** The frosted telemetry pin riding on the live cargo position. */
function TelemetryPin() {
  // Flip to the marker's left when the card would slide under the workspace panel.
  const panelOpen = useShipment((s) => s.panelOpen);
  const ref = useAnchorRef('cargo', panelOpen ? 700 : 300, 1.9);
  const id = useShipment((s) => s.selected);
  const def = FLEET[id];
  const schedule = useSelectedSchedule();
  const h = useViewHour();
  const nowH = useShipment((s) => s.nowH);
  const startDive = useShipment((s) => s.startDive);
  const future = h > nowH + 1e-3;
  const past = h < nowH - 1e-3;

  const cargo = cargoAt(schedule, h);
  const baton = batonAt(schedule, h, nowH);
  const role = ROLES[baton.role];
  const alertOn = !!schedule.alert;
  const viaAir = id === 'SHP-2611-0482' && schedule.legs.some((l) => l.mode === 'air');

  // The next stop, by stage of the journey: gate-in, departure, arrival, delivery.
  const stops = [
    { label: def.stops.gateIn, h: schedule.gateInH },
    { label: def.stops.atd, h: schedule.byId.atd.plannedH },
    { label: viaAir ? 'ETA Schiphol' : def.stops.ata, h: schedule.ataH },
    { label: def.stops.delivered, h: schedule.deliveredH },
  ];
  const nextStop = stops.find((x) => x.h > h + 1e-3) ?? stops[stops.length - 1];

  const mode =
    cargo.phase === 'port' ? 'at terminal' : cargo.phase === 'hub' ? 'transhipment' : cargo.phase === 'delivered' ? 'delivered' : cargo.leg.mode;
  const live = alertOn ? PALETTE.crimson : PALETTE.cobalt;

  return (
    <div ref={ref} className="pin transition-opacity duration-300">
      <div className="pin-body relative">
        <svg className="pin-leader absolute -bottom-4 overflow-visible" width="20" height="16" aria-hidden>
          <path d="M1 15.5 L19 1" stroke="rgba(15,23,42,0.55)" strokeWidth="1" fill="none" shapeRendering="geometricPrecision" />
          <circle cx="19" cy="1" r="1.6" fill="white" stroke="rgba(15,23,42,0.45)" strokeWidth="1" />
          <circle cx="1" cy="15.5" r="2.4" fill={live} stroke="white" strokeWidth="1.2" />
        </svg>
        {/* Orbital distance: a compact pill that expands on hover. */}
        <div className="pin-compact glass-strong pointer-events-auto items-center gap-2 rounded-full py-1 pr-2.5 pl-1">
          <RoleAvatar role={baton.role} size={22} />
          <span className="num text-[11.5px] font-semibold text-ink">{def.unit.ref}</span>
          <span className="h-3 w-px bg-slate-900/10" />
          <span className="num text-[11px] font-semibold" style={{ color: live }}>
            {nextStop.h > h ? <CountUp value={nextStop.h - h} format={formatDuration} duration={0.6} /> : '—'}
          </span>
          <span className="text-[10px] text-muted">{nextStop.label.replace('ETA ', '→ ')}</span>
        </div>
        <div className="pin-full glass-strong pointer-events-auto w-[252px] rounded-2xl p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: live }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: live }} />
              </span>
              <span className="num text-[12.5px] font-semibold text-ink">{def.unit.ref}</span>
            </div>
            <span
              className="num rounded-full px-1.5 py-px text-[9px] font-semibold tracking-wider"
              style={{
                color: future ? PALETTE.cobalt : past ? PALETTE.muted : PALETTE.emerald,
                background: future ? 'rgb(37 99 235 / 0.08)' : past ? 'rgb(71 85 105 / 0.08)' : 'rgb(5 150 105 / 0.1)',
              }}
            >
              {future ? 'FORECAST' : past ? 'REPLAY' : 'LIVE'}
            </span>
          </div>

          <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-slate-900/[0.035] px-2 py-1.5">
            <RoleAvatar role={baton.role} size={24} />
            <div className="min-w-0 leading-tight">
              <div className="eyebrow !text-[8.5px]">{baton.projected ? 'Projected baton' : 'Baton holder'}</div>
              <div className="truncate text-[11.5px] font-semibold text-ink">{role.label}</div>
              <div className="truncate text-[10.5px] text-muted">{baton.task}</div>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div>
              <div className="eyebrow !text-[8.5px]">{nextStop.label}</div>
              <div className="num text-[13px] font-semibold text-ink">
                {nextStop.h > h ? <CountUp value={nextStop.h - h} format={formatDuration} duration={0.6} /> : 'reached'}
              </div>
            </div>
            <div>
              <div className="eyebrow !text-[8.5px]">ETA {def.destination}</div>
              <div className="num text-[13px] font-semibold text-ink">{formatStamp(schedule.deliveredH, def.destTz).slice(0, 10)}</div>
            </div>
          </div>

          <div className="hairline mt-2.5 flex items-center justify-between border-t pt-2">
            <div className="num flex min-w-0 items-center gap-1 text-[9.5px] text-muted">
              <Navigation size={10} className="shrink-0 rotate-45" />
              <span className="truncate">{formatLatLonShort(cargo.lat, cargo.lon)}</span>
              <span className="text-subtle capitalize">· {mode}</span>
            </div>
            {def.twin && (
              <button
                onClick={startDive}
                className="flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-semibold text-cobalt transition-colors hover:bg-cobalt/10"
                title="Open the 3D cargo twin"
              >
                <Box size={11} /> Twin <ChevronRight size={10} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
