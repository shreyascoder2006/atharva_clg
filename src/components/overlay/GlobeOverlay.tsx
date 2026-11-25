import { Box, ChevronRight, Navigation } from 'lucide-react';

import { useAnchorRef } from '@/components/globe/anchors';
import { usePlaceSpecs, type LabelSpec } from '@/components/globe/placeSpecs';
import { RoleAvatar } from '@/components/hud/ui';
import { PORTS, ROLES, SHIPMENT, ULIP, type PortCongestion, type UlipConnector } from '@/data/shipment';
import { formatDuration, formatLatLonShort, formatStamp } from '@/lib/format';
import { portReading } from '@/lib/congestion';
import { PALETTE } from '@/lib/palette';
import { batonAt, cargoAt } from '@/lib/schedule';
import { useSchedule, useShipment, useViewHour } from '@/store/shipment';

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
  const nowH = useShipment((s) => s.nowH);
  const r = portReading(port, { customs, redSea }, nowH * 3600);
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
  const schedule = useSchedule();
  const h = useViewHour();
  const nowH = useShipment((s) => s.nowH);
  const startDive = useShipment((s) => s.startDive);
  const future = h > nowH + 1e-3;
  const past = h < nowH - 1e-3;

  const cargo = cargoAt(schedule, h);
  const baton = batonAt(schedule, h, nowH);
  const role = ROLES[baton.role];
  const alertOn = !!schedule.alert;
  const viaAir = schedule.legs.some((l) => l.mode === 'air');

  const nextStop =
    cargo.leg.group === 'origin' && cargo.phase !== 'port'
      ? { label: 'ETA JNPT Gate 4', h: schedule.arrivalJnptH }
      : cargo.phase === 'port'
        ? { label: 'Vessel departs', h: schedule.byId.atd.plannedH }
        : { label: viaAir ? 'ETA Schiphol' : 'ETA Rotterdam', h: schedule.ataH };

  const mode =
    cargo.phase === 'port' ? 'at terminal' : cargo.phase === 'hub' ? 'transhipment' : cargo.phase === 'delivered' ? 'delivered' : cargo.leg.mode;
  const live = alertOn ? PALETTE.crimson : PALETTE.cobalt;

  return (
    <div ref={ref} className="pin transition-opacity duration-300">
      <div className="pin-body relative">
        <svg className="pin-leader absolute -bottom-4 overflow-visible" width="20" height="16" aria-hidden>
          <path d="M1 15.5 L19 1" stroke="rgba(15,23,42,0.3)" strokeWidth="1" fill="none" />
        </svg>
        {/* Orbital distance: a compact pill that expands on hover. */}
        <div className="pin-compact glass-strong pointer-events-auto items-center gap-2 rounded-full py-1 pr-2.5 pl-1">
          <RoleAvatar role={baton.role} size={22} />
          <span className="num text-[11.5px] font-semibold text-ink">{SHIPMENT.container}</span>
          <span className="h-3 w-px bg-slate-900/10" />
          <span className="num text-[11px] font-semibold" style={{ color: live }}>
            {nextStop.h > h ? formatDuration(nextStop.h - h) : '—'}
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
              <span className="num text-[12.5px] font-semibold text-ink">{SHIPMENT.container}</span>
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
                {nextStop.h > h ? formatDuration(nextStop.h - h) : 'reached'}
              </div>
            </div>
            <div>
              <div className="eyebrow !text-[8.5px]">ETA Duisburg</div>
              <div className="num text-[13px] font-semibold text-ink">{formatStamp(schedule.deliveredH, 'Europe/Berlin').slice(0, 10)}</div>
            </div>
          </div>

          <div className="hairline mt-2.5 flex items-center justify-between border-t pt-2">
            <div className="num flex min-w-0 items-center gap-1 text-[9.5px] text-muted">
              <Navigation size={10} className="shrink-0 rotate-45" />
              <span className="truncate">{formatLatLonShort(cargo.lat, cargo.lon)}</span>
              <span className="text-subtle capitalize">· {mode}</span>
            </div>
            <button
              onClick={startDive}
              className="flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-semibold text-cobalt transition-colors hover:bg-cobalt/10"
              title="Open the 3D cargo twin"
            >
              <Box size={11} /> Twin <ChevronRight size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
