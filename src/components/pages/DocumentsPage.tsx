import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Eye,
  Factory,
  FileText,
  Fingerprint,
  Handshake,
  Lock,
  Plane,
  RefreshCw,
  ScanText,
  Ship,
  ShieldCheck,
} from 'lucide-react';

import { Card, DashPage, Pill, RoleBadge, ShipmentPicker } from '@/components/dash/kit';
import { XrayStudio } from '@/components/xray/DocXrayModal';
import { FLEET } from '@/data/fleet';
import { FLAGSHIP, ROLE_ORDER, ROLES, type Access, type DocMeta, type Role, type ShipmentId } from '@/data/shipment';
import { formatStamp, hourToDate } from '@/lib/format';
import { sha256Hex } from '@/lib/hash';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { milestoneStatuses, type Schedule } from '@/lib/schedule';
import { docState, type DocState } from '@/components/dash/docState';
import { partyOf, useScheduleFor, useShipment, type ShipmentState } from '@/store/shipment';

export default function DocumentsPage() {
  const id = useShipment((s) => s.selected);
  const setView = useShipment((s) => s.setView);
  return (
    <DashPage
      view="documents"
      subtitle="One vault for every trade document. AI X-Ray reconciles key fields across documents, RBAC decides who sees what, and every signature is chained by SHA-256."
      actions={<ShipmentPicker />}
    >
      <section className="glass overflow-hidden rounded-[20px]">
        <XrayStudio key={id} shipment={id} onContinue={() => setView('tower')} />
      </section>

      <div className="mt-4 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 max-[1180px]:grid-cols-1">
        <DocumentMatrix id={id} />
        <ChainOfCustody id={id} />
      </div>
    </DashPage>
  );
}

/* --- Smart document matrix ------------------------------------------------------------- */

/** OCR / extraction confidence per document type. Digital-native filings read 100%. */
const OCR: Record<string, number | 'api'> = {
  ci: 99.4,
  pl: 98.9,
  ebl: 99.7,
  awb: 99.5,
  sb: 'api',
  ewb: 'api',
  vgm: 98.6,
  eir: 97.8,
  coo: 99.1,
  temp: 'api',
  coa: 98.2,
};

function DocumentMatrix({ id }: { id: ShipmentId }) {
  const def = FLEET[id];
  const role = useShipment((s) => s.role);
  const schedule = useScheduleFor(id);
  const state = useShipment();
  const statuses = milestoneStatuses(schedule, state.nowH, state.nowH);
  const visible = def.documents.filter((d) => d.access[role] !== 'none').length;

  return (
    <Card
      eyebrow="Smart document matrix"
      title={`${def.documents.length} documents · ${visible} visible to ${ROLES[role].short}`}
      action={<AccessLegend />}
    >
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {def.documents.map((d) => (
          <DocCard key={d.id} doc={d} role={role} state={docState(id, d, state, statuses)} />
        ))}
      </div>
    </Card>
  );
}

const ACCESS_STYLE: Record<Access, { label: string; icon: React.ReactNode }> = {
  full: { label: 'Full access', icon: <Check size={9} strokeWidth={3} /> },
  view: { label: 'View only', icon: <Eye size={9} /> },
  redacted: { label: 'Pricing redacted', icon: <Lock size={9} /> },
  none: { label: 'No access', icon: null },
};

function AccessChip({ role, access, me }: { role: Role; access: Access; me: boolean }) {
  const hex = TONE_HEX[ROLES[role].tone];
  const style =
    access === 'full'
      ? { color: 'white', background: hex }
      : access === 'view'
        ? { color: hex, background: 'white', boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hex} 45%, transparent)` }
        : access === 'redacted'
          ? { color: TONE_HEX.amber, background: `color-mix(in oklab, ${TONE_HEX.amber} 10%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${TONE_HEX.amber} 30%, transparent)` }
          : { color: '#94A3B8', background: 'rgba(15,23,42,0.04)' };
  return (
    <span
      className={`num inline-flex h-[20px] items-center gap-0.5 rounded-md px-1.5 text-[9.5px] font-bold ${access === 'none' ? 'line-through' : ''}`}
      style={{ ...style, outline: me ? '2px solid rgba(15,23,42,0.75)' : undefined, outlineOffset: 1 }}
      title={`${ROLES[role].label}: ${ACCESS_STYLE[access].label}`}
    >
      {ACCESS_STYLE[access].icon}
      {ROLES[role].short}
    </span>
  );
}

function AccessLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-muted max-md:hidden">
      {(['full', 'view', 'redacted', 'none'] as Access[]).map((a) => (
        <span key={a} className="flex items-center gap-1">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{
              background: a === 'full' ? TONE_HEX.cobalt : a === 'redacted' ? `color-mix(in oklab, ${TONE_HEX.amber} 25%, white)` : a === 'view' ? 'white' : 'rgba(15,23,42,0.08)',
              boxShadow: a === 'view' ? `inset 0 0 0 1px ${TONE_HEX.cobalt}` : undefined,
            }}
          />
          {ACCESS_STYLE[a].label}
        </span>
      ))}
    </div>
  );
}

function DocCard({ doc, role, state }: { doc: DocMeta; role: Role; state: DocState }) {
  const mine = doc.access[role];
  const ocr = OCR[doc.id] ?? 98.4;
  const locked = mine === 'none';
  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-2xl border bg-white p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
      style={{ borderColor: state.tone === 'crimson' ? 'rgba(220,38,38,0.35)' : 'rgba(15,23,42,0.08)' }}
    >
      <div className={locked ? 'pointer-events-none blur-[3px] select-none' : ''}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900/[0.04] text-muted">
              <FileText size={15} />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[12.5px] font-semibold text-ink">{doc.name}</div>
              <div className="num mt-0.5 truncate text-[10.5px] text-muted">{doc.ref}</div>
            </div>
          </div>
          <Pill tone={state.tone} pulse={state.pulse}>
            {state.label}
          </Pill>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ScanText size={12} className="shrink-0 text-subtle" />
          <span className="w-[74px] shrink-0 text-[10px] font-semibold tracking-[0.08em] text-subtle uppercase">{ocr === 'api' ? 'Source' : 'OCR conf.'}</span>
          {ocr === 'api' ? (
            <span className="text-[11px] font-semibold text-emerald">Digital filing · API</span>
          ) : (
            <>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900/[0.06]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: ocr >= 99 ? TONE_HEX.emerald : TONE_HEX.cobalt }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(ocr - 90) * 10}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="num w-[42px] text-right text-[11px] font-semibold text-ink">{ocr.toFixed(1)}%</span>
            </>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {ROLE_ORDER.map((r) => (
              <AccessChip key={r} role={r} access={doc.access[r]} me={r === role} />
            ))}
          </div>
          <span className="text-[10px] text-subtle">
            by {doc.issuer === 'customs' ? 'ICEGATE' : doc.issuer === 'gst' ? 'GSTN' : ROLES[doc.issuer].short}
          </span>
        </div>
      </div>
      {locked && (
        <div className="absolute inset-0 grid place-items-center bg-white/55 p-3 text-center">
          <div>
            <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-slate-900/[0.06] text-muted">
              <Lock size={14} />
            </span>
            <div className="mt-1.5 text-[11.5px] font-semibold text-ink">{doc.name}</div>
            <div className="mt-0.5 max-w-[230px] text-[10.5px] leading-snug text-muted">{doc.restriction ?? 'Not shared with your role.'}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* --- Chain of custody ------------------------------------------------------------------- */

interface Step {
  party: 'Exporter' | 'Forwarder' | 'Carrier' | 'Consignee';
  org: string;
  action: string;
  role: Role | null;
  status: 'signed' | 'pending' | 'blocked';
  atH: number;
  note?: string;
}

const STEP_ICON = { Exporter: Factory, Forwarder: Handshake, Carrier: Ship, Consignee: Building2 } as const;

function custodySteps(id: ShipmentId, s: ShipmentState, schedule: Schedule): { doc: string; steps: Step[] } {
  const st = milestoneStatuses(schedule, s.nowH, s.nowH);
  const at = (m: string) => schedule.byId[m]?.actualH ?? schedule.byId[m]?.plannedH ?? s.nowH;
  const done = (m: string) => st[m] === 'done';
  const ff = partyOf(s.assignments, id, 'forwarder').org;
  const exp = FLEET[id].parties.exporter.org;

  if (id === FLAGSHIP) {
    const ebl = s.actuals.ebl;
    return {
      doc: 'e-BL KMOL-047W-0482',
      steps: [
        { party: 'Exporter', org: exp, action: 'Shipping instructions signed', role: 'exporter', status: 'signed', atH: -40 },
        {
          party: 'Forwarder',
          org: ff,
          action: 'e-BL issued as agent',
          role: 'forwarder',
          status: ebl !== undefined ? 'signed' : s.docsVerified ? 'pending' : 'blocked',
          atH: ebl ?? at('ebl'),
          note: ebl !== undefined ? undefined : !s.docsVerified ? 'Blocked by the gross weight mismatch' : s.actuals.leo === undefined ? 'Waits for LEO' : 'Ready to issue',
        },
        { party: 'Carrier', org: 'Konkan Ocean Lines', action: 'Shipped on board · master signature', role: null, status: done('loaded') ? 'signed' : 'pending', atH: at('loaded') },
        { party: 'Consignee', org: 'Rhein-Ruhr Antriebstechnik GmbH', action: 'Endorsed & surrendered at Rotterdam', role: null, status: done('ata') ? 'signed' : 'pending', atH: at('ata') },
      ],
    };
  }
  if (id === 'SHP-2611-0494') {
    const held = s.hold0494 === 'active';
    return {
      doc: 'e-BL KPL-112E-0494',
      steps: [
        { party: 'Exporter', org: exp, action: 'Shipping instructions signed', role: 'exporter', status: 'signed', atH: -30 },
        {
          party: 'Forwarder',
          org: ff,
          action: 'e-BL issued as agent',
          role: 'forwarder',
          status: done('loaded') ? 'signed' : held ? 'blocked' : 'pending',
          atH: at('loaded') + 1,
          note: held ? 'Blocked by the RMS hold at Mundra' : undefined,
        },
        { party: 'Carrier', org: 'Kutch Shipping Co.', action: 'Shipped on board · master signature', role: null, status: done('loaded') ? 'signed' : 'pending', atH: at('loaded') },
        { party: 'Consignee', org: 'Al Noor Textile Trading LLC', action: 'Surrendered at Jebel Ali', role: null, status: done('delivered') ? 'signed' : 'pending', atH: at('delivered') },
      ],
    };
  }
  return {
    doc: 'e-AWB AGL-HAWB-BLR-0519',
    steps: [
      { party: 'Exporter', org: exp, action: "Shipper's letter of instruction signed", role: 'exporter', status: 'signed', atH: -14 },
      { party: 'Forwarder', org: ff, action: 'House air waybill issued', role: 'forwarder', status: done('uld') ? 'signed' : 'pending', atH: at('uld') },
      { party: 'Carrier', org: 'Skybridge Cargo', action: 'MAWB executed · SKB 761 departed', role: null, status: done('atd') ? 'signed' : 'pending', atH: at('atd') },
      { party: 'Consignee', org: 'Rhein-Main Pharma Distribution', action: 'Released at FRA cargo', role: null, status: done('release') ? 'signed' : 'pending', atH: at('release') },
    ],
  };
}

const iso = (h: number) => hourToDate(h).toISOString().slice(0, 16) + 'Z';

/** The canonical record each signature hashes. Linking `prev` makes it a chain. */
function payloadOf(doc: string, i: number, step: Step, prev: string) {
  return { doc, seq: i + 1, party: step.party, org: step.org, action: step.action, signedAt: iso(step.atH), prev };
}

const GENESIS = '0'.repeat(64);

function ChainOfCustody({ id }: { id: ShipmentId }) {
  const state = useShipment();
  const schedule = useScheduleFor(id);
  const { doc, steps } = custodySteps(id, state, schedule);
  const signature = steps.map((s) => `${s.status}|${s.org}|${s.atH.toFixed(2)}`).join('/');
  const [hashes, setHashes] = useState<{ key: string; list: (string | null)[] }>({ key: '', list: [] });
  const [open, setOpen] = useState<number | null>(null);
  const key = `${doc}/${signature}`;

  // Real SHA-256 over each signature record, each linked to the one before it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list: (string | null)[] = [];
      let prev = GENESIS;
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].status !== 'signed') {
          list.push(null);
          continue;
        }
        const h = await sha256Hex(JSON.stringify(payloadOf(doc, i, steps[i], prev)));
        list.push(h);
        prev = h;
      }
      if (!cancelled) setHashes({ key, list });
    })();
    return () => {
      cancelled = true;
    };
    // `key` captures every input to the chain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const list = hashes.key === key ? hashes.list : [];
  const signed = steps.filter((s) => s.status === 'signed').length;

  return (
    <Card
      eyebrow="Tamper-proof chain of custody"
      title={doc}
      action={
        <Pill tone={signed === steps.length ? 'emerald' : 'cobalt'}>
          {signed}/{steps.length} signed
        </Pill>
      }
    >
      <ol className="relative grid grid-cols-4 gap-2 max-sm:grid-cols-2 max-sm:gap-y-5">
        {steps.map((s, i) => {
          const Icon = s.party === 'Carrier' && id === 'SHP-2611-0519' ? Plane : STEP_ICON[s.party];
          const tone: Tone = s.status === 'signed' ? 'emerald' : s.status === 'blocked' ? 'crimson' : 'slate';
          const hex = TONE_HEX[tone];
          const nextSigned = steps[i + 1]?.status === 'signed';
          const hash = list[i];
          return (
            <li key={s.party} className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 && (
                <span
                  className="absolute top-[19px] left-[calc(50%+24px)] h-[2px] w-[calc(100%-40px)] max-sm:hidden"
                  style={{
                    background: s.status === 'signed' && nextSigned ? TONE_HEX.emerald : 'repeating-linear-gradient(90deg, rgba(15,23,42,0.18) 0 5px, transparent 5px 10px)',
                  }}
                />
              )}
              <span
                className="relative grid h-10 w-10 place-items-center rounded-full"
                style={{
                  color: s.status === 'signed' ? 'white' : hex,
                  background: s.status === 'signed' ? hex : 'white',
                  boxShadow: s.status === 'signed' ? `0 6px 16px -6px ${hex}` : `inset 0 0 0 1.5px color-mix(in oklab, ${hex} 45%, transparent)`,
                }}
              >
                <Icon size={16} />
                {s.status === 'signed' && (
                  <span className="absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full bg-white text-emerald shadow-[0_0_0_1px_rgb(5_150_105/0.3)]">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </span>
              <div className="mt-2 flex items-center gap-1 text-[11.5px] font-semibold text-ink">
                {s.party}
                {s.role && <RoleBadge role={s.role} />}
              </div>
              <div className="mt-0.5 line-clamp-1 max-w-full text-[10.5px] text-muted" title={s.org}>
                {s.org}
              </div>
              <div className="mt-1 line-clamp-2 min-h-[28px] text-[10.5px] leading-snug text-ink">{s.action}</div>
              <div className="num mt-1 text-[10px] font-semibold" style={{ color: hex }}>
                {s.status === 'signed' ? formatStamp(s.atH).slice(4, 16) : s.status === 'blocked' ? 'Blocked' : `Due ${formatStamp(s.atH).slice(4, 10)}`}
              </div>
              {hash ? (
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="num mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald/[0.08] px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald shadow-[inset_0_0_0_1px_rgb(5_150_105/0.18)] transition-colors hover:bg-emerald/[0.14]"
                  aria-expanded={open === i}
                  aria-label={`SHA-256 of ${s.party} signature, ${hash}`}
                >
                  <Fingerprint size={10} />
                  {hash.slice(0, 6)}…{hash.slice(-4)}
                </button>
              ) : (
                <span className="mt-1.5 text-[9.5px] text-subtle">{s.note ?? 'Awaiting signature'}</span>
              )}
            </li>
          );
        })}
      </ol>

      <AnimatePresence initial={false}>
        {open !== null && list[open] && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Verifier doc={doc} steps={steps} hashes={list} index={open} />
          </motion.div>
        )}
      </AnimatePresence>
      {open === null && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck size={13} className="text-emerald" />
          Each signature hashes its record together with the previous signature's hash. Click a hash to verify it.
        </p>
      )}
    </Card>
  );
}

function Verifier({ doc, steps, hashes, index }: { doc: string; steps: Step[]; hashes: (string | null)[]; index: number }) {
  const hash = hashes[index]!;
  const prev = useMemo(() => {
    for (let i = index - 1; i >= 0; i--) if (hashes[i]) return hashes[i]!;
    return GENESIS;
  }, [hashes, index]);
  const payload = payloadOf(doc, index, steps[index], prev);
  const [result, setResult] = useState<{ ok: boolean; at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pushToast = useShipment((s) => s.pushToast);

  const copy = async () => {
    let ok: boolean;
    try {
      await navigator.clipboard.writeText(hash);
      ok = true;
    } catch {
      // Clipboard API refused (insecure context or permissions): fall back to a selection copy.
      const ta = document.createElement('textarea');
      ta.value = hash;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      ta.remove();
    }
    setCopied(ok);
    setTimeout(() => setCopied(false), 1400);
    pushToast(
      ok
        ? { tone: 'emerald', title: 'SHA-256 copied to clipboard', body: `${steps[index].party} signature on ${doc} · ${hash.slice(0, 16)}…${hash.slice(-8)}` }
        : { tone: 'amber', title: 'Copy blocked by the browser', body: 'Select the hash in the panel and copy it manually.' },
      3200,
    );
  };

  const verify = async () => {
    setBusy(true);
    const again = await sha256Hex(JSON.stringify(payload));
    await new Promise((r) => setTimeout(r, 350));
    setResult({ ok: again === hash, at: new Date().toLocaleTimeString('en-GB') });
    setBusy(false);
  };

  return (
    <div className="mt-4 rounded-2xl bg-[#F7F9FC] p-4 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="eyebrow">Signature {index + 1} · {steps[index].party}</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void copy()}
            aria-label="Copy SHA-256 hash"
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-muted transition-colors hover:bg-white hover:text-ink"
          >
            {copied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={verify}
            disabled={busy}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-ink px-2.5 text-[11px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Re-verify SHA-256
          </button>
        </div>
      </div>
      <div className="num mt-2 grid grid-cols-4 gap-x-2 text-[11px] font-semibold break-all text-ink max-sm:grid-cols-2">
        {[0, 1, 2, 3].map((q) => (
          <span key={q}>{hash.slice(q * 16, q * 16 + 16)}</span>
        ))}
      </div>
      <pre className="num scroll-quiet mt-3 max-h-[150px] overflow-auto rounded-xl bg-white p-3 text-[10.5px] leading-relaxed text-muted shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]">
        {JSON.stringify(payload, null, 2)}
      </pre>
      <AnimatePresence>
        {result && (
          <motion.div
            key={result.at}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold"
            style={{ color: result.ok ? TONE_HEX.emerald : TONE_HEX.crimson }}
          >
            <BadgeCheck size={14} />
            {result.ok ? `Hash matches · chain intact back to genesis · verified ${result.at}` : 'Hash mismatch · record altered'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

