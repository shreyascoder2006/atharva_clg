import { AnimatePresence, motion } from 'motion/react';
import { Box, FileText, Link2, Radio, Send, ShieldCheck, Snowflake, Sparkles, Thermometer, TriangleAlert } from 'lucide-react';

import { FLEET } from '@/data/fleet';
import type { Role, ShipmentId } from '@/data/shipment';
import { formatDuration, formatKg, formatStamp, formatUsd } from '@/lib/format';
import { SURAT } from '@/lib/fleet';
import { escrowStatus, milestoneStatuses, type Schedule } from '@/lib/schedule';
import { useScheduleFor, useShipment, type ShipmentState } from '@/store/shipment';
import { Button } from './ui';
import { accessHint } from './panelUtils';
import { ActionRow, BatonCard, DocList, KpiGrid, Section, type ActionSpec, type Kpi } from './WorkspacePanel';

/**
 * Workspace for the two secondary shipments. Same building blocks as the flagship's
 * panel, with each shipment's own parties, actions, KPIs, documents and escrow.
 */
export function FleetWorkspace({ id, role }: { id: Exclude<ShipmentId, 'SHP-2611-0482'>; role: Role }) {
  const schedule = useScheduleFor(id);
  const st = useShipment();
  const def = FLEET[id];
  const statuses = milestoneStatuses(schedule, st.nowH, st.nowH);
  const escrow = def.escrow.find((e) => e.id === role)!;

  return (
    <>
      <BatonCard role={role} schedule={schedule} next={NEXT[id][role]} />
      {id === 'SHP-2611-0494' ? <HoldAlert role={role} /> : <ColdChainNote />}
      <Section title="Actions" hint="RBAC-scoped">
        <div className="space-y-1.5">
          {actionsFor(id, role, st).map((a) => (
            <ActionRow key={a.id} a={a} />
          ))}
        </div>
      </Section>
      <KpiGrid role={role} items={kpisFor(id, role, schedule, st)} escrow={escrow} status={escrowStatus(statuses[escrow.trigger])} />
      <Section title="Documents" hint={accessHint(role, def.documents)}>
        <DocList role={role} docs={def.documents} />
      </Section>
    </>
  );
}

const NEXT: Record<Exclude<ShipmentId, 'SHP-2611-0482'>, Record<Role, string>> = {
  'SHP-2611-0519': {
    exporter: 'Release CAD documents on delivery at Mörfelden',
    forwarder: 'Pre-clear EU import before SKB 761 lands',
    broker: 'Export clearance is on file; nothing outstanding',
    transporter: 'Trip closed at the BLR cargo terminal',
  },
  'SHP-2611-0494': {
    exporter: 'Back the RMS query with the yarn datasheet',
    forwarder: 'Hold the 112E slot until LEO lands',
    broker: 'Answer the RMS query to lift the hold',
    transporter: 'Trip closed at Mundra MICT',
  },
};

function HoldAlert({ role }: { role: Role }) {
  const hold = useShipment((s) => s.hold0494);
  const resolve = useShipment((s) => s.resolveHold0494);
  const canAct = role === 'broker' || role === 'exporter';
  return (
    <AnimatePresence initial={false}>
      {hold === 'active' && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="flex items-start gap-2 rounded-xl border border-crimson/20 bg-crimson/[0.05] p-2.5">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-crimson" />
            <div className="min-w-0 flex-1 text-[11px] leading-snug">
              <div className="font-semibold text-crimson">Customs hold · RMS examination at Mundra</div>
              <div className="text-muted">
                Scanner density suggests textured yarn (5402.33) against the declared FDY (5402.47). Unanswered, the box misses the{' '}
                <span className="num">+{SURAT.cutoffH}h</span> cutoff and rolls <span className="num">{SURAT.nextSailingShiftH}h</span>.
              </div>
            </div>
            {canAct && (
              <Button size="sm" tone="danger" onClick={resolve}>
                <Sparkles size={12} /> AI brief
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ColdChainNote() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald/20 bg-emerald/[0.05] p-2.5 text-[11px]">
      <Snowflake size={14} className="shrink-0 text-emerald" />
      <span className="text-ink">
        <span className="font-semibold text-emerald">Cold chain nominal</span> · logger <span className="num">4.6 °C</span> in a{' '}
        <span className="num">2–8 °C</span> band, no excursions
      </span>
    </div>
  );
}

function actionsFor(id: ShipmentId, role: Role, st: ShipmentState): ActionSpec[] {
  const toast = (title: string, body: string) => () => st.pushToast({ tone: 'cobalt', title, body });
  const held = st.hold0494 === 'active';
  if (id === 'SHP-2611-0519') {
    const common: Record<Role, ActionSpec[]> = {
      exporter: [
        { id: 'share', label: 'Share live tracking link with buyer', icon: <Link2 size={14} />, onClick: st.shareLink },
        { id: 'logger', label: 'Download cold-chain logger report', icon: <Thermometer size={14} />, onClick: toast('Logger report ready', 'TL-0519 · 4.6 °C mean, 0 excursions, 2–8 °C band.') },
      ],
      forwarder: [
        { id: 'uld', label: 'ULD built & screened', icon: <Box size={14} />, onClick: () => {}, done: 'ULD built & screened · 2 × PMC' },
        { id: 'ics2', label: 'Pre-alert EU import (ICS2 filing)', icon: <Send size={14} />, onClick: toast('ICS2 pre-alert filed', 'Entry summary lodged for SKB 761 · FRA.'), primary: true },
        { id: 'pulse', label: 'Watch flight & connector feeds', icon: <Radio size={14} />, onClick: () => st.setLens('ulip') },
      ],
      broker: [
        { id: 'leo', label: 'Air cargo LEO', icon: <ShieldCheck size={14} />, onClick: () => {}, done: 'Air cargo LEO granted · SB 5508371' },
        { id: 'copy', label: 'Download LEO copy', icon: <FileText size={14} />, onClick: toast('LEO copy downloaded', 'SB 5508371 · out of charge at BLR air cargo.') },
      ],
      transporter: [
        { id: 'gate', label: 'Gate-in', icon: <ShieldCheck size={14} />, onClick: () => {}, done: 'Gate-in confirmed at BLR cargo' },
        { id: 'pay', label: 'Escrow', icon: <ShieldCheck size={14} />, onClick: () => {}, done: 'Escrow released · ₹9,800' },
      ],
    };
    return common[role];
  }
  const surat: Record<Role, ActionSpec[]> = {
    exporter: [
      {
        id: 'datasheet',
        label: 'Send yarn datasheet to the CHA',
        icon: <FileText size={14} />,
        onClick: toast('Datasheet shared', 'FDY technical datasheet sent to Kutch Maritime for the RMS reply.'),
        disabled: !held && 'Hold already lifted',
      },
      { id: 'share', label: 'Share live tracking link with buyer', icon: <Link2 size={14} />, onClick: st.shareLink },
      { id: 'twin', label: 'Inspect 3D cargo twin', icon: <Box size={14} />, onClick: st.startDive },
    ],
    forwarder: [
      {
        id: 'slot',
        label: 'Hold the 112E slot until LEO',
        icon: <ShieldCheck size={14} />,
        onClick: toast('Slot held', 'MV Kutch Pioneer 112E slot held until cutoff.'),
        done: !held && 'Slot confirmed on 112E',
      },
      { id: 'twin', label: 'Inspect 3D cargo twin', icon: <Box size={14} />, onClick: st.startDive },
    ],
    broker: [
      {
        id: 'rms',
        label: 'Answer RMS query with AI classification brief',
        icon: <Sparkles size={14} />,
        onClick: st.resolveHold0494,
        primary: held,
        done: !held && 'RMS hold lifted · LEO granted',
      },
      { id: 'icegate', label: 'Open ICEGATE status (SB 5512094)', icon: <Radio size={14} />, onClick: () => st.setLens('ulip') },
    ],
    transporter: [
      { id: 'gate', label: 'Gate-in', icon: <ShieldCheck size={14} />, onClick: () => {}, done: 'Gate-in confirmed at Mundra MICT' },
      { id: 'pay', label: 'Escrow', icon: <ShieldCheck size={14} />, onClick: () => {}, done: 'Escrow released · ₹31,400' },
    ],
  };
  return surat[role];
}

function kpisFor(id: ShipmentId, role: Role, schedule: Schedule, st: ShipmentState): Kpi[] {
  const def = FLEET[id];
  const now = st.nowH;
  const eta = (h: number) => formatStamp(h, def.destTz).slice(0, 16);
  if (id === 'SHP-2611-0519') {
    const k: Record<Role, Kpi[]> = {
      exporter: [
        { label: 'Invoice value', value: formatUsd(def.valueUsd), mono: true },
        { label: 'Incoterm', value: def.incoterm },
        { label: 'Buyer ETA', value: eta(schedule.deliveredH), mono: true },
        { label: 'Scope 3 CO₂e', value: formatKg(schedule.co2Kg), mono: true, tone: 'amber' },
      ],
      forwarder: [
        { label: 'Flight', value: def.carrier },
        { label: 'ETA Frankfurt', value: schedule.ataH > now ? formatDuration(schedule.ataH - now) : 'Landed', mono: true, tone: 'sky' },
        { label: 'HAWB', value: def.unit.ref, mono: true },
        { label: 'ULDs', value: def.unit.equipment },
      ],
      broker: [
        { label: 'Shipping Bill', value: 'SB 5508371', mono: true },
        { label: 'LEO', value: 'Granted', tone: 'emerald' },
        { label: 'HS code', value: def.hsCode, mono: true },
        { label: 'RMS lane', value: 'Facilitation', tone: 'emerald' },
      ],
      transporter: [
        { label: 'Truck', value: 'KA01 AR 7719', mono: true },
        { label: 'Gate-in', value: 'Done', tone: 'emerald' },
        { label: 'Reefer set-point', value: '5.0 °C', mono: true },
        { label: 'FASTag', value: '180ms · live', mono: true },
      ],
    };
    return k[role];
  }
  const held = st.hold0494 === 'active';
  const cutoffIn = SURAT.cutoffH - now;
  const k: Record<Role, Kpi[]> = {
    exporter: [
      { label: 'Invoice value', value: formatUsd(def.valueUsd), mono: true },
      { label: 'Incoterm', value: def.incoterm },
      { label: 'Buyer ETA', value: eta(schedule.deliveredH), mono: true, tone: schedule.rolled ? 'amber' : undefined },
      { label: 'Scope 3 CO₂e', value: formatKg(schedule.co2Kg), mono: true, tone: 'emerald' },
    ],
    forwarder: [
      { label: 'Vessel', value: def.carrier },
      {
        label: 'Cutoff in',
        value: schedule.rolled ? 'Rolls to next sailing' : formatDuration(Math.max(0, cutoffIn)),
        mono: true,
        tone: schedule.rolled ? 'crimson' : cutoffIn < 6 ? 'amber' : undefined,
      },
      { label: 'Booking', value: 'AGL-112E-0494', mono: true },
      { label: 'ATD Mundra', value: formatStamp(schedule.byId.atd.plannedH).slice(4, 16), mono: true },
    ],
    broker: [
      { label: 'Shipping Bill', value: 'SB 5512094', mono: true },
      { label: 'RMS lane', value: held ? 'Examination' : 'Cleared', tone: held ? 'crimson' : 'emerald' },
      { label: 'HS code', value: def.hsCode, mono: true },
      { label: 'LEO', value: held ? 'Withheld' : 'Granted', tone: held ? 'crimson' : 'emerald' },
    ],
    transporter: [
      { label: 'Truck', value: 'GJ05 BX 2207', mono: true },
      { label: 'Gate-in', value: 'Done', tone: 'emerald' },
      { label: 'e-Way Bill', value: 'Closed at gate', tone: 'emerald' },
      { label: 'FASTag', value: '180ms · live', mono: true },
    ],
  };
  return k[role];
}
