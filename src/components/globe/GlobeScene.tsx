import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';

import { useShipment } from '@/store/shipment';
import { AnchorProjector } from './anchors';
import { Atmosphere } from './Atmosphere';
import { CameraRig } from './CameraRig';
import { CongestionPillars } from './CongestionPillars';
import { CorridorArcs } from './CorridorArcs';
import { FrameDriver } from './frame';
import { GlobeCore, Graticule, LandDots } from './LandDots';
import { PlaceLabels } from './PlaceLabels';
import { PortDioramas } from './PortDioramas';
import { VectorLines } from './VectorLines';
import { RoutePicker } from './RoutePicker';
import { ShipmentMarkers } from './ShipmentMarkers';
import { SonarField } from './SonarField';
import { StudioLights, ViewOffset } from './Studio';
import { UlipPulse } from './UlipPulse';

/**
 * The globe stage.
 *
 * The canvas is transparent so the CSS porcelain sweep behind it is the backdrop: no
 * starfield, no postprocessing. Bloom and vignette were removed with the dark theme;
 * on a light background they only wash the scene out, and dropping the composer
 * restores native MSAA for crisp arcs.
 *
 * `flat` disables tone mapping so material colours land on the same hex values as the
 * HUD tokens they are meant to match.
 */
export function GlobeScene() {
  const twinOpen = useShipment((s) => s.twin === 'open');

  return (
    <Canvas
      shadows="percentage"
      flat
      dpr={[1, 2]}
      frameloop={twinOpen ? 'never' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.002, far: 40, position: [0, 0, 4.6] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      aria-label="3D globe showing the shipment corridor"
    >
      <FrameDriver />
      <StudioLights />
      <ViewOffset />

      <Suspense fallback={null}>
        <GlobeCore />
        <Graticule />
        <LandDots />
        <VectorLines />
        <PortDioramas />
        <Atmosphere />
        <CongestionPillars />
        <CorridorArcs />
        <SonarField />
        <UlipPulse />
        <PlaceLabels />
        <ShipmentMarkers />
        {/* Last, so it projects labels after everything has moved this frame. */}
        <AnchorProjector />
      </Suspense>

      <CameraRig />
      <RoutePicker />
    </Canvas>
  );
}
