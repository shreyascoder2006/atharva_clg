import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import {
  CONTAINER,
  DISRUPTIONS,
  ESCROW,
  PLACES,
  ROLES,
  SEED_ACTUALS,
  SEED_FEED,
  SHIPMENT,
  ULIP,
  XRAY_FIX,
  XRAY_VALUES,
  type DisruptionKind,
  type MilestoneId,
  type Role,
  type UlipId,
} from '@/data/shipment';
import { ANCHOR_MS, formatDelta, formatStamp, formatUsd } from '@/lib/format';
import { sha256Hex } from '@/lib/hash';
import type { LatLon } from '@/lib/geo';
import type { Tone } from '@/lib/palette';
import {
  DEFAULT_INPUTS,
  buildSchedule,
  type CustomsState,
  type HighwayState,
  type RedSeaState,
  type Schedule,
  type ScheduleInputs,
} from '@/lib/schedule';

export type Lens = 'operations' | 'risk' | 'carbon' | 'ulip';
export type TwinState = 'closed' | 'diving' | 'open';
export type SonarTone = 'emerald' | 'crimson' | 'cobalt' | 'amber';

export interface Sonar {
  id: number;
  at: LatLon;
  tone: SonarTone;
  born: number;
}

export interface Toast {
  id: number;
  tone: Tone;
  title: string;
  body?: string;
  /** Present on ETA broadcasts: the roles that received it, lit up in order. */
  broadcast?: Role[];
}

export type FeedSource = Role | UlipId | 'ai';

export interface FeedItem {
  id: number;
  h: number;
  source: FeedSource;
  text: string;
  tone: Tone;
}

export interface UlipEvent {
  id: number;
  connector: UlipId;
  text: string;
  h: number;
  born: number;
}

export interface ActiveDisruption {
  kind: DisruptionKind;
  startedH: number;
  startedMs: number;
}

export interface ResolvedDisruption {
  kind: DisruptionKind;
  optionId: string;
  atH: number;
  accruedUsd: number;
  etaDeltaH: number;
}

interface Facts {
  actuals: Partial<Record<MilestoneId, number>>;
  docsVerified: boolean;
  eblHash: string | null;
  highway: HighwayState;
  highwayAtH: number | null;
  customs: CustomsState;
  customsAtH: number | null;
  redSea: RedSeaState;
  redSeaAtH: number | null;
  forcedArrivalH: number | null;
  driving: boolean;
  disruption: ActiveDisruption | null;
  resolved: ResolvedDisruption[];
  /** performance.now() when a leg's geometry last changed, for the draw-on reroute. */
  rerouteMs: Record<string, number>;
  feed: FeedItem[];
  ulipLog: UlipEvent[];
}

export interface ShipmentState extends Facts {
  role: Role;
  lens: Lens;
  nowH: number;
  /** Scrubber position; null follows LIVE. */
  viewH: number | null;
  /** Bumped to replay the camera flight for the current role. */
  flightNonce: number;

  sonars: Sonar[];
  toasts: Toast[];

  xrayOpen: boolean;
  twin: TwinState;
  /** Set on the first dive so the lazily loaded twin stays mounted for its exit animation. */
  twinLoaded: boolean;
  phoneOpen: boolean;
  panelOpen: boolean;

  setRole: (role: Role) => void;
  setLens: (lens: Lens) => void;
  tick: () => void;
  scrub: (h: number | null) => void;

  setXray: (open: boolean) => void;
  setPhone: (open: boolean) => void;
  togglePanel: () => void;
  startDive: () => void;
  finishDive: () => void;
  closeTwin: () => void;

  resolveDocs: () => Promise<void>;
  confirmGateIn: () => void;
  clearCustoms: () => void;
  submitVgm: () => void;
  issueEbl: () => void;
  presentLc: () => void;
  shareLink: () => void;

  triggerDisruption: (kind: DisruptionKind) => void;
  executeRecovery: (optionId: string) => void;

  pushSonar: (at: LatLon, tone: SonarTone) => void;
  pushToast: (t: Omit<Toast, 'id'>, ms?: number) => void;
  dismissToast: (id: number) => void;
  pushUlip: (connector: UlipId, text: string) => void;
  reset: () => void;
}

let seq = 1;
const nextId = () => seq++;
const liveHour = () => (Date.now() - ANCHOR_MS) / 3_600_000;

function seedFacts(): Facts {
  return {
    ...DEFAULT_INPUTS,
    actuals: { ...SEED_ACTUALS },
    eblHash: null,
    driving: false,
    disruption: null,
    resolved: [],
    rerouteMs: {},
    feed: SEED_FEED.map((f) => ({ ...f, id: nextId() })).reverse(),
    ulipLog: [],
  };
}

export function inputsOf(s: Pick<ShipmentState, keyof ScheduleInputs>): ScheduleInputs {
  return {
    nowH: s.nowH,
    actuals: s.actuals,
    docsVerified: s.docsVerified,
    highway: s.highway,
    highwayAtH: s.highwayAtH,
    customs: s.customs,
    customsAtH: s.customsAtH,
    redSea: s.redSea,
    redSeaAtH: s.redSeaAtH,
    forcedArrivalH: s.forcedArrivalH,
  };
}

/** The undisrupted plan with today's actuals: what every ETA delta is measured against. */
export function planOf(s: ScheduleInputs): Schedule {
  return buildSchedule({ ...s, highway: 'none', customs: 'none', redSea: 'none', highwayAtH: null, customsAtH: null, redSeaAtH: null });
}

const RECOVERY_STATE: Record<string, Partial<ScheduleInputs>> = {
  ai_reclass: { customs: 'ai_reclass' },
  cfs_roll: { customs: 'cfs_roll' },
  nh48: { highway: 'nh48' },
  rail: { highway: 'rail' },
  cape: { redSea: 'cape' },
  seaair: { redSea: 'seaair' },
};

const AT_KEY: Record<DisruptionKind, keyof ScheduleInputs> = {
  customs_hold: 'customsAtH',
  highway_delay: 'highwayAtH',
  red_sea: 'redSeaAtH',
};

/** Inputs as they would be if `optionId` were executed right now. */
export function inputsWithRecovery(s: ScheduleInputs, kind: DisruptionKind, optionId: string): ScheduleInputs {
  return { ...s, ...RECOVERY_STATE[optionId], [AT_KEY[kind]]: s.nowH };
}

/** Which legs' geometry a recovery redraws. */
const REROUTED_LEGS: Record<string, string[]> = {
  nh48: ['road'],
  rail: ['road', 'rail'],
  cape: ['sea'],
  seaair: ['sea', 'air', 'inland'],
  ai_reclass: [],
  cfs_roll: [],
};

const ALL_ROLES: Role[] = ['exporter', 'forwarder', 'broker', 'transporter'];

export const useShipment = create<ShipmentState>((set, get) => {
  const feed = (source: FeedSource, text: string, tone: Tone) =>
    set((s) => ({ feed: [{ id: nextId(), h: s.nowH, source, text, tone }, ...s.feed].slice(0, 40) }));

  const place = (id: keyof typeof PLACES) => PLACES[id].at;

  return {
    ...seedFacts(),
    role: 'exporter',
    lens: 'operations',
    nowH: liveHour(),
    viewH: null,
    flightNonce: 0,
    sonars: [],
    toasts: [],
    xrayOpen: false,
    twin: 'closed',
    twinLoaded: false,
    phoneOpen: false,
    panelOpen: typeof window === 'undefined' || window.innerWidth >= 1100,

    setRole: (role) => set((s) => ({ role, flightNonce: s.flightNonce + 1 })),
    setLens: (lens) => set({ lens }),
    tick: () => set({ nowH: liveHour() }),
    scrub: (h) => set({ viewH: h }),

    setXray: (xrayOpen) => set({ xrayOpen }),
    setPhone: (phoneOpen) => set({ phoneOpen }),
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    startDive: () => {
      if (get().twin !== 'closed') return;
      set({ twin: 'diving', twinLoaded: true, xrayOpen: false });
    },
    finishDive: () => {
      if (get().twin === 'diving') set({ twin: 'open' });
    },
    closeTwin: () => set((s) => ({ twin: 'closed', flightNonce: s.flightNonce + 1 })),

    pushSonar: (at, tone) => {
      const id = nextId();
      set((s) => ({ sonars: [...s.sonars, { id, at, tone, born: performance.now() }] }));
      setTimeout(() => set((s) => ({ sonars: s.sonars.filter((x) => x.id !== id) })), 3600);
    },

    pushToast: (t, ms = 5200) => {
      const id = nextId();
      set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }));
      setTimeout(() => get().dismissToast(id), ms);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    pushUlip: (connector, text) =>
      set((s) => ({
        ulipLog: [{ id: nextId(), connector, text, h: s.nowH, born: performance.now() }, ...s.ulipLog].slice(0, 14),
      })),

    // --- Documents ------------------------------------------------------------------
    resolveDocs: async () => {
      if (get().docsVerified) return;
      // Hash the reconciled e-BL exactly as it will be issued, so the stamp is a real
      // digest of real content rather than a decorative string.
      const doc = {
        type: 'e-BL',
        ref: 'KMOL-047W-0482',
        shipper: SHIPMENT.shipper,
        consignee: XRAY_VALUES.ebl.consignee,
        vessel: `${SHIPMENT.vessel} ${SHIPMENT.voyage}`,
        pol: 'INNSA',
        pod: 'NLRTM',
        container: CONTAINER,
        seal: SHIPMENT.seal,
        hs: XRAY_VALUES.ebl.hs,
        grossWeight: XRAY_FIX.to,
        reconciledWith: ['DPC/EXP/26-27/0482', 'PL-0482', 'VGM-JNPT-WB03-7741'],
      };
      const hash = await sha256Hex(JSON.stringify(doc));
      set({ docsVerified: true, eblHash: hash });
      get().pushSonar(place('jnpt'), 'emerald');
      feed('ai', `Commercial Invoice gross weight amended ${XRAY_FIX.from} → ${XRAY_FIX.to}`, 'emerald');
      feed('ai', `e-BL re-synced · sha256 ${hash.slice(0, 10)}…`, 'emerald');
      get().pushToast({
        tone: 'emerald',
        title: 'Documents re-synced · e-BL SHA-256 verified',
        body: 'All four key fields now match. Customs clearance is unlocked for the CHA.',
      });
    },

    // --- Milestone actions ---------------------------------------------------------
    confirmGateIn: () => {
      const s = get();
      if (s.actuals.gateIn !== undefined || s.driving) return;
      // Arrival is pinned a moment in the past so the box is at the gate on this very
      // tick; the marker's smoothing turns the jump into a visible drive.
      set({ forcedArrivalH: s.nowH - 1e-3, driving: true });
      get().pushUlip('fastag', 'Toll read · Khalapur plaza · MH12 TX 4471');
      setTimeout(() => {
        const t = get().nowH;
        set((st) => ({ driving: false, actuals: { ...st.actuals, gateIn: t } }));
        get().pushSonar(place('jnpt'), 'emerald');
        get().pushUlip('portgate', 'OCR gate-in · Gate 4 · OSPU 482190 8 · photo geo-tagged');
        feed('transporter', 'Gate-in confirmed by driver · photo geo-tagged 18.9496°N 72.9511°E', 'emerald');
        feed('transporter', `Escrow released · ${ESCROW[0].amount} → ${ESCROW[0].party}`, 'emerald');
        get().pushToast({
          tone: 'emerald',
          title: 'Gate-in confirmed at JNPT',
          body: `Baton passed to ${ROLES.broker.label}. ${ESCROW[0].amount} released to ${ESCROW[0].party}.`,
        });
      }, 2600);
    },

    clearCustoms: () => {
      const s = get();
      if (s.actuals.leo !== undefined || s.actuals.gateIn === undefined) return;
      if (!s.docsVerified || s.customs === 'active') return;
      set((st) => ({ actuals: { ...st.actuals, leo: st.nowH } }));
      get().pushSonar(place('jnpt'), 'emerald');
      get().pushUlip('icegate', `LEO granted · ${SHIPMENT.shippingBill} · out of charge`);
      feed('broker', `Let Export Order granted on ${SHIPMENT.shippingBill}`, 'emerald');
      get().pushToast({
        tone: 'emerald',
        title: 'Customs cleared · Let Export Order',
        body: `Baton passed to ${ROLES.forwarder.label}. ${ESCROW[1].amount} released to ${ESCROW[1].party}.`,
      });
    },

    submitVgm: () => {
      const s = get();
      if (s.actuals.vgm !== undefined || s.actuals.gateIn === undefined) return;
      set((st) => ({ actuals: { ...st.actuals, vgm: st.nowH } }));
      get().pushUlip('portgate', 'VGM 12,846 kg accepted · WB-03 · SOLAS VI/2');
      feed('forwarder', 'VGM 12,846 kg submitted to terminal (SOLAS VI/2)', 'cobalt');
      get().pushToast({ tone: 'cobalt', title: 'VGM submitted', body: 'Weighbridge WB-03 · 12,846 kg · within tolerance.' });
    },

    issueEbl: () => {
      const s = get();
      if (s.actuals.ebl !== undefined || s.actuals.leo === undefined || !s.docsVerified) return;
      set((st) => ({ actuals: { ...st.actuals, ebl: st.nowH } }));
      get().pushSonar(place('jnpt'), 'cobalt');
      feed('forwarder', `e-BL KMOL-047W-0482 issued · hash anchored ${s.eblHash?.slice(0, 10)}…`, 'emerald');
      get().pushToast({
        tone: 'emerald',
        title: 'e-BL issued & anchored',
        body: `Title transferred digitally. Baton passed to ${ROLES.exporter.label} for LC drawdown.`,
      });
    },

    presentLc: () => {
      const s = get();
      if (s.actuals.lc !== undefined || s.actuals.ebl === undefined) return;
      set((st) => ({ actuals: { ...st.actuals, lc: st.nowH } }));
      get().pushSonar(place('chakan'), 'emerald');
      feed('exporter', `LC proceeds ${ESCROW[3].amount} credited against e-BL presentation`, 'emerald');
      get().pushToast({ tone: 'emerald', title: 'LC proceeds released', body: `${ESCROW[3].amount} credited to Deccan Precision.` });
    },

    shareLink: () =>
      get().pushToast({
        tone: 'cobalt',
        title: 'Live tracking link shared',
        body: 'Buyer receives a read-only lens of the shipment. No login needed.',
      }),

    // --- Disruptions -----------------------------------------------------------------
    triggerDisruption: (kind) => {
      const s = get();
      if (s.disruption) return;
      if (kind === 'highway_delay' && (s.highway !== 'none' || s.actuals.gateIn !== undefined || s.driving)) return;
      if (kind === 'customs_hold' && (s.customs !== 'none' || s.actuals.leo !== undefined)) return;
      if (kind === 'red_sea' && s.redSea !== 'none') return;

      const def = DISRUPTIONS[kind];
      const patch: Partial<ShipmentState> = {
        disruption: { kind, startedH: s.nowH, startedMs: performance.now() },
      };
      if (kind === 'highway_delay') Object.assign(patch, { highway: 'active', highwayAtH: s.nowH });
      if (kind === 'customs_hold') Object.assign(patch, { customs: 'active', customsAtH: s.nowH });
      if (kind === 'red_sea') Object.assign(patch, { redSea: 'active', redSeaAtH: s.nowH });
      set(patch);

      get().pushSonar(place(def.place), 'crimson');
      if (kind === 'highway_delay') get().pushUlip('fastag', 'FASTag gap · Khalapur plaza · 42 min no read');
      if (kind === 'customs_hold') get().pushUlip('icegate', 'RMS: examination order · HS query on SB 4471823');
      feed(kind === 'customs_hold' ? 'icegate' : kind === 'highway_delay' ? 'fastag' : 'forwarder', `${def.title} · ${def.where}`, 'crimson');
      get().pushToast({ tone: 'crimson', title: def.title, body: def.where }, 4200);
    },

    executeRecovery: (optionId) => {
      const s = get();
      const d = s.disruption;
      if (!d) return;
      const def = DISRUPTIONS[d.kind];
      const option = def.options.find((o) => o.id === optionId);
      if (!option) return;

      const before = inputsOf(s);
      const next = inputsWithRecovery(before, d.kind, optionId);
      const plan = planOf(before);
      const after = buildSchedule(next);
      const etaDeltaH = after.deliveredH - plan.deliveredH;
      const elapsedS = (performance.now() - d.startedMs) / 1000;
      const accrued = demurrageUsd(def.ratePerDay, elapsedS);
      const now = performance.now();

      set((st) => ({
        ...RECOVERY_STATE[optionId],
        [AT_KEY[d.kind]]: st.nowH,
        disruption: null,
        resolved: [...st.resolved, { kind: d.kind, optionId, atH: st.nowH, accruedUsd: accrued, etaDeltaH }],
        rerouteMs: {
          ...st.rerouteMs,
          ...Object.fromEntries((REROUTED_LEGS[optionId] ?? []).map((l) => [l, now])),
        },
      }));

      get().pushSonar(place(def.place), 'emerald');
      feed('ai', `Recovery executed · ${option.title}`, 'emerald');
      feed('ai', `New ETA Duisburg ${formatStamp(after.deliveredH, 'Europe/Berlin')} CET (${formatDelta(etaDeltaH)})`, 'cobalt');
      get().pushToast(
        {
          tone: 'cobalt',
          title: `New ETA broadcast · ${formatStamp(after.deliveredH, 'Europe/Berlin')} CET`,
          body: `${option.title} · ${formatDelta(etaDeltaH)} vs plan · ${formatUsd(option.costUsd)} · exposure capped at ${formatUsd(accrued)}`,
          broadcast: ALL_ROLES,
        },
        7600,
      );
    },

    reset: () => {
      set((s) => ({
        ...seedFacts(),
        viewH: null,
        xrayOpen: false,
        twin: 'closed',
        phoneOpen: false,
        sonars: [],
        toasts: [],
        flightNonce: s.flightNonce + 1,
      }));
      get().pushToast({ tone: 'slate', title: 'Demo reset', body: 'Shipment restored to its seeded state.' }, 2600);
    },
  };
});

/**
 * Demurrage accrues on an accelerated demo clock so the counter visibly moves:
 * one real second is one simulated hour.
 */
export const DEMO_HOURS_PER_SECOND = 1;
export function demurrageUsd(ratePerDay: number, elapsedSeconds: number): number {
  return (ratePerDay / 24) * elapsedSeconds * DEMO_HOURS_PER_SECOND;
}

// --- Derived hooks -----------------------------------------------------------------

/**
 * The schedule facts, without the ticking clock. nowH only matters to a reroute's
 * snap point, and that is pinned by the *AtH fields once a disruption exists, so
 * leaving it out keeps components from rebuilding the schedule every second.
 */
const pickFacts = (s: ShipmentState) => {
  const { nowH: _nowH, ...facts } = inputsOf(s);
  return facts;
};

/** Schedule for React components. Rebuilds only when a schedule fact changes. */
export function useSchedule(): Schedule {
  const facts = useShipment(useShallow(pickFacts));
  return useMemo(() => buildSchedule({ ...facts, nowH: useShipment.getState().nowH }), [facts]);
}

/** The undisrupted plan: what every ETA and CO2 delta in the HUD is measured against. */
export function usePlan(): Schedule {
  const facts = useShipment(useShallow(pickFacts));
  return useMemo(() => planOf({ ...facts, nowH: useShipment.getState().nowH }), [facts]);
}

let cached: { key: unknown[]; schedule: Schedule } | null = null;

/** Schedule for the frame loop, without subscribing a component. */
export function getSchedule(): Schedule {
  const s = useShipment.getState();
  const key = [s.actuals, s.docsVerified, s.highway, s.highwayAtH, s.customs, s.customsAtH, s.redSea, s.redSeaAtH, s.forcedArrivalH];
  if (!cached || cached.key.some((k, i) => k !== key[i])) {
    cached = { key, schedule: buildSchedule(inputsOf(s)) };
  }
  return cached.schedule;
}

/** The hour every view is showing: the scrubber's, or LIVE. */
export function useViewHour(): number {
  return useShipment((s) => s.viewH ?? s.nowH);
}

export const viewHourOf = (s: ShipmentState) => s.viewH ?? s.nowH;

export const ULIP_BY_ID = Object.fromEntries(ULIP.map((u) => [u.id, u])) as Record<UlipId, (typeof ULIP)[number]>;

// Dev-only handle for the smoke test and for poking at state from the console.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __shipment: typeof useShipment }).__shipment = useShipment;
}
