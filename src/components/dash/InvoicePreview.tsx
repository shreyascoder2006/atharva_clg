import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, Fingerprint, Landmark, Receipt, X } from 'lucide-react';

import { INR_PER_USD } from '@/data/finance';
import { FLEET } from '@/data/fleet';
import { WATCH_BY_ID } from '@/data/portfolio';
import { ROLES, type ShipmentId } from '@/data/shipment';
import { formatStamp, formatUsd } from '@/lib/format';
import { sha256Hex } from '@/lib/hash';
import { TONE_HEX } from '@/lib/palette';
import { STATUS_TONE, type LedgerRow } from './ledger';

function lineFor(r: LedgerRow): string {
  const live = (FLEET as Record<string, (typeof FLEET)[ShipmentId] | undefined>)[r.shipment];
  const w = WATCH_BY_ID[r.shipment];
  const origin = live?.origin ?? w?.origin ?? '';
  const dest = live?.destination ?? w?.destination ?? '';
  const carrier = live?.carrier ?? w?.carrier ?? '';
  switch (r.category) {
    case 'Inland haulage':
      return `Pre-carriage ${origin} → port of loading · ${live?.unit.equipment ?? "40' HC"}`;
    case 'Customs & CHA':
      return `Export customs clearance · Shipping Bill filing and LEO · HS ${live?.hsCode ?? ''}`;
    case 'Freight':
      return `Freight forwarding ${origin} → ${dest} · ${carrier}`;
    case 'LC / CAD proceeds':
      return `Export proceeds · ${live?.cargo ?? ''} · ${live?.incoterm ?? ''}`;
    case 'Port & THC':
      return `Terminal handling and port charges · ${dest}`;
    case 'Demurrage':
      return `Demurrage and storage after a transhipment roll · ${carrier}`;
    default:
      return r.category;
  }
}

export function InvoicePreview({ row, onClose }: { row: LedgerRow | null; onClose: () => void }) {
  return createPortal(<AnimatePresence>{row && <Sheet key={row.id} row={row} onClose={onClose} />}</AnimatePresence>, document.body);
}

function Sheet({ row, onClose }: { row: LedgerRow; onClose: () => void }) {
  const inr = row.original.trim().startsWith('₹');
  const gross = inr ? Number(row.original.replace(/[^0-9.]/g, '')) : row.usd;
  const taxable = inr ? gross / 1.18 : gross;
  const tax = gross - taxable;
  const money = (n: number) => (inr ? `₹${Math.round(n).toLocaleString('en-IN')}` : formatUsd(n, true));
  const tone = STATUS_TONE[row.status];
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    let live = true;
    void sha256Hex(JSON.stringify(row)).then((h) => live && setHash(h));
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [row, onClose]);

  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-[#eef3f9]/70 backdrop-blur-md" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`Invoice ${row.id}`}
        initial={{ y: 18, scale: 0.98, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong relative flex max-h-[calc(100vh-32px)] w-[680px] max-w-full flex-col overflow-hidden rounded-[24px]"
      >
        <div className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.06)] px-5 py-3.5">
          <Receipt size={17} className="text-cobalt" />
          <div className="flex-1 leading-tight">
            <div className="text-[14px] font-semibold text-ink">Invoice preview</div>
            <div className="num text-[11px] text-muted">
              {row.id} · {row.shipment}
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-900/5 hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="scroll-quiet overflow-y-auto bg-gradient-to-b from-[#f6f8fc] to-[#eef3fa] p-5">
          <div className="paper relative overflow-hidden rounded-2xl p-6">
            <motion.div
              initial={{ scale: 1.8, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: -10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 }}
              className="absolute top-6 right-6 rounded-xl border-2 px-3 py-1 text-[13px] font-bold tracking-[0.14em] uppercase"
              style={{ color: TONE_HEX[tone], borderColor: TONE_HEX[tone], background: `color-mix(in oklab, ${TONE_HEX[tone]} 7%, white)` }}
            >
              {row.status}
            </motion.div>
            <div className="text-[10px] font-bold tracking-[0.18em] text-cobalt uppercase">Tax invoice</div>
            <div className="num mt-1 text-[18px] font-semibold text-ink">{row.id}</div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[11.5px] max-sm:grid-cols-1">
              <Party label="From" name={row.payee} sub={row.role ? `${ROLES[row.role].label} · ${row.shipment}` : row.shipment} />
              <Party label="Bill to" name={row.billTo} sub={inr ? 'GSTIN 27AAACD4471R1Z5 · Maharashtra' : 'Payment in USD'} />
              <Party label="Issued" name={formatStamp(row.dueH - 168).slice(0, 10)} sub="IST" />
              <Party label="Due" name={formatStamp(row.dueH).slice(0, 10)} sub={row.trigger ? `or on ${row.trigger}` : 'Net 15'} />
            </div>

            <table className="mt-5 w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="border-y border-[rgba(15,23,42,0.08)] text-left text-[9.5px] font-semibold tracking-[0.1em] text-subtle uppercase">
                  <th className="py-2 font-semibold">Description</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-dashed border-slate-900/10">
                  <td className="py-2.5 pr-4 text-ink">{lineFor(row)}</td>
                  <td className="num py-2.5 text-right font-semibold text-ink">{money(taxable)}</td>
                </tr>
                <tr>
                  <td className="pt-2 text-muted">{inr ? 'IGST 18%' : 'IGST 0% · zero-rated export of services (LUT)'}</td>
                  <td className="num pt-2 text-right text-muted">{money(tax)}</td>
                </tr>
                <tr>
                  <td className="pt-2 text-[13px] font-semibold text-ink">Total</td>
                  <td className="num pt-2 text-right text-[15px] font-semibold text-ink">{money(gross)}</td>
                </tr>
                {inr && (
                  <tr>
                    <td />
                    <td className="num pt-0.5 text-right text-[10.5px] text-subtle">
                      ≈ {formatUsd(row.usd, true)} at ₹{INR_PER_USD}/US$
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-900/[0.03] p-3 text-[11px] text-muted">
              <Landmark size={14} className="mt-px shrink-0 text-cobalt" />
              <span>
                {row.trigger
                  ? `Settled by smart escrow: funds lock at booking and release automatically on ${row.trigger}. No manual approval.`
                  : 'Settled by bank transfer against the shipment record.'}
                {row.status === 'Disputed' && ' Under dispute: the roll at Colombo was the carrier’s; the claim is with the line.'}
              </span>
            </div>
            <div className="num mt-4 flex items-center gap-1.5 border-t border-dashed border-slate-900/10 pt-3 text-[10px] text-muted">
              {row.status === 'Settled' ? <BadgeCheck size={12} className="text-emerald" /> : <Fingerprint size={12} className="text-cobalt" />}
              sha256 {hash ? `${hash.slice(0, 40)}…` : 'computing…'}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Party({ label, name, sub }: { label: string; name: string; sub: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold tracking-[0.1em] text-subtle uppercase">{label}</div>
      <div className="font-semibold text-ink">{name}</div>
      <div className="num text-[10.5px] text-muted">{sub}</div>
    </div>
  );
}
