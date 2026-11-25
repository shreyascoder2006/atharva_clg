/**
 * ISO 6346 container numbers: owner code (3 letters) + category (U/J/Z) + 6-digit
 * serial + check digit.
 *
 * Letter values skip multiples of 11 (A=10, B=12 ... K=21, L=23 ...) so a single
 * transcription error always changes the check digit.
 */
const LETTER_VALUES: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let v = 10;
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (v % 11 === 0) v++;
    out[ch] = v++;
  }
  return out;
})();

export function checkDigit(code10: string): number {
  if (!/^[A-Z]{4}\d{6}$/.test(code10)) throw new Error(`Not an ISO 6346 prefix: ${code10}`);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = code10[i];
    const value = i < 4 ? LETTER_VALUES[ch] : Number(ch);
    sum += value * 2 ** i;
  }
  return (sum % 11) % 10;
}

/** Formatted as it is stencilled on the door: "OSPU 482190 8". */
export function containerId(owner: string, category: 'U' | 'J' | 'Z', serial: string): string {
  const prefix = `${owner}${category}`;
  return `${prefix} ${serial} ${checkDigit(prefix + serial)}`;
}

export function isValidContainerId(id: string): boolean {
  const compact = id.replace(/\s+/g, '');
  if (!/^[A-Z]{4}\d{7}$/.test(compact)) return false;
  return checkDigit(compact.slice(0, 10)) === Number(compact[10]);
}
