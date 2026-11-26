import { describe, expect, it } from 'vitest';

import { CHANNELS, SEED_MESSAGES } from '@/data/comms';
import { COSTS, moneyToUsd, INR_PER_USD } from '@/data/finance';
import { PARTNERS, QUOTES, quoteBadges } from '@/data/partners';
import { WATCHLIST } from '@/data/portfolio';
import { ROUTES, SHIPMENT_IDS } from '@/data/shipment';
import { XRAY_SETS } from '@/data/xray';
import { pathForView, VIEWS, viewFromPath } from '@/lib/routes';
import { partyOf, payeeOf, unreadCount, useShipment } from '@/store/shipment';

describe('routes', () => {
  it('round-trips every view through its path', () => {
    for (const v of VIEWS) expect(viewFromPath(pathForView(v.id))).toBe(v.id);
  });
  it('falls back to the Control Tower for unknown paths and tolerates trailing slashes', () => {
    expect(viewFromPath('/nope')).toBe('tower');
    expect(viewFromPath('/comms/')).toBe('comms');
    expect(pathForView('tower')).toBe('/');
  });
});

describe('finance', () => {
  it('converts rupee and dollar escrow strings to USD', () => {
    expect(moneyToUsd('$2,140')).toBe(2140);
    expect(moneyToUsd('₹18,500')).toBeCloseTo(18500 / INR_PER_USD, 6);
  });
  it('prices every shipment on the platform', () => {
    for (const id of [...SHIPMENT_IDS, ...WATCHLIST.map((w) => w.id)]) expect(COSTS[id]).toBeDefined();
  });
});

describe('partner marketplace', () => {
  it('gives each badge to exactly one bid per shipment', () => {
    for (const id of SHIPMENT_IDS) {
      const badges = Object.values(quoteBadges(QUOTES[id])).flat();
      expect(badges.sort()).toEqual(['Best Value', 'Fastest Customs', 'Lowest Carbon', 'Most Reliable']);
    }
  });
  it('awards Best Value to the cheapest bid', () => {
    const q = QUOTES['SHP-2611-0482'];
    const cheapest = q.reduce((a, b) => (b.priceUsd < a.priceUsd ? b : a));
    expect(quoteBadges(q)[cheapest.partner]).toContain('Best Value');
  });
  it('reassigning the forwarder changes the party and the escrow payee, nothing else', () => {
    const assignments = { 'SHP-2611-0482': 'dhl' as const };
    expect(partyOf(assignments, 'SHP-2611-0482', 'forwarder').org).toBe(PARTNERS.dhl.name);
    expect(partyOf(assignments, 'SHP-2611-0482', 'broker').org).toBe('Nhava Sheva Clearing House');
    expect(partyOf(assignments, 'SHP-2611-0519', 'forwarder').org).toBe('Arabian Gateway Logistics');
    expect(payeeOf(assignments, 'SHP-2611-0482', { id: 'forwarder', party: 'Arabian Gateway' })).toBe(PARTNERS.dhl.short);
    expect(payeeOf(assignments, 'SHP-2611-0482', { id: 'transporter', party: 'Sahyadri Roadlines' })).toBe('Sahyadri Roadlines');
  });
});

describe('comms', () => {
  it('seeds every channel', () => {
    for (const c of CHANNELS) expect(SEED_MESSAGES.some((m) => m.channel === c.id)).toBe(true);
  });
  it('starts with unread messages and clears them when a channel is read', () => {
    const s = useShipment.getState();
    expect(unreadCount(s)).toBeGreaterThan(0);
    for (const c of CHANNELS) useShipment.getState().markRead(c.id);
    expect(unreadCount(useShipment.getState())).toBe(0);
  });
  it('assigning a partner posts to the shipment channel and updates the store', () => {
    const before = useShipment.getState().messages.length;
    useShipment.getState().assignPartner('allcargo');
    const s = useShipment.getState();
    expect(s.assignments['SHP-2611-0482']).toBe('allcargo');
    expect(s.messages.length).toBe(before + 1);
    expect(s.messages[s.messages.length - 1]).toMatchObject({ channel: 'shp-0482', author: 'system' });
  });
});

describe('data integrity', () => {
  it('watch-list shipments ride real ambient routes', () => {
    for (const w of WATCHLIST) expect(ROUTES[w.routeId]).toBeDefined();
  });
  it('has a three-document X-Ray set for every live shipment', () => {
    for (const id of SHIPMENT_IDS) expect(XRAY_SETS[id].docs).toHaveLength(3);
  });
});
