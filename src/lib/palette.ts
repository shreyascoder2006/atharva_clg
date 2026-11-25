/**
 * JS-side mirror of the CSS tokens in index.css.
 *
 * WebGL materials cannot read CSS custom properties, so these values are duplicated.
 * If a token changes there, change it here too.
 */
export const PALETTE = {
  studio: '#F4F7FB',
  studio2: '#E6EEF8',
  ink: '#0F172A',
  muted: '#475569',
  subtle: '#94A3B8',

  ocean: '#D3E2F3',
  oceanDeep: '#C4D6EC',
  land: '#FAFBFD',
  coast: '#9DB0C8',
  rim: '#F2F7FE',
  halo: '#8FB8F2',

  cobalt: '#2563EB',
  emerald: '#059669',
  amber: '#D97706',
  crimson: '#DC2626',
  violet: '#7C3AED',
  sky: '#0284C7',
} as const;

export type Tone = 'cobalt' | 'emerald' | 'amber' | 'crimson' | 'violet' | 'sky' | 'slate';

export const TONE_HEX: Record<Tone, string> = {
  cobalt: PALETTE.cobalt,
  emerald: PALETTE.emerald,
  amber: PALETTE.amber,
  crimson: PALETTE.crimson,
  violet: PALETTE.violet,
  sky: PALETTE.sky,
  slate: PALETTE.muted,
};

/** Transport modes are told apart by hue; status is layered on top of them. */
export const MODE_HEX = {
  road: PALETTE.violet,
  rail: PALETTE.violet,
  sea: PALETTE.cobalt,
  air: PALETTE.sky,
} as const;
