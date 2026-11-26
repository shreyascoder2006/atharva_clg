/**
 * Unified comms: one channel per live shipment plus a customs alert stream.
 *
 * Messages carry structured chips (milestones, documents, escrow, ETAs) so a thread
 * reads like the shipment's record rather than a WhatsApp group. All names and
 * numbers are fictional, as in shipment.ts.
 */
import type { Tone } from '@/lib/palette';
import type { Role, ShipmentId, UlipId } from './shipment';

export type ChannelId = 'shp-0482' | 'shp-0519' | 'shp-0494' | 'customs';

export interface ChannelDef {
  id: ChannelId;
  name: string;
  /** The shipment the channel belongs to; the customs stream spans all of them. */
  shipment: ShipmentId | null;
  topic: string;
}

export const CHANNELS: ChannelDef[] = [
  { id: 'shp-0482', name: '#SHP-2611-0482-Duisburg', shipment: 'SHP-2611-0482', topic: 'Chakan → JNPT → Rotterdam → Duisburg · MV Konkan Meridian 047W' },
  { id: 'shp-0519', name: '#SHP-2611-0519-Frankfurt', shipment: 'SHP-2611-0519', topic: 'Bengaluru → Frankfurt · SKB 761 · 2–8 °C cold chain' },
  { id: 'shp-0494', name: '#SHP-2611-0494-JebelAli', shipment: 'SHP-2611-0494', topic: 'Surat → Mundra → Jebel Ali · MV Kutch Pioneer 112E' },
  { id: 'customs', name: '#Customs-Alerts', shipment: null, topic: 'ICEGATE RMS orders, holds and LEOs across the book' },
];

export const CHANNEL_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c])) as Record<ChannelId, ChannelDef>;

export const CHANNEL_FOR: Record<ShipmentId, ChannelId> = {
  'SHP-2611-0482': 'shp-0482',
  'SHP-2611-0519': 'shp-0519',
  'SHP-2611-0494': 'shp-0494',
};

export type Author = Role | 'ai' | 'system' | UlipId;

export type ChipKind = 'milestone' | 'doc' | 'escrow' | 'eta' | 'alert' | 'hash';

export interface MsgChip {
  kind: ChipKind;
  label: string;
  tone: Tone;
}

export interface ChatMessage {
  id: number;
  channel: ChannelId;
  author: Author;
  /** Which shipment's party is speaking, for the cross-shipment customs channel. */
  shipment: ShipmentId | null;
  text: string;
  h: number;
  chips?: MsgChip[];
  /** Arrived from the driver's magic-link app rather than the platform. */
  via?: 'driver-app';
  /** Typed in this browser, by whoever holds the active role. */
  mine?: boolean;
}

export type SeedMessage = Omit<ChatMessage, 'id'>;

const ms = (label: string, tone: Tone = 'emerald'): MsgChip => ({ kind: 'milestone', label, tone });
const docChip = (label: string, tone: Tone = 'cobalt'): MsgChip => ({ kind: 'doc', label, tone });
const alert = (label: string, tone: Tone = 'crimson'): MsgChip => ({ kind: 'alert', label, tone });

const F = 'SHP-2611-0482' as const;
const A = 'SHP-2611-0519' as const;
const S = 'SHP-2611-0494' as const;

export const SEED_MESSAGES: SeedMessage[] = [
  // --- 0482 ----------------------------------------------------------------------
  { channel: 'shp-0482', author: 'exporter', shipment: F, h: -46, text: 'Commercial Invoice is out. Same lane as the October lot: 36 pallets of gearbox housings.', chips: [docChip('CI · DPC/EXP/26-27/0482')] },
  { channel: 'shp-0482', author: 'forwarder', shipment: F, h: -40, text: "Booked on MV Konkan Meridian 047W, one 40' HC. Cutoff is tomorrow afternoon.", chips: [ms('Booking confirmed · 047W')] },
  { channel: 'shp-0482', author: 'exporter', shipment: F, h: -8, text: 'Stuffed and e-sealed at Chakan, seal ES-8842117.', chips: [ms('Stuffed & e-sealed')] },
  { channel: 'shp-0482', author: 'broker', shipment: F, h: -6, text: 'Shipping Bill filed on ICEGATE. I assess as soon as the box gates in.', chips: [docChip('SB 4471823')] },
  {
    channel: 'shp-0482',
    author: 'ai',
    shipment: F,
    h: -2.5,
    text: 'Document X-Ray found a gross weight mismatch: the invoice says 12,400 kg, the Packing List and e-BL draft say 12,850 kg. LEO is blocked until the invoice is amended.',
    chips: [alert('Gross weight mismatch'), docChip('PL-0482')],
  },
  { channel: 'shp-0482', author: 'broker', shipment: F, h: -2.2, text: "Exporter, can you amend the invoice? I can't file for LEO with that gap on the record." },
  { channel: 'shp-0482', author: 'transporter', shipment: F, h: -0.3, via: 'driver-app', text: 'Left Chakan in MH12 TX 4471, on the expressway to JNPT Gate 4.', chips: [ms('Truck departed Chakan', 'violet')] },

  // --- 0519 ----------------------------------------------------------------------
  { channel: 'shp-0519', author: 'exporter', shipment: A, h: -30, text: 'Batch KB-2611 released by QA. Certificate of Analysis is in the vault.', chips: [docChip('CoA-KBL-2611')] },
  { channel: 'shp-0519', author: 'transporter', shipment: A, h: -11, via: 'driver-app', text: 'Reefer pre-cooled to 5.0 °C, loading at Electronic City now.', chips: [ms('Pre-cool complete', 'violet')] },
  { channel: 'shp-0519', author: 'broker', shipment: A, h: -8, text: 'Air cargo LEO granted on SB 5508371.', chips: [ms('LEO granted')] },
  { channel: 'shp-0519', author: 'forwarder', shipment: A, h: -5.5, text: 'Two PMCs built and screened. SKB 761 is on time.', chips: [ms('ULD built · 2 × PMC')] },
  { channel: 'shp-0519', author: 'ai', shipment: A, h: -4, text: 'SKB 761 is airborne. The logger reads 4.6 °C, inside the 2–8 °C band.', chips: [ms('Departed BLR', 'sky'), { kind: 'eta', label: 'Cold chain nominal', tone: 'emerald' }] },

  // --- 0494 ----------------------------------------------------------------------
  { channel: 'shp-0494', author: 'exporter', shipment: S, h: -20, text: '288 cases of FDY dispatched from Sachin GIDC.', chips: [ms('Dispatched · Surat')] },
  { channel: 'shp-0494', author: 'transporter', shipment: S, h: -10, via: 'driver-app', text: 'Gated in at Mundra MICT, Gate 2.', chips: [ms('Gate-in · Mundra', 'violet')] },
  {
    channel: 'shp-0494',
    author: 'broker',
    shipment: S,
    h: -6,
    text: 'RMS ordered an examination. The scanner density reads like textured yarn (5402.33); we declared FDY (5402.47).',
    chips: [alert('RMS examination'), docChip('SB 5512094')],
  },
  { channel: 'shp-0494', author: 'forwarder', shipment: S, h: -5, text: "I'm holding the 112E slot. If LEO misses the cutoff, the box rolls 48 hours.", chips: [alert('Cutoff at risk', 'amber')] },
  { channel: 'shp-0494', author: 'ai', shipment: S, h: -4, text: 'A classification brief is drafted: lustre, denier and draw ratio all fit FDY. It is ready for the CHA to send.', chips: [docChip('AI brief · draft', 'violet')] },

  // --- Customs ---------------------------------------------------------------------
  { channel: 'customs', author: 'icegate', shipment: A, h: -8, text: 'SB 5508371 · LEO granted · BLR air cargo complex', chips: [ms('LEO')] },
  { channel: 'customs', author: 'icegate', shipment: S, h: -6, text: 'SB 5512094 · RMS examination order · Mundra', chips: [alert('Examination')] },
  { channel: 'customs', author: 'icegate', shipment: F, h: -5.8, text: 'SB 4471823 · filed · in the assessment queue at JNPT', chips: [docChip('SB 4471823')] },
  { channel: 'customs', author: 'ai', shipment: F, h: -2.5, text: 'Pre-assessment: SB 4471823 will be held on the weight mismatch unless the invoice is amended before gate-in.', chips: [alert('Likely hold', 'amber')] },
];
