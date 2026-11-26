import { useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { CHANNEL_BY_ID, CHANNEL_FOR, CHANNELS, SEED_MESSAGES, type Author, type ChannelId, type ChatMessage, type MsgChip } from '@/data/comms';
import { FLEET, type Party } from '@/data/fleet';
import { PARTNERS, type PartnerId } from '@/data/partners';
import { WATCH_BY_ID } from '@/data/portfolio';
import {
  CONTAINER,
  DISRUPTIONS,
  FLAGSHIP,
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
  type ShipmentId,
  type UlipId,
} from '@/data/shipment';
import { buildAirSchedule, buildSuratSchedule, type HoldState } from '@/lib/fleet';
import { ANCHOR_MS, formatDelta, formatStamp, formatUsd } from '@/lib/format';
import { sha256Hex } from '@/lib/hash';
import type { LatLon } from '@/lib/geo';
import { viewFromPath, type ViewId } from '@/lib/routes';
import type { Tone } from '@/lib/palette';
import {
  DEFAULT_INPUTS,
  batonAt,
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
  /** SHP-2611-0494's RMS examination at Mundra. */
  hold0494: HoldState;
  hold0494AtH: number | null;
  /** Forwarder chosen in the partner marketplace, per shipment. Absent: the incumbent. */
  assignments: Partial<Record<ShipmentId, PartnerId>>;
  messages: ChatMessage[];
  /** Highest message id each channel has been read up to. */
  readUpTo: Record<ChannelId, number>;
  /** Someone composing a reply, for the typing indicator. */
  typing: { channel: ChannelId; author: Author; shipment: ShipmentId | null } | null;
}

/** Camera target for a watch-list shipment, which rides an ambient corridor. */
export interface CorridorFocus {
  shipmentId: string;
  routeId: string;
  cam: LatLon;
  camR: number;
  nonce: number;
}

export type SidebarTab = 'shipments' | 'lens';

export interface ShipmentState extends Facts {
  /** The workspace in the main viewport. The globe stays mounted behind the others. */
  view: ViewId;
  navCollapsed: boolean;
  /** Open channel in the comms hub. */
  channel: ChannelId;
  /** Set when a watch-list shipment is tracked; cleared by any primary selection. */
  focus: CorridorFocus | null;
  /** The shipment the HUD and camera follow. */
  selected: ShipmentId;
  sidebarTab: SidebarTab;
  /** The Shipments / lens card on the Control Tower, folded down to its tab strip when false. */
  sidebarOpen: boolean;
  /** Ambient network corridors on the globe. */
  showNetwork: boolean;
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

  setView: (view: ViewId) => void;
  toggleNav: () => void;
  /** Select a shipment (or focus a watch-list corridor) and fly there on the globe. */
  trackShipment: (id: string) => void;
  assignPartner: (partner: PartnerId) => void;
  setChannel: (channel: ChannelId) => void;
  markRead: (channel: ChannelId) => void;
  postMessage: (text: string) => void;
  /** Flag the open channel's shipment to whoever holds its baton, with a response SLA. */
  escalate: () => void;

  selectShipment: (id: ShipmentId) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  toggleSidebarCard: () => void;
  toggleNetwork: () => void;
  resolveHold0494: () => void;
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

/**
 * Seeded threads start read, except the newest message in two channels, so the
 * Comms badge has something to say on first load.
 */
function seedComms(): Pick<Facts, 'messages' | 'readUpTo' | 'typing'> {
  const messages = SEED_MESSAGES.map((m) => ({ ...m, id: nextId() }));
  const readUpTo = Object.fromEntries(
    CHANNELS.map((c) => {
      const ids = messages.filter((m) => m.channel === c.id).map((m) => m.id);
      const unread = c.id === 'shp-0482' || c.id === 'customs' ? 1 : 0;
      return [c.id, ids.length > unread ? ids[ids.length - 1 - unread] : 0];
    }),
  ) as Record<ChannelId, number>;
  return { messages, readUpTo, typing: null };
}

function initialView(): ViewId {
  return typeof window === 'undefined' ? 'tower' : viewFromPath(window.location.pathname);
}

const NAV_KEY = 'osp.nav.collapsed';
function initialNavCollapsed(): boolean {
  try {
    const v = localStorage.getItem(NAV_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** The party playing `role` on a shipment, after any marketplace reassignment. */
export function partyOf(assignments: Facts['assignments'], id: ShipmentId, role: Role): Party {
  const pid = role === 'forwarder' ? assignments[id] : undefined;
  if (!pid) return FLEET[id].parties[role];
  const p = PARTNERS[pid];
  return { org: p.name, person: p.contact.person, title: p.contact.title, initials: initialsOf(p.contact.person) };
}

/** Escrow payee label, after any marketplace reassignment. */
export function payeeOf(assignments: Facts['assignments'], id: ShipmentId, line: { id: Role; party: string }): string {
  const pid = line.id === 'forwarder' ? assignments[id] : undefined;
  return pid ? PARTNERS[pid].short : line.party;
}

/** Unread messages from other people across all channels. */
export function unreadCount(s: Pick<Facts, 'messages' | 'readUpTo'>, channel?: ChannelId): number {
  let n = 0;
  for (const m of s.messages) if (!m.mine && (!channel || m.channel === channel) && m.id > s.readUpTo[m.channel]) n++;
  return n;
}

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
    hold0494: 'active',
    hold0494AtH: null,
    assignments: {},
    ...seedComms(),
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

  /** Post into a comms channel. Shipment defaults to the channel's own. */
  const say = (channel: ChannelId, author: Author, text: string, opts: { chips?: MsgChip[]; via?: 'driver-app'; shipment?: ShipmentId } = {}) =>
    set((s) => {
      const msg: ChatMessage = {
        id: nextId(),
        channel,
        author,
        shipment: opts.shipment ?? CHANNEL_BY_ID[channel].shipment,
        text,
        h: s.nowH,
        chips: opts.chips,
        via: opts.via,
      };
      // Reading the channel right now counts as having read the new message.
      const reading = s.view === 'comms' && s.channel === channel && typeof document !== 'undefined' && !document.hidden;
      return {
        messages: [...s.messages, msg].slice(-240),
        readUpTo: reading ? { ...s.readUpTo, [channel]: msg.id } : s.readUpTo,
      };
    });

  return {
    ...seedFacts(),
    view: initialView(),
    navCollapsed: initialNavCollapsed(),
    focus: null,
    channel: 'shp-0482',
    selected: FLAGSHIP,
    sidebarTab: 'shipments',
    sidebarOpen: true,
    showNetwork: true,
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

    setView: (view) => {
      if (get().view === view) return;
      set({ view, xrayOpen: false, phoneOpen: view === 'tower' ? get().phoneOpen : false });
    },
    toggleNav: () => {
      const navCollapsed = !get().navCollapsed;
      try {
        localStorage.setItem(NAV_KEY, navCollapsed ? '1' : '0');
      } catch {
        /* private mode: the choice just isn't remembered */
      }
      set({ navCollapsed });
    },
    trackShipment: (id) => {
      const s = get();
      if (s.twin !== 'closed') return;
      if (id in FLEET) {
        set((st) => ({ view: 'tower', selected: id as ShipmentId, focus: null, flightNonce: st.flightNonce + 1 }));
        return;
      }
      const w = WATCH_BY_ID[id];
      if (!w) return;
      set((st) => ({
        view: 'tower',
        showNetwork: true,
        focus: { shipmentId: id, routeId: w.routeId, cam: w.focus.cam, camR: w.focus.camR, nonce: (st.focus?.nonce ?? 0) + 1 },
      }));
      get().pushToast(
        { tone: 'slate', title: `Tracking ${id} · ${w.origin} → ${w.destination}`, body: `${w.carrier} · read-only carrier feed on the ${w.origin} corridor.` },
        4200,
      );
    },
    assignPartner: (pid) => {
      const s = get();
      const id = s.selected;
      if (s.assignments[id] === pid) return;
      const p = PARTNERS[pid];
      const prev = partyOf(s.assignments, id, 'forwarder').org;
      set({ assignments: { ...s.assignments, [id]: pid } });
      feed('forwarder', `${id} · forwarder reassigned ${prev} → ${p.name}`, 'emerald');
      say(CHANNEL_FOR[id], 'system', `${p.name} is now the freight forwarder on ${id}, taking over from ${prev}. ${p.contact.person} joined the channel.`, {
        chips: [{ kind: 'milestone', label: 'Partner assigned', tone: 'emerald' }, { kind: 'escrow', label: 'Escrow payee updated', tone: 'cobalt' }],
      });
      get().pushToast({
        tone: 'emerald',
        title: `${p.name} assigned · ${id}`,
        body: `${p.contact.person} now leads forwarding. Escrow, documents and comms all point to ${p.short}.`,
      });
    },
    setChannel: (channel) => {
      set({ channel });
      get().markRead(channel);
    },
    markRead: (channel) =>
      set((s) => {
        const last = s.messages.reduce((m, x) => (x.channel === channel && x.id > m ? x.id : m), 0);
        return last > s.readUpTo[channel] ? { readUpTo: { ...s.readUpTo, [channel]: last } } : {};
      }),
    postMessage: (raw) => {
      const text = raw.trim();
      if (!text) return;
      const s = get();
      const channel = s.channel;
      const shipment = CHANNEL_BY_ID[channel].shipment ?? s.selected;
      const msg: ChatMessage = { id: nextId(), channel, author: s.role, shipment, text, h: s.nowH, mine: true };
      set((st) => ({ messages: [...st.messages, msg].slice(-240), readUpTo: { ...st.readUpTo, [channel]: msg.id } }));

      // Someone on the other side answers, so the thread feels like a live room.
      const reply = composeReply(get(), channel, shipment, text);
      const epoch = get().messages;
      setTimeout(() => {
        if (!get().messages.includes(epoch[epoch.length - 1])) return; // demo was reset
        set({ typing: { channel, author: reply.author, shipment } });
      }, 450);
      setTimeout(() => {
        if (!get().messages.includes(epoch[epoch.length - 1])) return;
        set({ typing: null });
        say(channel, reply.author, reply.text, { chips: reply.chips, shipment });
      }, 2000);
    },

    escalate: () => {
      const s = get();
      const shipment = CHANNEL_BY_ID[s.channel].shipment ?? s.selected;
      const holder = batonAt(getScheduleFor(shipment), s.nowH, s.nowH).role;
      const who = partyOf(s.assignments, shipment, holder);
      say(s.channel, 'system', `${ROLES[s.role].label} escalated ${shipment} to ${who.person} (${ROLES[holder].label}). Response due within 2 hours.`, {
        shipment,
        chips: [{ kind: 'alert', label: 'Escalation · SLA 2h', tone: 'amber' }],
      });
      get().pushToast({ tone: 'amber', title: `Escalated to ${who.person}`, body: `${ROLES[holder].label} on ${shipment} · response SLA 2h. Everyone on the channel is notified.` }, 4200);
    },

    selectShipment: (id) => {
      if (get().twin !== 'closed') return;
      set((s) => ({ selected: id, focus: null, flightNonce: s.flightNonce + 1 }));
    },
    setSidebarTab: (sidebarTab) => set({ sidebarTab, sidebarOpen: true }),
    toggleSidebarCard: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    toggleNetwork: () => set((s) => ({ showNetwork: !s.showNetwork })),
    resolveHold0494: () => {
      const s = get();
      if (s.hold0494 !== 'active') return;
      set({ hold0494: 'resolved', hold0494AtH: s.nowH });
      get().pushSonar(place('mundra'), 'emerald');
      get().pushUlip('icegate', 'RMS re-assessment accepted · SB 5512094 · LEO granted');
      feed('ai', 'SHP-2611-0494 · classification brief accepted, RMS hold lifted at Mundra', 'emerald');
      say('shp-0494', 'broker', 'Sent the classification brief. RMS accepted it and LEO is granted, so the box makes the 112E cutoff.', {
        chips: [{ kind: 'milestone', label: 'LEO granted', tone: 'emerald' }, { kind: 'escrow', label: '₹11,900 released', tone: 'emerald' }],
      });
      say('customs', 'icegate', 'SB 5512094 · RMS re-assessment accepted · LEO granted · Mundra', {
        shipment: 'SHP-2611-0494',
        chips: [{ kind: 'milestone', label: 'Hold lifted', tone: 'emerald' }],
      });
      get().pushToast({
        tone: 'emerald',
        title: 'RMS hold lifted · SHP-2611-0494',
        body: 'LEO granted at Mundra. The box makes the MV Kutch Pioneer cutoff; ₹11,900 released to Kutch Maritime.',
      });
    },
    setRole: (role) => set((s) => ({ role, flightNonce: s.flightNonce + 1 })),
    setLens: (lens) => set({ lens, sidebarTab: 'lens', sidebarOpen: true }),
    tick: () => set({ nowH: liveHour() }),
    scrub: (h) => set({ viewH: h }),

    setXray: (xrayOpen) =>
      set((s) =>
        xrayOpen && s.selected !== FLAGSHIP
          ? { xrayOpen, selected: FLAGSHIP, flightNonce: s.flightNonce + 1 }
          : { xrayOpen },
      ),
    setPhone: (phoneOpen) => set({ phoneOpen }),
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    startDive: () => {
      const s = get();
      if (s.twin !== 'closed') return;
      if (!FLEET[s.selected].twin) {
        s.pushToast({ tone: 'slate', title: 'No container twin for air freight', body: 'The 3D twin covers containerised ocean shipments.' }, 3200);
        return;
      }
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
      say('shp-0482', 'ai', `Commercial Invoice amended ${XRAY_FIX.from} → ${XRAY_FIX.to}. All four key fields now match and the e-BL is re-synced.`, {
        chips: [{ kind: 'doc', label: 'CI amended', tone: 'emerald' }, { kind: 'hash', label: `sha256 ${hash.slice(0, 12)}…`, tone: 'emerald' }],
      });
      say('customs', 'ai', 'SB 4471823 · documents reconciled. The weight hold is no longer expected.', {
        shipment: FLAGSHIP,
        chips: [{ kind: 'milestone', label: 'LEO unblocked', tone: 'emerald' }],
      });
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
        say('shp-0482', 'transporter', 'Gate-in photo uploaded at JNPT Gate 4, geo-tagged 18.9496°N 72.9511°E. Box is at the terminal.', {
          via: 'driver-app',
          chips: [{ kind: 'milestone', label: 'Gate-in · JNPT', tone: 'emerald' }, { kind: 'escrow', label: `${ESCROW[0].amount} released`, tone: 'emerald' }],
        });
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
      say('shp-0482', 'broker', `LEO granted on ${SHIPMENT.shippingBill}. Over to the forwarder for VGM and loading.`, {
        chips: [{ kind: 'milestone', label: 'Customs cleared · LEO', tone: 'emerald' }, { kind: 'escrow', label: `${ESCROW[1].amount} released`, tone: 'emerald' }],
      });
      say('customs', 'icegate', `${SHIPMENT.shippingBill} · LEO granted · out of charge · JNPT`, { shipment: FLAGSHIP, chips: [{ kind: 'milestone', label: 'LEO', tone: 'emerald' }] });
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
      say('shp-0482', 'forwarder', 'VGM submitted: 12,846 kg on WB-03, within tolerance.', { chips: [{ kind: 'milestone', label: 'VGM submitted', tone: 'cobalt' }] });
      get().pushToast({ tone: 'cobalt', title: 'VGM submitted', body: 'Weighbridge WB-03 · 12,846 kg · within tolerance.' });
    },

    issueEbl: () => {
      const s = get();
      if (s.actuals.ebl !== undefined || s.actuals.leo === undefined || !s.docsVerified) return;
      set((st) => ({ actuals: { ...st.actuals, ebl: st.nowH } }));
      get().pushSonar(place('jnpt'), 'cobalt');
      feed('forwarder', `e-BL KMOL-047W-0482 issued · hash anchored ${s.eblHash?.slice(0, 10)}…`, 'emerald');
      say('shp-0482', 'forwarder', 'e-BL KMOL-047W-0482 issued and anchored. Exporter, you can present it under the LC.', {
        chips: [{ kind: 'doc', label: 'e-BL issued', tone: 'emerald' }, { kind: 'hash', label: `sha256 ${s.eblHash?.slice(0, 12)}…`, tone: 'emerald' }],
      });
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
      say('shp-0482', 'exporter', `Presented the e-BL under the LC. ${ESCROW[3].amount} credited. Thanks, everyone.`, {
        chips: [{ kind: 'escrow', label: `${ESCROW[3].amount} released`, tone: 'emerald' }],
      });
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
      // The simulator acts on the flagship, so bring it into view.
      if (s.selected !== FLAGSHIP) Object.assign(patch, { selected: FLAGSHIP, flightNonce: s.flightNonce + 1 });
      if (kind === 'highway_delay') Object.assign(patch, { highway: 'active', highwayAtH: s.nowH });
      if (kind === 'customs_hold') Object.assign(patch, { customs: 'active', customsAtH: s.nowH });
      if (kind === 'red_sea') Object.assign(patch, { redSea: 'active', redSeaAtH: s.nowH });
      set(patch);

      get().pushSonar(place(def.place), 'crimson');
      if (kind === 'highway_delay') get().pushUlip('fastag', 'FASTag gap · Khalapur plaza · 42 min no read');
      if (kind === 'customs_hold') get().pushUlip('icegate', 'RMS: examination order · HS query on SB 4471823');
      feed(kind === 'customs_hold' ? 'icegate' : kind === 'highway_delay' ? 'fastag' : 'forwarder', `${def.title} · ${def.where}`, 'crimson');
      say('shp-0482', 'ai', `${def.title}: ${def.where}. Demurrage exposure is accruing at $${def.ratePerDay.toLocaleString('en-US')}/day. The Co-Pilot has two recovery options ready.`, {
        chips: [{ kind: 'alert', label: def.short, tone: 'crimson' }],
      });
      if (kind === 'customs_hold')
        say('customs', 'icegate', 'SB 4471823 · RMS examination order · HS query · JNPT', { shipment: FLAGSHIP, chips: [{ kind: 'alert', label: 'Examination', tone: 'crimson' }] });
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
      say('shp-0482', 'ai', `Recovery executed: ${option.title}. The new ETA went to all four parties.`, {
        chips: [
          { kind: 'eta', label: `ETA ${formatStamp(after.deliveredH, 'Europe/Berlin')} CET · ${formatDelta(etaDeltaH)}`, tone: 'cobalt' },
          { kind: 'escrow', label: `Exposure capped at ${formatUsd(accrued)}`, tone: 'amber' },
        ],
      });
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
        focus: null,
        flightNonce: s.flightNonce + 1,
      }));
      get().pushToast({ tone: 'slate', title: 'Demo reset', body: 'Shipment restored to its seeded state.' }, 2600);
    },
  };
});

const ACK: Record<Role, string> = {
  exporter: 'Thanks, noted on our side. Ping me here if anything needs a signature.',
  forwarder: "Copy that. I'll keep the booking in step and post here when it moves.",
  broker: "Noted. I'll reflect it on the ICEGATE filing and confirm here.",
  transporter: "Noted. I'll confirm from the gate.",
};

/**
 * Who answers a message posted from the composer, and what they say. ETA, document
 * and customs questions get a factual answer from live state; anything else is
 * acknowledged by whoever holds the baton.
 */
function composeReply(s: ShipmentState, channel: ChannelId, shipment: ShipmentId, text: string): { author: Author; text: string; chips?: MsgChip[] } {
  const q = text.toLowerCase();
  const def = FLEET[shipment];
  const schedule = getScheduleFor(shipment);
  if (/\beta\b|arriv|when|delay/.test(q)) {
    const stamp = formatStamp(schedule.deliveredH, def.destTz);
    return {
      author: 'ai',
      text: `Live ETA for ${shipment}: ${def.destination}, ${stamp} local. Every party on the channel sees the same figure.`,
      chips: [{ kind: 'eta', label: `ETA ${def.destination} · ${stamp}`, tone: 'cobalt' }],
    };
  }
  if (/invoice|document|\bdocs?\b|weight|x-?ray|mismatch|e-?bl/.test(q) && shipment === FLAGSHIP) {
    return s.docsVerified
      ? { author: 'ai', text: 'All four key fields match across the CI, Packing List and e-BL. The e-BL hash is anchored.', chips: [{ kind: 'doc', label: 'Docs verified', tone: 'emerald' }] }
      : {
          author: 'ai',
          text: `The gross weight gap is still open: ${XRAY_FIX.from} on the invoice against ${XRAY_FIX.to} on the Packing List. Resolve it in the Document Studio.`,
          chips: [{ kind: 'alert', label: 'Gross weight mismatch', tone: 'crimson' }],
        };
  }
  if (/hold|rms|customs|\bleo\b|clearance/.test(q)) {
    const held = shipment === 'SHP-2611-0494' ? s.hold0494 === 'active' : s.customs === 'active' || !s.docsVerified;
    const author: Author = s.role === 'broker' ? 'ai' : 'broker';
    return {
      author,
      text: held ? 'Still held. I am on it and will post the LEO here the moment ICEGATE grants it.' : 'Customs is clear on this one. Nothing outstanding from the CHA side.',
      chips: [{ kind: 'milestone', label: held ? 'Customs hold' : 'Customs clear', tone: held ? 'crimson' : 'emerald' }],
    };
  }
  const holder = batonAt(schedule, s.nowH, s.nowH).role;
  if (holder !== s.role) return { author: holder, text: ACK[holder] };
  return { author: 'ai', text: `Logged on the ${CHANNEL_BY_ID[channel].name} record. Every party on this channel sees it.` };
}

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

// --- Fleet ------------------------------------------------------------------------

const airSchedule = buildAirSchedule();
let suratCache: { key: unknown[]; schedule: Schedule } | null = null;

function suratSchedule(hold: HoldState, at: number | null): Schedule {
  if (!suratCache || suratCache.key[0] !== hold || suratCache.key[1] !== at) {
    suratCache = { key: [hold, at], schedule: buildSuratSchedule(hold, at) };
  }
  return suratCache.schedule;
}

/** Any shipment's schedule, for the frame loop. */
export function getScheduleFor(id: ShipmentId): Schedule {
  if (id === 'SHP-2611-0519') return airSchedule;
  if (id === 'SHP-2611-0494') {
    const s = useShipment.getState();
    return suratSchedule(s.hold0494, s.hold0494AtH);
  }
  return getSchedule();
}

/** Any shipment's schedule, for components. */
export function useScheduleFor(id: ShipmentId): Schedule {
  const flagship = useSchedule();
  const hold = useShipment((s) => s.hold0494);
  const at = useShipment((s) => s.hold0494AtH);
  if (id === 'SHP-2611-0519') return airSchedule;
  if (id === 'SHP-2611-0494') return suratSchedule(hold, at);
  return flagship;
}

/** The selected shipment's schedule: what the HUD shows. */
export function useSelectedSchedule(): Schedule {
  return useScheduleFor(useShipment((s) => s.selected));
}

/** The plan each shipment's ETA and CO2 deltas are measured against. */
export function usePlanFor(id: ShipmentId): Schedule {
  const flagshipPlan = usePlan();
  if (id === 'SHP-2611-0519') return airSchedule;
  if (id === 'SHP-2611-0494') return suratSchedule('none', null);
  return flagshipPlan;
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
