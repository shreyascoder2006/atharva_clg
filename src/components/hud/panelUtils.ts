import type { DocMeta, Role } from '@/data/shipment';

export function accessHint(role: Role, docs: DocMeta[]) {
  const n = docs.filter((d) => d.access[role] !== 'none').length;
  return `${n} of ${docs.length} visible`;
}
