import { useSyncExternalStore } from 'react';

/** Sidebar widths, px. On phones the rail becomes a bottom tab bar of NAV_BAR_MOBILE px. */
export const RAIL_COLLAPSED = 72;
export const RAIL_EXPANDED = 240;
export const RAIL_MOBILE = 0;
export const NAV_BAR_MOBILE = 64;
export const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

/** How far the content starts from the left edge: the rail's footprint. */
export function railOffset(collapsed: boolean, mobile: boolean): number {
  if (mobile) return RAIL_MOBILE;
  return collapsed ? RAIL_COLLAPSED : RAIL_EXPANDED;
}
