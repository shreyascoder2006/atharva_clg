import { useEffect } from 'react';

import { GlobeScene } from '@/components/globe/GlobeScene';
import { GlobeOverlay } from '@/components/overlay/GlobeOverlay';
import { useShipment } from '@/store/shipment';

export default function App() {
  const tick = useShipment((s) => s.tick);

  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  return (
    <div className="relative h-full w-full">
      <GlobeScene />
      <GlobeOverlay />
    </div>
  );
}
