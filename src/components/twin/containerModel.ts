import { Vector3 } from 'three';

import { PALETTE } from '@/lib/palette';

/** 40' High Cube interior, metres. x = length, y = height, z = width. */
export const BOX = { L: 12.03, H: 2.69, W: 2.35 };
export const PALLET = { l: 1.2, w: 1.0, base: 0.144, cargo: 0.92 };
const ROWS = 9;

export type PalletStatus = 'cleared' | 'pending' | 'variance' | 'flagged';

export const STATUS_COLOR: Record<PalletStatus, string> = {
  cleared: PALETTE.emerald,
  pending: PALETTE.amber,
  variance: PALETTE.amber,
  flagged: PALETTE.crimson,
};

export function palletPositions(): Vector3[] {
  const out: Vector3[] = [];
  const x0 = -BOX.L / 2 + 0.12 + PALLET.l / 2;
  for (let r = 0; r < ROWS; r++) {
    for (let side = 0; side < 2; side++) {
      for (let tier = 0; tier < 2; tier++) {
        const x = x0 + r * (PALLET.l + 0.04);
        const z = (side === 0 ? -1 : 1) * (PALLET.w / 2 + 0.07);
        const y = tier * (PALLET.base + PALLET.cargo + 0.02);
        out.push(new Vector3(x, y, z));
      }
    }
  }
  return out;
}

export const SENSORS = [
  { id: 'temp', label: 'Temp / RH', at: new Vector3(BOX.L / 2 - 0.6, BOX.H - 0.12, 0), color: PALETTE.cobalt },
  { id: 'shock', label: 'Shock / tilt', at: new Vector3(0.2, 0.06, 0), color: PALETTE.violet },
  { id: 'seal', label: 'e-Seal', at: new Vector3(BOX.L / 2 + 0.02, BOX.H * 0.55, 0.12), color: PALETTE.emerald },
] as const;
