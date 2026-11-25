import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BadgeCheck, FileSearch, Lock, ScanLine, Sparkles, X } from 'lucide-react';

import {
  DOCUMENTS,
  ROLES,
  SHIPMENT,
  XRAY_FIELDS,
  XRAY_FIX,
  XRAY_LAYOUT,
  XRAY_VALUES,
  type Access,
  type XrayDocId,
  type XrayFieldKey,
} from '@/data/shipment';
import { formatStamp } from '@/lib/format';
import { PALETTE } from '@/lib/palette';
import { useShipment } from '@/store/shipment';
import { Button, Chip } from '@/components/hud/ui';

const ORDER: XrayDocId[] = ['ci', 'pl', 'ebl'];

interface Link {
  key: string;
  field: XrayFieldKey;
  d: string;
  ok: boolean;
}

export function DocXrayModal() {
  const open = useShipment((s) => s.xrayOpen);
  const setXray = useShipment((s) => s.setXray);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[#eef3f9]/60 backdrop-blur-md" onClick={() => setXray(false)} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="AI Document X-Ray"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong relative flex max-h-[calc(100vh-32px)] w-[1180px] max-w-full flex-col overflow-hidden rounded-[28px]"
          >
            <XrayBody onClose={() => setXray(false)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function XrayBody({ onClose }: { onClose: () => void }) {
  const role = useShipment((s) => s.role);
  const docsVerified = useShipment((s) => s.docsVerified);
  const eblHash = useShipment((s) => s.eblHash);
  const resolveDocs = useShipment((s) => s.resolveDocs);
  const setRole = useShipment((s) => s.setRole);
  const [scanning, setScanning] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const [links, setLinks] = useState<Link[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const access = (id: XrayDocId): Access => DOCUMENTS.find((d) => d.id === id)!.access[role];
  const canAmend = role === 'exporter' || role === 'broker';
  const mismatches = docsVerified ? 0 : 1;

  const valueOf = (doc: XrayDocId, field: XrayFieldKey) =>
    docsVerified && doc === XRAY_FIX.doc && field === XRAY_FIX.field ? XRAY_FIX.to : XRAY_VALUES[doc][field];

  // Connectors are measured from the live DOM so they track the cards through the open
  // animation, window resizes and scrolling.
  const measure = useCallback(() => {
    const root = stage.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    setSize({ w: box.width, h: root.scrollHeight });
    if (box.width < 860) {
      setLinks([]);
      return;
    }
    const out: Link[] = [];
    for (let i = 0; i < ORDER.length - 1; i++) {
      const a = ORDER[i];
      const b = ORDER[i + 1];
      if (access(a) === 'none' || access(b) === 'none') continue;
      for (const f of XRAY_FIELDS) {
        const ra = rows.current.get(`${a}:${f.key}`)?.getBoundingClientRect();
        const rb = rows.current.get(`${b}:${f.key}`)?.getBoundingClientRect();
        if (!ra || !rb) continue;
        const x1 = ra.right - box.left + 2;
        const y1 = ra.top + ra.height / 2 - box.top + root.scrollTop;
        const x2 = rb.left - box.left - 2;
        const y2 = rb.top + rb.height / 2 - box.top + root.scrollTop;
        const dx = (x2 - x1) * 0.55;
        out.push({
          key: `${a}-${b}-${f.key}`,
          field: f.key,
          d: `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
          ok: valueOf(a, f.key) === valueOf(b, f.key),
        });
      }
    }
    setLinks(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, docsVerified]);

  useLayoutEffect(() => {
    measure();
    const root = stage.current;
    if (!root) return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    window.addEventListener('resize', measure);
    // Follow the modal's entrance animation for its first half-second.
    let raf = 0;
    const until = performance.now() + 700;
    const follow = () => {
      measure();
      if (performance.now() < until) raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  const register = (doc: XrayDocId, field: XrayFieldKey) => (el: HTMLElement | null) => {
    const k = `${doc}:${field}`;
    if (el) rows.current.set(k, el);
    else rows.current.delete(k);
  };

  const resolve = async () => {
    setScanning(true);
    await new Promise((r) => setTimeout(r, 1400));
    await resolveDocs();
    setScanning(false);
  };

  return (
    <>
      <header className="hairline flex items-center gap-3 border-b px-6 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cobalt to-[#7c9bff] text-white shadow-[0_6px_16px_-6px_rgb(37_99_235/0.8)]">
          <FileSearch size={17} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[16px] font-semibold text-ink">AI Document X-Ray</div>
          <div className="text-[11.5px] text-muted">
            Field-level reconciliation across Commercial Invoice, Packing List and e-Bill of Lading · viewing as{' '}
            <span className="font-semibold text-ink">{ROLES[role].label}</span>
          </div>
        </div>
        <Chip tone={mismatches ? 'crimson' : 'emerald'} className="!text-[11px]">
          {mismatches ? `${mismatches} discrepancy` : 'All key fields verified'}
        </Chip>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-slate-900/5 hover:text-ink" aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div ref={stage} className="scroll-quiet relative min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-[#f6f8fc] to-[#eef3fa] px-6 py-6">
        <svg className="pointer-events-none absolute top-0 left-0 z-10" width={size.w} height={size.h} aria-hidden>
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          {links.map((l) => {
            const color = l.ok ? PALETTE.emerald : PALETTE.crimson;
            return (
              <g key={l.key}>
                <motion.path
                  d={l.d}
                  stroke={color}
                  strokeWidth={l.ok ? 4 : 7}
                  fill="none"
                  opacity={0.18}
                  filter="url(#glow)"
                  initial={false}
                  animate={{ opacity: l.ok ? 0.14 : [0.15, 0.45, 0.15] }}
                  transition={l.ok ? { duration: 0.4 } : { duration: 1.4, repeat: Infinity }}
                />
                <motion.path
                  d={l.d}
                  stroke={color}
                  strokeWidth={l.ok ? 1.6 : 2.2}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={l.ok ? '0' : '6 5'}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1, strokeDashoffset: l.ok ? 0 : [0, -22] }}
                  transition={{ pathLength: { duration: 0.6, ease: 'easeOut' }, strokeDashoffset: { duration: 0.8, repeat: Infinity, ease: 'linear' } }}
                />
              </g>
            );
          })}
        </svg>

        <AnimatePresence>
          {scanning && (
            <motion.div
              className="pointer-events-none absolute inset-y-0 z-20 w-40 bg-gradient-to-r from-transparent via-cobalt/15 to-transparent"
              initial={{ left: '-10%' }}
              animate={{ left: '100%' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>

        <div className="relative grid grid-cols-1 gap-6 min-[860px]:grid-cols-3 min-[860px]:gap-[72px]">
          <PaperCard
            title="Commercial Invoice"
            refNo="DPC/EXP/26-27/0482"
            issuer={SHIPMENT.shipper}
            access={access('ci')}
            restriction={DOCUMENTS[0].restriction}
            accent={PALETTE.cobalt}
          >
            <KeyFields doc="ci" register={register} valueOf={valueOf} docsVerified={docsVerified} />
            <Extra label="Incoterm" value={SHIPMENT.incoterm} />
            <Extra label="Invoice value" value={`USD ${SHIPMENT.invoiceValueUsd.toLocaleString()}.00`} redacted={access('ci') === 'redacted'} />
            <Extra label="Unit price" value="USD 129.46 / pc · 1,440 pcs" redacted={access('ci') === 'redacted'} />
            <Extra label="Net weight" value="11,620 kg" />
          </PaperCard>

          <PaperCard title="Packing List" refNo="PL-0482" issuer={SHIPMENT.shipper} access={access('pl')} accent={PALETTE.violet}>
            <KeyFields doc="pl" register={register} valueOf={valueOf} docsVerified={docsVerified} />
            <Extra label="Packages" value="36 pallets · 1,440 pcs" />
            <Extra label="Pallet tare" value="36 × 34.2 kg" />
            <Extra label="Net weight" value="11,620 kg" />
            <Extra label="Dimensions" value="1.2 × 1.0 × 1.05 m" />
          </PaperCard>

          <PaperCard
            title="e-Bill of Lading"
            refNo="KMOL-047W-0482"
            issuer="Arabian Gateway Logistics (as agent)"
            access={access('ebl')}
            restriction={DOCUMENTS[2].restriction}
            accent={PALETTE.sky}
            stamp={docsVerified && eblHash ? <ShaStamp hash={eblHash} /> : null}
          >
            <KeyFields doc="ebl" register={register} valueOf={valueOf} docsVerified={docsVerified} />
            <Extra label="Vessel / voyage" value={`${SHIPMENT.vessel} ${SHIPMENT.voyage}`} />
            <Extra label="POL → POD" value="INNSA → NLRTM" />
            <Extra label="Seal" value={SHIPMENT.seal} />
            <Extra label="Freight" value="Prepaid" />
          </PaperCard>
        </div>
      </div>

      <footer className="hairline flex flex-wrap items-center gap-4 border-t bg-white/70 px-6 py-4">
        <AnimatePresence mode="wait" initial={false}>
          {!docsVerified ? (
            <motion.div key="issue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 flex-1 items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cobalt/10 text-cobalt">
                <Sparkles size={15} />
              </span>
              <div className="min-w-0 text-[12px] leading-snug">
                <div className="font-semibold text-ink">
                  Gross weight mismatch:{' '}
                  <span className="num text-crimson">
                    {XRAY_FIX.from} (CI) vs {XRAY_FIX.to} (PL, e-BL)
                  </span>{' '}
                  <span className="font-medium text-muted">· {Math.round(XRAY_FIX.confidence * 100)}% confidence</span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-muted">{XRAY_FIX.rationale}</div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald/10 text-emerald">
                <BadgeCheck size={16} />
              </span>
              <div className="text-[12px] leading-snug">
                <div className="font-semibold text-ink">Documents re-synced. Customs clearance is unlocked.</div>
                <div className="num text-[11px] text-muted">
                  e-BL sha256 {eblHash?.slice(0, 24)}… · sealed {formatStamp(useShipment.getState().nowH)} IST
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!docsVerified ? (
          canAmend ? (
            <Button tone="primary" onClick={resolve} disabled={scanning} className="!h-10 !px-4">
              {scanning ? <ScanLine size={15} className="animate-pulse" /> : <Sparkles size={15} />}
              {scanning ? 'Reconciling…' : 'Resolve with AI & Re-Sync'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="max-w-[220px] text-[11px] leading-snug text-muted">Only the Exporter or Customs Broker can amend the invoice.</span>
              <Button tone="secondary" onClick={() => setRole('broker')}>
                Switch to Customs Broker <ArrowRight size={13} />
              </Button>
            </div>
          )
        ) : (
          <Button
            tone="success"
            className="!h-10 !px-4"
            onClick={() => {
              setRole('broker');
              onClose();
            }}
          >
            Continue to Customs Clearance <ArrowRight size={14} />
          </Button>
        )}
      </footer>
    </>
  );
}

function PaperCard({
  title,
  refNo,
  issuer,
  access,
  restriction,
  accent,
  stamp,
  children,
}: {
  title: string;
  refNo: string;
  issuer: string;
  access: Access;
  restriction?: string;
  accent: string;
  stamp?: ReactNode;
  children: ReactNode;
}) {
  if (access === 'none') {
    return (
      <div className="paper relative grid min-h-[420px] place-items-center rounded-2xl p-6 text-center">
        <div>
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-slate-900/5 text-muted">
            <Lock size={17} />
          </span>
          <div className="mt-3 text-[13px] font-semibold text-ink">{title}</div>
          <div className="mt-1 max-w-[240px] text-[11.5px] leading-snug text-muted">{restriction ?? 'Not shared with your role.'}</div>
          <div className="mt-3">
            <Chip tone="slate">
              <Lock size={9} /> RBAC: no access
            </Chip>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="paper relative rounded-2xl">
      <div className="h-1 rounded-t-2xl" style={{ background: accent }} />
      <div className="px-5 pt-4 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.16em] uppercase" style={{ color: accent }}>
              {title}
            </div>
            <div className="num mt-0.5 text-[12.5px] font-semibold text-ink">{refNo}</div>
            <div className="mt-0.5 text-[10.5px] text-muted">{issuer}</div>
          </div>
          {access === 'redacted' && (
            <Chip tone="amber">
              <Lock size={9} /> pricing redacted
            </Chip>
          )}
        </div>
        <div className="mt-4 space-y-1">{children}</div>
      </div>
      {stamp}
    </div>
  );
}

function KeyFields({
  doc,
  register,
  valueOf,
  docsVerified,
}: {
  doc: XrayDocId;
  register: (d: XrayDocId, f: XrayFieldKey) => (el: HTMLElement | null) => void;
  valueOf: (d: XrayDocId, f: XrayFieldKey) => string;
  docsVerified: boolean;
}) {
  return (
    <div className="mb-3 space-y-1">
      {XRAY_LAYOUT[doc].map((key) => {
        const f = XRAY_FIELDS.find((x) => x.key === key)!;
        const value = valueOf(doc, f.key);
        const bad = !docsVerified && f.key === XRAY_FIX.field && (doc === 'ci' || doc === 'pl');
        const fixed = docsVerified && doc === XRAY_FIX.doc && f.key === XRAY_FIX.field;
        return (
          <motion.div
            key={f.key}
            ref={register(doc, f.key)}
            className="relative rounded-lg px-2.5 py-1.5"
            animate={{
              backgroundColor: bad ? 'rgba(220,38,38,0.07)' : fixed ? 'rgba(5,150,105,0.08)' : 'rgba(15,23,42,0.025)',
              boxShadow: bad ? 'inset 0 0 0 1px rgba(220,38,38,0.35)' : fixed ? 'inset 0 0 0 1px rgba(5,150,105,0.35)' : 'inset 0 0 0 1px rgba(15,23,42,0.05)',
            }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-[9.5px] font-semibold tracking-[0.1em] text-subtle uppercase">{f.label}</div>
            <div className={`truncate text-[12.5px] font-semibold ${f.key === 'consignee' ? '' : 'num'}`} style={{ color: bad ? PALETTE.crimson : PALETTE.ink }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={value}
                  initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8 }}
                  className="inline-block"
                >
                  {value}
                </motion.span>
              </AnimatePresence>
              {fixed && <span className="num ml-2 text-[10.5px] font-medium text-subtle line-through">{XRAY_FIX.from}</span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Extra({ label, value, redacted }: { label: string; value: string; redacted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-900/[0.07] px-1 py-1 text-[11px]">
      <span className="text-muted">{label}</span>
      {redacted ? (
        <span className="h-3 w-24 rounded-sm bg-slate-900/80" aria-label="redacted" />
      ) : (
        <span className="num truncate font-medium text-ink">{value}</span>
      )}
    </div>
  );
}

function ShaStamp({ hash }: { hash: string }) {
  return (
    <motion.div
      initial={{ scale: 2.2, opacity: 0, rotate: -24 }}
      animate={{ scale: 1, opacity: 1, rotate: -9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }}
      className="absolute top-3 right-4 rounded-xl border-2 border-emerald px-2.5 py-1.5 text-emerald shadow-[0_4px_14px_-6px_rgb(5_150_105/0.6)]"
      style={{ background: 'rgb(236 253 245 / 0.9)' }}
    >
      <div className="flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase">
        <BadgeCheck size={13} /> SHA-256 Verified
      </div>
      <div className="num mt-0.5 text-[9px] font-medium">
        {hash.slice(0, 16)}…{hash.slice(-6)}
      </div>
    </motion.div>
  );
}
