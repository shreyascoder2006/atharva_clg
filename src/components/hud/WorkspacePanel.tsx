import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BadgeCheck,
  Box,
  Eye,
  EyeOff,
  FileCheck2,
  FileSearch,
  FileText,
  Landmark,
  Link2,
  Lock,
  MapPin,
  PanelRightClose,
  PanelRightOpen,
  Radio,
  Scale,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { FLEET } from '@/data/fleet';
import {
  DISRUPTIONS,
  DOCUMENTS,
  ESCROW,
  FLAGSHIP,
  ROLES,
  SHIPMENT,
  T,
  ULIP,
  type Access,
  type DocMeta,
  type EscrowLine,
  type Role,
} from '@/data/shipment';
import { formatAgo, formatDuration, formatKg, formatStamp, formatUsd } from '@/lib/format';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { batonAt, escrowStatus, milestoneStatuses, type EscrowStatus, type Schedule } from '@/lib/schedule';
import { useSchedule, useShipment, type FeedItem } from '@/store/shipment';
import { FleetWorkspace } from './FleetWorkspace';
import { accessHint } from './panelUtils';
import { Button, Chip, Dot, Eyebrow, RoleAvatar } from './ui';

export function WorkspacePanel() {
  const role = useShipment((s) => s.role);
  const selected = useShipment((s) => s.selected);
  const open = useShipment((s) => s.panelOpen);
  const toggle = useShipment((s) => s.togglePanel);

  return (
    <>
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            key="panel"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="glass pointer-events-auto absolute top-[84px] right-4 bottom-4 z-20 flex w-[384px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[22px]"
            aria-label={`${ROLES[role].label} workspace`}
          >
            <PanelHeader role={role} onClose={toggle} />
            <div className="scroll-quiet flex-1 overflow-y-auto">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={`${selected}:${role}`}
                  initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-3 px-4 pt-1 pb-4"
                >
                  {selected === FLAGSHIP ? <FlagshipBody role={role} /> : <FleetWorkspace id={selected} role={role} />}
                  <Section title="Live activity" hint="all parties">
                    <Feed />
                  </Section>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {!open && (
        <button
          onClick={toggle}
          className="glass pointer-events-auto absolute top-[84px] right-4 z-20 flex h-10 items-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-ink"
        >
          <PanelRightOpen size={15} className="text-cobalt" /> Workspace
        </button>
      )}
    </>
  );
}

/** The flagship's full workflow: X-Ray, disruptions, driver phone, LC. */
function FlagshipBody({ role }: { role: Role }) {
  const schedule = useSchedule();
  return (
    <>
      <BatonCard role={role} schedule={schedule} next={NEXT_FOR[role]} />
      <AlertStrip role={role} />
      <Section title="Actions" hint="RBAC-scoped">
        <RoleActions role={role} />
      </Section>
      <RoleKpis role={role} />
      <Section title="Documents" hint={accessHint(role, DOCUMENTS)}>
        <DocList role={role} docs={DOCUMENTS} xray />
      </Section>
    </>
  );
}


function PanelHeader({ role, onClose }: { role: Role; onClose: () => void }) {
  const meta = ROLES[role];
  const selected = useShipment((s) => s.selected);
  const party = FLEET[selected].parties[role];
  return (
    <div className="hairline flex items-center gap-3 border-b px-4 py-3">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={role}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        >
          <RoleAvatar role={role} size={36} />
        </motion.div>
      </AnimatePresence>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold text-ink">{meta.label}</span>
          <Chip tone={meta.tone}>{meta.short}</Chip>
        </div>
        <div className="truncate text-[11px] text-muted">
          {party.person} · {party.org}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-subtle">
          <MapPin size={10} /> <span className="num">{selected.slice(-4)}</span> · {FLEET[selected].zones[role].label}
        </div>
      </div>
      <button
        onClick={onClose}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-slate-900/5 hover:text-ink"
        aria-label="Collapse workspace"
      >
        <PanelRightClose size={15} />
      </button>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between">
        <Eyebrow>{title}</Eyebrow>
        {hint && <span className="text-[10px] text-subtle">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/* --- Baton ------------------------------------------------------------------------- */

const NEXT_FOR: Record<Role, string> = {
  exporter: 'Present e-BL to the bank for LC drawdown',
  forwarder: 'Submit VGM, then issue the e-BL',
  broker: 'Reconcile documents and file for LEO',
  transporter: 'Deliver to JNPT Gate 4 and confirm gate-in',
};

export function BatonCard({ role, schedule, next }: { role: Role; schedule: Schedule; next: string }) {
  const nowH = useShipment((s) => s.nowH);
  const baton = batonAt(schedule, nowH, nowH);
  const mine = baton.role === role;
  const holder = ROLES[baton.role];
  const hex = TONE_HEX[ROLES[role].tone];

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-2xl p-3"
      style={{
        background: mine ? `linear-gradient(135deg, color-mix(in oklab, ${hex} 10%, white), white)` : 'rgb(15 23 42 / 0.03)',
        boxShadow: mine ? `inset 0 0 0 1px color-mix(in oklab, ${hex} 25%, transparent)` : 'inset 0 0 0 1px rgb(15 23 42 / 0.05)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <RoleAvatar role={baton.role} size={28} ring={mine} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="eyebrow !text-[9px]">{mine ? 'You hold the baton' : `Baton with ${holder.label}`}</div>
          <div className="truncate text-[12.5px] font-semibold text-ink">{baton.task}</div>
        </div>
        {mine && <Chip tone={ROLES[role].tone}>Your move</Chip>}
      </div>
      {!mine && <div className="mt-2 text-[11px] text-muted">Next for you: {next}</div>}
    </motion.div>
  );
}

/* --- Alerts ------------------------------------------------------------------------ */

function AlertStrip({ role }: { role: Role }) {
  const docsVerified = useShipment((s) => s.docsVerified);
  const disruption = useShipment((s) => s.disruption);
  const setXray = useShipment((s) => s.setXray);
  const sees = DOCUMENTS.find((d) => d.id === 'ci')!.access[role] !== 'none';

  return (
    <AnimatePresence initial={false}>
      {disruption && (
        <motion.div
          key="disruption"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2 rounded-xl border border-crimson/20 bg-crimson/[0.05] p-2.5">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-crimson" />
            <div className="text-[11px] leading-snug">
              <div className="font-semibold text-crimson">{DISRUPTIONS[disruption.kind].title}</div>
              <div className="text-muted">AI Co-Pilot has two recovery plans ready. Recovery decisions are broadcast to all parties.</div>
            </div>
          </div>
        </motion.div>
      )}
      {!docsVerified && (
        <motion.div
          key="docs"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2 rounded-xl border border-crimson/20 bg-crimson/[0.04] p-2.5">
            <Scale size={14} className="mt-0.5 shrink-0 text-crimson" />
            <div className="min-w-0 flex-1 text-[11px] leading-snug">
              <div className="font-semibold text-crimson">Gross weight mismatch · CI vs Packing List</div>
              <div className="num text-muted">
                12,400 kg ≠ 12,850 kg <span className="font-sans">· blocks Customs Clearance</span>
              </div>
            </div>
            {sees && (
              <Button size="sm" tone="secondary" onClick={() => setXray(true)}>
                X-Ray
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* --- Actions --------------------------------------------------------------------- */

export interface ActionSpec {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: string | false;
  primary?: boolean;
  done?: string | false;
}

function RoleActions({ role }: { role: Role }) {
  const s = useShipment();
  const gateIn = s.actuals.gateIn !== undefined;
  const leo = s.actuals.leo !== undefined;
  const ebl = s.actuals.ebl !== undefined;

  const actions: Record<Role, ActionSpec[]> = {
    exporter: [
      {
        id: 'xray',
        label: s.docsVerified ? 'View reconciled documents' : 'Resolve mismatch in Document X-Ray',
        icon: <FileSearch size={14} />,
        onClick: () => s.setXray(true),
        primary: !s.docsVerified,
      },
      {
        id: 'lc',
        label: 'Present e-BL for LC drawdown',
        icon: <Landmark size={14} />,
        onClick: s.presentLc,
        disabled: !ebl && 'Waits for e-BL issue',
        done: s.actuals.lc !== undefined && 'LC proceeds credited',
        primary: ebl,
      },
      { id: 'share', label: 'Share live tracking link with buyer', icon: <Link2 size={14} />, onClick: s.shareLink },
      { id: 'twin', label: 'Inspect 3D cargo twin', icon: <Box size={14} />, onClick: s.startDive },
    ],
    forwarder: [
      {
        id: 'vgm',
        label: 'Submit VGM (SOLAS VI/2)',
        icon: <Scale size={14} />,
        onClick: s.submitVgm,
        disabled: !gateIn && 'Needs weighbridge reading at gate-in',
        done: s.actuals.vgm !== undefined && 'VGM accepted · 12,846 kg',
        primary: gateIn,
      },
      {
        id: 'ebl',
        label: 'Issue e-BL & anchor SHA-256',
        icon: <FileCheck2 size={14} />,
        onClick: s.issueEbl,
        disabled: !s.docsVerified ? 'Blocked: document mismatch' : !leo && 'Waits for customs LEO',
        done: ebl && 'e-BL issued & anchored',
        primary: leo && s.docsVerified,
      },
      { id: 'xray', label: 'Open Document X-Ray (read-only pricing)', icon: <FileSearch size={14} />, onClick: () => s.setXray(true) },
      { id: 'twin', label: 'Inspect 3D cargo twin', icon: <Box size={14} />, onClick: s.startDive },
    ],
    broker: [
      {
        id: 'xray',
        label: s.docsVerified ? 'Documents reconciled' : 'Run Document X-Ray',
        icon: <FileSearch size={14} />,
        onClick: () => s.setXray(true),
        primary: !s.docsVerified,
      },
      {
        id: 'leo',
        label: 'File for clearance · Let Export Order',
        icon: <ShieldCheck size={14} />,
        onClick: s.clearCustoms,
        disabled: !s.docsVerified
          ? 'Blocked: document mismatch'
          : s.customs === 'active'
            ? 'RMS hold: use the Co-Pilot'
            : !gateIn && 'Waits for gate-in at JNPT',
        done: leo && 'LEO granted',
        primary: s.docsVerified && gateIn && s.customs !== 'active',
      },
      { id: 'icegate', label: 'Open ICEGATE status (SB 4471823)', icon: <Radio size={14} />, onClick: () => s.setLens('ulip') },
    ],
    transporter: [
      {
        id: 'phone',
        label: s.phoneOpen ? 'Driver app is open' : 'Open driver magic-link app',
        icon: <Smartphone size={14} />,
        onClick: () => s.setPhone(true),
        primary: !gateIn,
        done: gateIn && 'Gate-in confirmed by driver',
      },
      {
        id: 'push',
        label: 'Push route & pre-gate slot to driver',
        icon: <Send size={14} />,
        onClick: () =>
          s.pushToast({ tone: 'violet', title: 'Route pushed to driver', body: 'Magic link refreshed · pre-gate token PG-0482 · Gate 4' }),
      },
      { id: 'ulip', label: 'FASTag & VAHAN feeds', icon: <Radio size={14} />, onClick: () => s.setLens('ulip') },
    ],
  };

  return (
    <div className="space-y-1.5">
      {actions[role].map((a) => (
        <ActionRow key={a.id} a={a} />
      ))}
    </div>
  );
}

export function ActionRow({ a }: { a: ActionSpec }) {
  if (a.done) {
    return (
      <div className="flex h-10 items-center gap-2.5 rounded-xl bg-emerald/[0.07] px-3 text-[12px] font-semibold text-emerald">
        <BadgeCheck size={15} />
        {a.done}
      </div>
    );
  }
  const disabled = !!a.disabled;
  return (
    <button
      onClick={a.onClick}
      disabled={disabled}
      className={`group flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-semibold transition-all active:scale-[0.99] ${
        a.primary && !disabled
          ? 'bg-cobalt text-white shadow-[0_8px_20px_-8px_rgb(37_99_235/0.75),inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110'
          : 'border border-hairline bg-white/75 text-ink hover:bg-white disabled:hover:bg-white/75'
      } disabled:cursor-not-allowed`}
    >
      <span className={a.primary && !disabled ? 'text-white' : disabled ? 'text-subtle' : 'text-cobalt'}>{disabled ? <Lock size={14} /> : a.icon}</span>
      <span className="min-w-0 flex-1">
        <span className={disabled ? 'text-muted' : ''}>{a.label}</span>
        {disabled && <span className="block text-[10.5px] font-medium text-subtle">{a.disabled}</span>}
      </span>
      {!disabled && <ArrowRight size={13} className="opacity-50 transition-transform group-hover:translate-x-0.5" />}
    </button>
  );
}

/* --- KPIs ------------------------------------------------------------------------ */

function RoleKpis({ role }: { role: Role }) {
  const schedule = useSchedule();
  const nowH = useShipment((s) => s.nowH);
  const s = useShipment();
  const st = milestoneStatuses(schedule, nowH, nowH);
  const escrow = ESCROW.find((e) => e.id === role)!;
  const esc = escrowStatus(st[escrow.trigger]);

  const cutoffIn = T.cutoff - nowH;
  const items: Record<Role, { label: string; value: string; tone?: Tone; mono?: boolean }[]> = {
    exporter: [
      { label: 'Invoice value', value: formatUsd(SHIPMENT.invoiceValueUsd), mono: true },
      { label: 'Incoterm', value: SHIPMENT.incoterm },
      { label: 'Buyer ETA', value: formatStamp(schedule.deliveredH, 'Europe/Berlin').slice(0, 16), mono: true },
      { label: 'Scope 3 CO₂e', value: formatKg(schedule.co2Kg), mono: true, tone: 'emerald' },
    ],
    forwarder: [
      { label: 'Vessel', value: `${SHIPMENT.vessel} ${SHIPMENT.voyage}` },
      {
        label: 'CY cutoff in',
        value: schedule.rolled ? 'Rolled · next sailing' : formatDuration(Math.max(0, cutoffIn)),
        tone: schedule.rolled ? 'crimson' : cutoffIn < 6 ? 'amber' : undefined,
        mono: true,
      },
      { label: 'Booking', value: SHIPMENT.bookingRef, mono: true },
      { label: 'ATD JNPT', value: formatStamp(schedule.byId.atd.plannedH).slice(4, 16), mono: true },
    ],
    broker: [
      { label: 'Shipping Bill', value: SHIPMENT.shippingBill, mono: true },
      {
        label: 'RMS lane',
        value: s.customs === 'active' ? 'Examination' : 'Facilitation',
        tone: s.customs === 'active' ? 'crimson' : 'emerald',
      },
      { label: 'HS code', value: SHIPMENT.hsCode, mono: true },
      {
        label: 'LEO',
        value: s.actuals.leo !== undefined ? 'Granted' : `ETA ${formatDuration(Math.max(0, schedule.byId.leo.plannedH - nowH))}`,
        tone: s.actuals.leo !== undefined ? 'emerald' : !s.docsVerified ? 'crimson' : undefined,
        mono: true,
      },
    ],
    transporter: [
      { label: 'Truck', value: SHIPMENT.truck, mono: true },
      {
        label: 'ETA Gate 4',
        value: s.actuals.gateIn !== undefined ? 'Gated in' : formatDuration(Math.max(0, schedule.gateInH - nowH)),
        tone: s.highway === 'active' ? 'crimson' : s.actuals.gateIn !== undefined ? 'emerald' : undefined,
        mono: true,
      },
      { label: 'e-Way Bill', value: 'Valid · 36h left', tone: 'emerald' },
      { label: 'FASTag', value: `${ULIP[0].latencyMs}ms · live`, mono: true },
    ],
  };

  return <KpiGrid role={role} items={items[role]} escrow={escrow} status={esc} />;
}

export interface Kpi {
  label: string;
  value: string;
  tone?: Tone;
  mono?: boolean;
}

export function KpiGrid({ role, items, escrow, status: esc }: { role: Role; items: Kpi[]; escrow: EscrowLine; status: EscrowStatus }) {
  const escTone: Tone = esc === 'released' ? 'emerald' : esc === 'blocked' ? 'crimson' : 'slate';
  return (
    <Section title="Shipment KPIs" hint={ROLES[role].short}>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((k) => (
          <div key={k.label} className="rounded-xl bg-white/70 px-2.5 py-2 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
            <div className="text-[9.5px] font-semibold tracking-[0.08em] text-subtle uppercase">{k.label}</div>
            <div className={`${k.mono ? 'num' : ''} truncate text-[12px] font-semibold`} style={{ color: k.tone ? TONE_HEX[k.tone] : '#0f172a' }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-xl bg-white/70 px-2.5 py-2 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
        <div className="leading-tight">
          <div className="text-[9.5px] font-semibold tracking-[0.08em] text-subtle uppercase">Milestone escrow</div>
          <div className="num text-[12px] font-semibold text-ink">
            {escrow.amount} <span className="font-sans text-[10.5px] font-medium text-muted">{escrow.triggerLabel}</span>
          </div>
        </div>
        <Chip tone={escTone}>
          {esc === 'released' ? <BadgeCheck size={11} /> : <Lock size={10} />}
          {esc === 'released' ? 'Released' : esc === 'blocked' ? 'Blocked' : 'Locked in Escrow'}
        </Chip>
      </div>
    </Section>
  );
}

/* --- Documents ------------------------------------------------------------------- */

const ACCESS_CHIP: Record<Access, { label: string; tone: Tone; icon: ReactNode }> = {
  full: { label: 'Full', tone: 'emerald', icon: <Eye size={10} /> },
  view: { label: 'View', tone: 'cobalt', icon: <Eye size={10} /> },
  redacted: { label: 'Redacted', tone: 'amber', icon: <EyeOff size={10} /> },
  none: { label: 'No access', tone: 'slate', icon: <Lock size={10} /> },
};

export function DocList({ role, docs, xray: xrayEnabled = false }: { role: Role; docs: DocMeta[]; xray?: boolean }) {
  const setXray = useShipment((s) => s.setXray);
  const flagshipDocsVerified = useShipment((s) => s.docsVerified);
  // Only the flagship's documents carry the seeded mismatch.
  const docsVerified = !xrayEnabled || flagshipDocsVerified;
  const sorted = [...docs].sort((a, b) => Number(a.access[role] === 'none') - Number(b.access[role] === 'none'));

  return (
    <div className="overflow-hidden rounded-xl bg-white/70 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
      {sorted.map((d, i) => {
        const access = d.access[role];
        const chip = ACCESS_CHIP[access];
        const xray = xrayEnabled && (d.id === 'ci' || d.id === 'pl' || d.id === 'ebl');
        const mismatch = !docsVerified && (d.id === 'ci' || d.id === 'pl');
        const locked = access === 'none';
        return (
          <button
            key={d.id}
            disabled={locked}
            onClick={() => (xray ? setXray(true) : undefined)}
            title={locked || access === 'redacted' ? d.restriction : undefined}
            className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors ${i ? 'hairline border-t' : ''} ${
              locked ? 'cursor-not-allowed opacity-60' : 'hover:bg-white'
            }`}
          >
            <FileText size={14} className={locked ? 'text-subtle' : mismatch ? 'text-crimson' : 'text-muted'} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className={`block truncate text-[11.5px] font-semibold ${locked ? 'text-muted' : 'text-ink'}`}>{d.name}</span>
              <span className="num block truncate text-[9.5px] text-subtle">
                {locked ? d.restriction : d.ref}
              </span>
            </span>
            {mismatch && !locked && <Dot tone="crimson" pulse size={6} />}
            {xrayEnabled && d.id === 'ebl' && docsVerified && !locked && (
              <Chip tone="emerald">
                <Sparkles size={9} /> SHA-256
              </Chip>
            )}
            <Chip tone={chip.tone}>
              {chip.icon}
              {chip.label}
            </Chip>
          </button>
        );
      })}
    </div>
  );
}

/* --- Feed ---------------------------------------------------------------------------- */

const SOURCE_LABEL: Record<string, string> = {
  fastag: 'FASTag',
  icegate: 'ICEGATE',
  vahan: 'VAHAN',
  portgate: 'Port Gate',
  ai: 'AI Co-Pilot',
};

export function Feed() {
  const feed = useShipment((s) => s.feed);
  const nowH = useShipment((s) => s.nowH);
  return (
    <ol className="space-y-px overflow-hidden rounded-xl bg-white/70 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
      <AnimatePresence initial={false}>
        {feed.slice(0, 7).map((f) => (
          <motion.li
            key={f.id}
            layout
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 px-2.5 py-1.5"
          >
            <FeedIcon f={f} />
            <span className="min-w-0 flex-1 text-[11px] leading-snug text-ink">
              <span className="font-semibold" style={{ color: TONE_HEX[f.tone] }}>
                {f.source in ROLES ? ROLES[f.source as Role].label : SOURCE_LABEL[f.source]}
              </span>{' '}
              <span className="text-muted">{f.text}</span>
            </span>
            <span className="num shrink-0 text-[9.5px] text-subtle">{formatAgo(nowH - f.h)}</span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function FeedIcon({ f }: { f: FeedItem }) {
  if (f.source in ROLES) return <RoleAvatar role={f.source as Role} size={18} />;
  if (f.source === 'ai')
    return (
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-cobalt/10 text-cobalt">
        <Sparkles size={10} />
      </span>
    );
  return (
    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-sky/10 text-sky">
      <Radio size={10} />
    </span>
  );
}
