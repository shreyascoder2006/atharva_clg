/** The moment the app loaded. Every schedule hour is relative to this. */
export const ANCHOR_MS = Date.now();

export const hourToDate = (h: number) => new Date(ANCHOR_MS + h * 3_600_000);

const clockFmt = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions) {
  const key = tz + JSON.stringify(opts);
  let f = clockFmt.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts });
    clockFmt.set(key, f);
  }
  return f;
}

/** "Wed 25 Nov, 18:44" in the given zone. */
export function formatStamp(h: number, tz = 'Asia/Kolkata'): string {
  return fmt(tz, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(hourToDate(h))
    .replace(',', '');
}

export function formatTime(h: number, tz = 'Asia/Kolkata', seconds = false): string {
  return fmt(tz, { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hour12: false }).format(
    hourToDate(h),
  );
}

export function formatDay(h: number, tz = 'Asia/Kolkata'): string {
  return fmt(tz, { day: '2-digit', month: 'short' }).format(hourToDate(h));
}

/** "1h 52m", "3d 4h", "48m". */
export function formatDuration(hours: number): string {
  const sign = hours < 0 ? '−' : '';
  const h = Math.abs(hours);
  if (h >= 48) {
    // Round to whole hours first, so 71.99h reads "3d", not "2d 24h".
    const total = Math.round(h);
    const d = Math.floor(total / 24);
    const r = total % 24;
    return `${sign}${d}d${r ? ` ${r}h` : ''}`;
  }
  if (h >= 1) {
    const whole = Math.floor(h);
    const m = Math.round((h - whole) * 60);
    return m === 60 ? `${sign}${whole + 1}h` : `${sign}${whole}h${m ? ` ${String(m).padStart(2, '0')}m` : ''}`;
  }
  return `${sign}${Math.max(0, Math.round(h * 60))}m`;
}

/** Signed delta against plan: "+11d 12h", "−13d 14h", "on plan". */
export function formatDelta(hours: number): string {
  if (Math.abs(hours) < 0.25) return 'on plan';
  return `${hours > 0 ? '+' : ''}${formatDuration(hours)}`;
}

/** Scrubber offset: "T−12h", "LIVE", "T+1d 4h". */
export function formatOffset(h: number): string {
  if (Math.abs(h) < 0.05) return 'LIVE';
  const s = formatDuration(Math.abs(h));
  return `T${h < 0 ? '−' : '+'}${s}`;
}

export function formatUsd(n: number, cents = false): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export function formatKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg >= 10000 ? 1 : 2)} t`;
  return `${Math.round(kg)} kg`;
}

/** Relative age for feed rows: "now", "4m", "6h", "2d". */
export function formatAgo(hours: number): string {
  const h = Math.max(0, hours);
  if (h < 1 / 60) return 'now';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function formatLatLonShort(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
}
