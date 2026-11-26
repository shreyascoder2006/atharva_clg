import { lazy, Suspense, useEffect, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { GlobeScene } from '@/components/globe/GlobeScene';
import { globeShadow } from '@/components/globe/shadowRef';
import { CoPilot } from '@/components/hud/CoPilot';
import { LensDock, SidebarCard } from '@/components/hud/LensDock';
import { Timeline } from '@/components/hud/Timeline';
import { Toasts } from '@/components/hud/Toasts';
import { RoleSwitcher, ShipmentCard, Toolbar } from '@/components/hud/TopBar';
import { WorkspacePanel } from '@/components/hud/WorkspacePanel';
import { GlobeOverlay } from '@/components/overlay/GlobeOverlay';
import { DriverPhone } from '@/components/phone/DriverPhone';
import { railOffset, useIsMobile } from '@/components/shell/layout';
import { Sidebar } from '@/components/shell/Sidebar';
import { DocXrayModal } from '@/components/xray/DocXrayModal';
import { ROLE_ORDER, ULIP } from '@/data/shipment';
import { pathForView, VIEWS, viewFromPath, type ViewId } from '@/lib/routes';
import { useShipment } from '@/store/shipment';

// The twin has its own Canvas, grid and orbit controls: load it on the first dive.
const CargoTwinModal = lazy(() => import('@/components/twin/CargoTwinModal').then((m) => ({ default: m.CargoTwinModal })));

// Each dashboard is its own chunk, prefetched once the globe is up.
const loaders = {
  shipments: () => import('@/components/pages/ShipmentsPage'),
  documents: () => import('@/components/pages/DocumentsPage'),
  partners: () => import('@/components/pages/PartnersPage'),
  comms: () => import('@/components/pages/CommsPage'),
  financials: () => import('@/components/pages/FinancialsPage'),
  integrations: () => import('@/components/pages/IntegrationsPage'),
} satisfies Record<Exclude<ViewId, 'tower'>, unknown>;

const PAGES = {
  shipments: lazy(loaders.shipments),
  documents: lazy(loaders.documents),
  partners: lazy(loaders.partners),
  comms: lazy(loaders.comms),
  financials: lazy(loaders.financials),
  integrations: lazy(loaders.integrations),
};

/** Connector chatter: every few seconds one ULIP API reports in and pulses its beam. */
function useUlipStream() {
  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      const c = ULIP[i % ULIP.length];
      const msg = c.messages[Math.floor(i / ULIP.length) % c.messages.length];
      useShipment.getState().pushUlip(c.id, msg);
      i++;
      timer = setTimeout(next, 5200 + ((i * 1777) % 3400));
    };
    timer = setTimeout(next, 2400);
    return () => clearTimeout(timer);
  }, []);
}

/** The workspace panel is an overlay below 1100px: close it whenever the window gets that narrow. */
function useResponsivePanel() {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1099px)');
    const sync = () => {
      const s = useShipment.getState();
      if (mq.matches && s.panelOpen) s.togglePanel();
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
}

/** Keeps the store's view and the address bar in step, both ways. */
function useRouteSync() {
  useEffect(() => {
    const onPop = () => useShipment.getState().setView(viewFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    // Normalise unknown paths to the Control Tower's.
    const v = useShipment.getState().view;
    if (window.location.pathname !== pathForView(v)) window.history.replaceState(null, '', pathForView(v) + window.location.search);
    const unsub = useShipment.subscribe((s, prev) => {
      if (s.view === prev.view) return;
      const path = pathForView(s.view);
      if (window.location.pathname !== path) window.history.pushState(null, '', path + window.location.search);
      document.title = s.view === 'tower' ? 'One Shipment · One Platform' : `${VIEWS.find((x) => x.id === s.view)?.label} · One Platform`;
    });
    return () => {
      window.removeEventListener('popstate', onPop);
      unsub();
    };
  }, []);
}

function usePrefetchPages() {
  useEffect(() => {
    const run = () => Object.values(loaders).forEach((load) => void load());
    const id = window.setTimeout(run, 2500);
    return () => window.clearTimeout(id);
  }, []);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [role="slider"], [contenteditable="true"]') || e.metaKey || e.ctrlKey) return;
      const s = useShipment.getState();
      // Alt/Option + 1–7 jumps between workspaces. e.code, because Option+digit types a symbol on macOS.
      const digit = /^Digit([1-7])$/.exec(e.code);
      if (e.altKey && digit) {
        e.preventDefault();
        s.setView(VIEWS[Number(digit[1]) - 1].id);
        return;
      }
      if (e.altKey) return;
      if (e.key === '[') {
        s.toggleNav();
        return;
      }
      if (e.key === 'Escape') {
        if (s.xrayOpen) s.setXray(false);
        else if (s.twin !== 'closed') s.closeTwin();
        else if (s.phoneOpen) s.setPhone(false);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && !s.xrayOpen && s.twin === 'closed') s.setRole(ROLE_ORDER[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  const tick = useShipment((s) => s.tick);
  const view = useShipment((s) => s.view);
  const collapsed = useShipment((s) => s.navCollapsed);
  const twinLoaded = useShipment((s) => s.twinLoaded);
  const mobile = useIsMobile();
  const tower = view === 'tower';

  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);
  useUlipStream();
  useShortcuts();
  useResponsivePanel();
  useRouteSync();
  usePrefetchPages();

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ '--rail': `${railOffset(collapsed, mobile)}px` } as CSSProperties}>
      {/* Control Tower. Never unmounted: hidden with CSS and its render loop paused, so
          coming back is instant, with the camera and scene exactly as they were. */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ opacity: tower ? 1 : 0, scale: tower ? 1 : 0.985 }}
        transition={{ duration: tower ? 0.42 : 0.26, ease: [0.16, 1, 0.3, 1] }}
        style={{ pointerEvents: tower ? 'auto' : 'none' }}
        aria-hidden={!tower}
        inert={!tower}
      >
        <ControlTower active={tower} />
      </motion.div>

      {/* Dashboards, right of the rail. The container itself is click-through: on the
          Control Tower it is empty and must not swallow the globe's drag, zoom and picking. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 left-[var(--rail)] transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
        <AnimatePresence initial={false}>
          {!tower && (
            <motion.main
              key={view}
              className="pointer-events-auto absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_8%,#FAFCFF_0%,#F1F6FC_46%,#E6EFFA_100%)]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
            >
              <Suspense fallback={<PageSkeleton />}>
                <Page view={view} />
              </Suspense>
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      <Sidebar />

      {/* Toasts float above whichever workspace is showing. */}
      <div
        className={
          tower
            ? 'pointer-events-none absolute top-[72px] right-[416px] left-[calc(var(--rail)+372px)] z-40 flex justify-center max-[1099px]:right-4 max-md:top-[124px] max-md:left-[calc(var(--rail)+16px)]'
            : 'pointer-events-none absolute right-6 bottom-6 z-40 flex justify-end max-md:right-4 max-md:left-[calc(var(--rail)+16px)]'
        }
      >
        <Toasts />
      </div>

      <DocXrayModal />
      {twinLoaded && (
        <Suspense fallback={null}>
          <CargoTwinModal />
        </Suspense>
      )}
    </div>
  );
}

function Page({ view }: { view: Exclude<ViewId, 'tower'> }) {
  const C = PAGES[view];
  return <C />;
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1480px] px-6 pt-6">
      <div className="h-3 w-32 animate-pulse rounded bg-slate-900/[0.06]" />
      <div className="mt-3 h-6 w-80 animate-pulse rounded bg-slate-900/[0.06]" />
      <div className="mt-6 grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-[20px] bg-white/70" />
        ))}
      </div>
    </div>
  );
}

function ControlTower({ active }: { active: boolean }) {
  const disruption = useShipment((s) => s.disruption);
  const twin = useShipment((s) => s.twin);
  // An open rail takes 168px from the top bar: drop the inactive role labels.
  const railOpen = !useShipment((s) => s.navCollapsed);
  return (
    <>
      <motion.div
        className="absolute inset-0"
        animate={{ scale: twin === 'open' ? 1.04 : 1, filter: twin === 'open' ? 'blur(6px)' : 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Diffused contact shadow, behind the transparent canvas; placed per frame. */}
        <div
          ref={(el) => {
            globeShadow.current = el;
          }}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 rounded-[50%] opacity-0 blur-[14px] will-change-transform"
          style={{ background: 'radial-gradient(closest-side, rgba(15,23,42,0.20), rgba(15,23,42,0.08) 55%, rgba(15,23,42,0) 100%)' }}
        />
        <GlobeScene active={active} />
        <GlobeOverlay />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Left column, right of the rail: shipment summary, lens dock, and the sidebar card or Co-Pilot. */}
        <div className="absolute top-4 bottom-[200px] left-[calc(var(--rail)+16px)] flex flex-col gap-3 transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] max-md:top-[68px] max-sm:bottom-[132px]">
          <ShipmentCard collapsed={!!disruption} />
          <div className="flex min-h-0 items-start gap-2">
            <LensDock />
            <div className="pointer-events-auto min-h-0 rounded-[22px]">
              <AnimatePresence mode="wait" initial={false}>
                {disruption ? (
                  <CoPilot key="copilot" />
                ) : (
                  <motion.div key="lens" className="max-md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <SidebarCard />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Top bar: the role switcher centres in whatever space the toolbar leaves. */}
        <div className="absolute top-4 right-4 left-[calc(var(--rail)+372px)] flex items-start gap-3 transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] max-md:left-[calc(var(--rail)+16px)]">
          <div className="flex min-w-0 flex-1 justify-center">
            <RoleSwitcher compact={railOpen} />
          </div>
          <Toolbar />
        </div>

        <WorkspacePanel />

        <div className="absolute right-[416px] bottom-4 left-[calc(var(--rail)+84px)] transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] max-[1099px]:right-4">
          <Timeline />
        </div>
      </div>

      <DriverPhone />
    </>
  );
}
