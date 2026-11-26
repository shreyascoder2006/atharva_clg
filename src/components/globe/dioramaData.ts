import { latLonToVector3, type LatLon } from '@/lib/geo';

export interface DioramaLabel {
  text: string;
  /** Local position: x along the quay, z towards the water. */
  at: [number, number];
  tone?: 'crimson' | 'amber' | 'emerald';
}

export interface DioramaDef {
  id: string;
  at: LatLon;
  /** Quay direction, degrees clockwise from north, chosen so the water is on its right. */
  bearing: number;
  kind: 'terminal' | 'canal';
  labels: DioramaLabel[];
}

export const DIORAMAS: DioramaDef[] = [
  {
    id: 'jnpt',
    at: [18.948, 72.945],
    bearing: 185,
    kind: 'terminal',
    labels: [
      { text: 'Berth 4 · JNPT', at: [0.4, 0.55] },
      { text: 'Gate-In Lane', at: [1.95, -1.85] },
      { text: 'Customs Yard', at: [-1.6, -1.55], tone: 'amber' },
    ],
  },
  {
    id: 'mundra',
    at: [22.742, 69.705],
    bearing: 78,
    kind: 'terminal',
    labels: [
      { text: 'Berth 2 · MICT Mundra', at: [0.4, 0.55] },
      { text: 'Gate-In Lane', at: [1.95, -1.85] },
      { text: 'Customs Yard · RMS', at: [-1.6, -1.55], tone: 'crimson' },
    ],
  },
  {
    id: 'rotterdam',
    at: [51.955, 4.04],
    bearing: 196,
    kind: 'terminal',
    labels: [
      { text: 'Maasvlakte II · Berth 7', at: [0.4, 0.55] },
      { text: 'Rail Terminal', at: [1.95, -1.85] },
      { text: 'Customs Yard', at: [-1.6, -1.55], tone: 'amber' },
    ],
  },
  {
    id: 'jebelAli',
    at: [25.012, 55.045],
    bearing: 225,
    kind: 'terminal',
    labels: [
      { text: 'Terminal 3 · Berth 12', at: [0.4, 0.55] },
      { text: 'Gate-In Lane', at: [1.95, -1.85] },
      { text: 'Free Zone Yard', at: [-1.6, -1.55], tone: 'emerald' },
    ],
  },
  {
    id: 'suez',
    at: [30.58, 32.3],
    bearing: 3,
    kind: 'canal',
    labels: [
      { text: 'Suez Canal · Northbound Convoy', at: [1.6, 0.0] },
      { text: 'Ismailia Transit Lane', at: [-1.4, -0.9] },
      { text: 'Bypass Channel', at: [-0.2, 1.15] },
    ],
  },
];

/** Shared with the vehicles, so a shipment's own ship can make way for the berthed model. */
export const dioramaState = DIORAMAS.map((d) => ({ id: d.id, position: latLonToVector3(d.at[0], d.at[1], 1), fade: 0 }));
