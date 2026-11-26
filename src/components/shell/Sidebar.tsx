import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronsLeft,
  ChevronsRight,
  Earth,
  FileCheck2,
  Handshake,
  Leaf,
  MessagesSquare,
  Package,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { Logo } from '@/components/hud/TopBar';
import { Dot, Kbd, RoleAvatar } from '@/components/hud/ui';
import { ROLE_ORDER, ROLES } from '@/data/shipment';
import { VIEWS, type ViewId } from '@/lib/routes';
import { TONE_HEX, type Tone } from '@/lib/palette';
import { partyOf, unreadCount, useShipment } from '@/store/shipment';
import { RAIL_COLLAPSED, RAIL_EXPANDED, RAIL_MOBILE, useIsMobile } from './layout';

const ICON: Record<ViewId, LucideIcon> = {
  tower: Earth,
  shipments: Package,
  documents: FileCheck2,
  partners: Handshake,
  comms: MessagesSquare,
  financials: Wallet,
  integrations: Leaf,
};

type Badge = { kind: 'dot'; tone: Tone; pulse?: boolean; label: string } | { kind: 'count'; n: number; label: string };

/** Live badges, straight from the store so every dashboard agrees with the rail. */
function useBadges(): Partial<Record<ViewId, Badge>> {
  const disruption = useShipment((s) => s.disruption);
  const hold = useShipment((s) => s.hold0494 === 'active');
  const docsVerified = useShipment((s) => s.docsVerified);
  const unread = useShipment((s) => unreadCount(s));
  const out: Partial<Record<ViewId, Badge>> = {};
  if (disruption) out.tower = { kind: 'dot', tone: 'crimson', pulse: true, label: 'Disruption live' };
  if (!docsVerified) out.documents = { kind: 'dot', tone: 'crimson', pulse: true, label: '1 document mismatch' };
  if (unread) out.comms = { kind: 'count', n: unread, label: `${unread} unread` };
  if (disruption || hold) out.financials = { kind: 'dot', tone: 'amber', label: 'Demurrage accruing' };
  return out;
}

/**
 * The persistent navigation rail: 72px of icons, or 240px with labels. On phones the
 * slim rail stays put and the expanded state slides over the content.
 */
export function Sidebar() {
  const view = useShipment((s) => s.view);
  const setView = useShipment((s) => s.setView);
  const collapsed = useShipment((s) => s.navCollapsed);
  const toggle = useShipment((s) => s.toggleNav);
  const mobile = useIsMobile();
  const badges = useBadges();
  const expanded = !collapsed;
  const width = expanded ? RAIL_EXPANDED : mobile ? RAIL_MOBILE : RAIL_COLLAPSED;

  return (
    <>
      <AnimatePresence>
        {mobile && expanded && (
          <motion.div
            className="absolute inset-0 z-40 bg-slate-900/10 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
          />
        )}
      </AnimatePresence>
      <motion.nav
        aria-label="Workspaces"
        className="absolute inset-y-0 left-0 z-50 flex flex-col border-r border-[rgba(15,23,42,0.08)] bg-white/85 py-3 shadow-[1px_0_0_rgb(255_255_255/0.6),8px_0_32px_-12px_rgb(15_23_42/0.12)] backdrop-blur-xl"
        initial={false}
        animate={{ width }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        {/* Brand. */}
        <div className="flex h-11 items-center gap-2.5 overflow-hidden px-[14px]" style={{ paddingLeft: mobile && !expanded ? 10 : 14 }}>
          <span className="shrink-0 [&>span]:h-10 [&>span]:w-10 [&>span]:rounded-xl">
            <Logo />
          </span>
          <Reveal show={expanded}>
            <div className="leading-tight whitespace-nowrap">
              <div className="text-[13.5px] font-semibold tracking-tight text-ink">One Platform</div>
              <div className="text-[10.5px] text-muted">Logistics operating system</div>
            </div>
          </Reveal>
        </div>

        <div className="mx-3 my-3 h-px bg-[rgba(15,23,42,0.08)]" />

        <Reveal show={expanded} className="shrink-0">
          <div className="eyebrow px-5 pb-1.5 whitespace-nowrap">Workspaces</div>
        </Reveal>

        <ul className="flex flex-col gap-1 px-3">
          {VIEWS.map((v, i) => (
            <li key={v.id}>
              <NavItem
                id={v.id}
                label={v.label}
                active={view === v.id}
                expanded={expanded}
                badge={badges[v.id]}
                shortcut={i + 1}
                onClick={() => {
                  setView(v.id);
                  if (mobile && expanded) toggle();
                }}
              />
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-2 px-3">
          <button
            onClick={toggle}
            className="group flex h-9 items-center gap-3 rounded-xl px-3 text-[12px] font-medium text-muted transition-colors hover:bg-slate-900/[0.04] hover:text-ink"
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={expanded}
            title={expanded ? 'Collapse sidebar ( [ )' : 'Expand sidebar ( [ )'}
          >
            <span className="grid w-6 shrink-0 place-items-center">{expanded ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}</span>
            <Reveal show={expanded}>
              <span className="flex flex-1 items-center justify-between whitespace-nowrap">
                Collapse <Kbd>[</Kbd>
              </span>
            </Reveal>
          </button>
          <div className="h-px bg-[rgba(15,23,42,0.08)]" />
          <RoleIndicator expanded={expanded} />
        </div>
      </motion.nav>
    </>
  );
}

/** Content that only exists while the rail is wide: fades in after the rail opens. */
function Reveal({ show, children, className = 'min-w-0 flex-1' }: { show: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className={`overflow-hidden ${className}`}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0, transition: { delay: 0.08, duration: 0.22 } }}
          exit={{ opacity: 0, x: -6, transition: { duration: 0.1 } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavItem({
  id,
  label,
  active,
  expanded,
  badge,
  shortcut,
  onClick,
}: {
  id: ViewId;
  label: string;
  active: boolean;
  expanded: boolean;
  badge?: Badge;
  shortcut: number;
  onClick: () => void;
}) {
  const Icon = ICON[id];
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={badge ? `${label} · ${badge.label}` : label}
      className="group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[12.5px] font-medium transition-colors"
      style={{ color: active ? '#0F172A' : '#475569' }}
    >
      {active && (
        <>
          <motion.span
            layoutId="nav-pill"
            className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.06),0_8px_20px_-10px_rgb(37_99_235/0.45),inset_0_0_0_1px_rgb(15_23_42/0.07)]"
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          />
          <motion.span
            layoutId="nav-bar"
            className="absolute top-2.5 -left-3 h-5 w-[3px] rounded-r-full bg-cobalt"
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          />
        </>
      )}
      {!active && <span className="absolute inset-0 rounded-xl transition-colors group-hover:bg-slate-900/[0.04]" />}

      <span className="relative grid w-6 shrink-0 place-items-center" style={{ color: active ? '#2563EB' : undefined }}>
        <Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
        {badge && !expanded && <IconBadge badge={badge} />}
      </span>

      <Reveal show={expanded}>
        <span className="relative flex items-center justify-between gap-2 whitespace-nowrap">
          <span className="truncate">{label}</span>
          {badge ? <RowBadge badge={badge} /> : <span className="num text-[10px] text-subtle opacity-0 transition-opacity group-hover:opacity-100">⌥{shortcut}</span>}
        </span>
      </Reveal>

      {/* Tooltip for the icon rail. */}
      {!expanded && (
        <span className="glass-strong pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 translate-x-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap text-ink opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 max-md:hidden">
          {label}
          {badge && <span className="ml-1.5 font-medium text-muted">· {badge.label}</span>}
        </span>
      )}
    </button>
  );
}

function IconBadge({ badge }: { badge: Badge }) {
  if (badge.kind === 'count')
    return (
      <span className="num absolute -top-2 -right-2.5 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-crimson px-1 text-[9.5px] font-bold text-white shadow-[0_0_0_2px_white]">
        {badge.n > 9 ? '9+' : badge.n}
      </span>
    );
  return (
    <span className="absolute -top-1 -right-1 rounded-full shadow-[0_0_0_2px_white]">
      <Dot tone={badge.tone} pulse={badge.pulse} size={7} />
    </span>
  );
}

function RowBadge({ badge }: { badge: Badge }) {
  if (badge.kind === 'count')
    return <span className="num grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crimson px-1.5 text-[10px] font-bold text-white">{badge.n}</span>;
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: TONE_HEX[badge.tone] }}>
      <Dot tone={badge.tone} pulse={badge.pulse} size={6} />
    </span>
  );
}

/** Who the user is acting as. Clicking opens a role menu; 1–4 also switch. */
function RoleIndicator({ expanded }: { expanded: boolean }) {
  const role = useShipment((s) => s.role);
  const setRole = useShipment((s) => s.setRole);
  // Select a primitive: partyOf builds a new object for reassigned forwarders.
  const person = useShipment((s) => partyOf(s.assignments, s.selected, s.role).person);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl px-[7px] py-1.5 text-left transition-colors hover:bg-slate-900/[0.04]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acting as ${ROLES[role].label}. Switch role`}
        title={`Acting as ${ROLES[role].label}`}
      >
        <RoleAvatar role={role} size={32} ring />
        <Reveal show={expanded}>
          <span className="block leading-tight whitespace-nowrap">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              {ROLES[role].label}
              <span className="rounded px-1 text-[9px] font-bold" style={{ color: TONE_HEX[ROLES[role].tone], background: `color-mix(in oklab, ${TONE_HEX[ROLES[role].tone]} 10%, transparent)` }}>
                {ROLES[role].short}
              </span>
            </span>
            <span className="block truncate text-[10.5px] text-muted">{person}</span>
          </span>
        </Reveal>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, x: -6, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass-strong absolute bottom-0 left-full z-50 ml-3 w-[250px] origin-bottom-left rounded-2xl p-1.5"
          >
            <div className="eyebrow px-2.5 pt-1.5 pb-1">Act as</div>
            {ROLE_ORDER.map((r, i) => (
              <button
                key={r}
                role="menuitemradio"
                aria-checked={r === role}
                onClick={() => {
                  setRole(r);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-900/[0.04]"
              >
                <RoleAvatar role={r} size={26} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[12px] font-semibold text-ink">{ROLES[r].label}</span>
                  <span className="block truncate text-[10.5px] text-muted">{ROLES[r].short} · role lens</span>
                </span>
                {r === role ? <Dot tone={ROLES[r].tone} size={7} /> : <Kbd>{i + 1}</Kbd>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
