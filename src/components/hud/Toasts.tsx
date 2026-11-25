import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, Radio, TriangleAlert, X } from 'lucide-react';

import { ROLES } from '@/data/shipment';
import { TONE_HEX } from '@/lib/palette';
import { useShipment, type Toast } from '@/store/shipment';
import { RoleAvatar } from './ui';

export function Toasts() {
  const toasts = useShipment((s) => s.toasts);
  return (
    <div className="pointer-events-none flex w-[400px] max-w-[calc(100vw-32px)] flex-col items-center gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ t }: { t: Toast }) {
  const dismiss = useShipment((s) => s.dismissToast);
  const hex = TONE_HEX[t.tone];
  const Icon = t.broadcast ? Radio : t.tone === 'crimson' ? TriangleAlert : t.tone === 'emerald' ? CheckCircle2 : Info;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="glass-strong pointer-events-auto w-full overflow-hidden rounded-2xl"
    >
      <div className="flex items-start gap-2.5 p-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ color: hex, background: `color-mix(in oklab, ${hex} 12%, white)` }}>
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-ink">{t.title}</div>
          {t.body && <div className="mt-0.5 text-[11px] leading-snug text-muted">{t.body}</div>}
          {t.broadcast && (
            <div className="mt-2 flex items-center gap-1.5">
              {t.broadcast.map((r, i) => (
                <motion.span
                  key={r}
                  initial={{ opacity: 0.25, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.22, type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex items-center gap-1 rounded-full bg-white/80 py-0.5 pr-1.5 pl-0.5 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]"
                  title={`Delivered to ${ROLES[r].label}`}
                >
                  <RoleAvatar role={r} size={16} />
                  <CheckCircle2 size={10} className="text-emerald" />
                </motion.span>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => dismiss(t.id)} className="text-subtle transition-colors hover:text-ink" aria-label="Dismiss">
          <X size={13} />
        </button>
      </div>
      {t.broadcast && (
        <motion.div className="h-0.5 bg-cobalt" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 1.2, ease: 'easeOut' }} />
      )}
    </motion.div>
  );
}
