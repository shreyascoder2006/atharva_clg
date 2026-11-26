/**
 * The seven workspaces and their URLs.
 *
 * Routing is a store field kept in step with the address bar by useRouteSync, so a
 * dashboard can be linked to or reloaded directly, and back/forward work. No router
 * library: there are no nested routes or params to justify one.
 */
export type ViewId = 'tower' | 'shipments' | 'documents' | 'partners' | 'comms' | 'financials' | 'integrations';

export interface ViewMeta {
  id: ViewId;
  slug: string;
  label: string;
  title: string;
}

export const VIEWS: ViewMeta[] = [
  { id: 'tower', slug: '', label: 'Control Tower', title: 'Control Tower' },
  { id: 'shipments', slug: 'shipments', label: 'Shipments', title: 'Shipments & Fleet Command' },
  { id: 'documents', slug: 'documents', label: 'Documents', title: 'Document Vault & AI X-Ray Studio' },
  { id: 'partners', slug: 'partners', label: 'Partners', title: 'Partner Marketplace & Quotes' },
  { id: 'comms', slug: 'comms', label: 'Comms', title: 'Unified Comms & Escalation Hub' },
  { id: 'financials', slug: 'financials', label: 'Financials', title: 'Financials, Demurrage & Escrow' },
  { id: 'integrations', slug: 'integrations', label: 'Sustainability & ULIP', title: 'Sustainability (Scope 3) & ULIP Hub' },
];

export const VIEW_BY_ID = Object.fromEntries(VIEWS.map((v) => [v.id, v])) as Record<ViewId, ViewMeta>;

const base = () => (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

export function pathForView(view: ViewId): string {
  return base() + VIEW_BY_ID[view].slug;
}

export function viewFromPath(pathname: string): ViewId {
  const b = base();
  const rest = (pathname.startsWith(b) ? pathname.slice(b.length) : pathname.replace(/^\//, '')).replace(/\/+$/, '');
  return VIEWS.find((v) => v.slug === rest)?.id ?? 'tower';
}
