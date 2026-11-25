import { lazy, Suspense, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { GlobeScene } from '@/components/globe/GlobeScene';
import { CoPilot } from '@/components/hud/CoPilot';
import { LensCard, LensDock } from '@/components/hud/LensDock';
import { Timeline } from '@/components/hud/Timeline';
import { Toasts } from '@/components/hud/Toasts';
import { RoleSwitcher, ShipmentCard, Toolbar } from '@/components/hud/TopBar';
import { WorkspacePanel } from '@/components/hud/WorkspacePanel';
import { GlobeOverlay } from '@/components/overlay/GlobeOverlay';
import { DriverPhone } from '@/components/phone/DriverPhone';
import { DocXrayModal } from '@/components/xray/DocXrayModal';
import { ROLE_ORDER, ULIP } from '@/data/shipment';
import { useShipment } from '@/store/shipment';

// The twin has its own Canvas, grid and orbit controls: load it on the first dive.
const CargoTwinModal = lazy(() => import('@/components/twin/CargoTwinModal').then((m) => ({ default: m.CargoTwinModal })));

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

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, [role="slider"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useShipment.getState();
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
  const disruption = useShipment((s) => s.disruption);
  const twin = useShipment((s) => s.twin);
  const twinLoaded = useShipment((s) => s.twinLoaded);

  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);
  useUlipStream();
  useShortcuts();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <motion.div
        className="absolute inset-0"
        animate={{ scale: twin === 'open' ? 1.04 : 1, filter: twin === 'open' ? 'blur(6px)' : 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlobeScene />
        <GlobeOverlay />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Left column: shipment summary, lens dock, and lens card or Co-Pilot. */}
        <div className="absolute top-4 bottom-[200px] left-4 flex flex-col gap-3">
          <ShipmentCard collapsed={!!disruption} />
          <div className="flex min-h-0 items-start gap-2">
            <LensDock />
            <div className="pointer-events-auto min-h-0 rounded-[22px]">
              <AnimatePresence mode="wait" initial={false}>
                {disruption ? (
                  <CoPilot key="copilot" />
                ) : (
                  <motion.div key="lens" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <LensCard />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Top bar: the role switcher centres in whatever space the toolbar leaves. */}
        <div className="absolute top-4 right-4 left-[372px] flex items-start gap-3">
          <div className="flex min-w-0 flex-1 justify-center">
            <RoleSwitcher />
          </div>
          <Toolbar />
        </div>
        <div className="absolute top-[72px] right-[416px] left-[372px] flex justify-center max-[1099px]:right-4">
          <Toasts />
        </div>

        <WorkspacePanel />

        <div className="absolute right-[416px] bottom-4 left-[84px] max-[1099px]:right-4">
          <Timeline />
        </div>
      </div>

      <DriverPhone />
      <DocXrayModal />
      {twinLoaded && (
        <Suspense fallback={null}>
          <CargoTwinModal />
        </Suspense>
      )}
    </div>
  );
}
