import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { customRow } from '@/components/dash/usePortfolio';
import { LANES } from '@/data/lanes';
import { PARTNERS, PRIORITY_PRESETS, QUOTES, scoreQuotes } from '@/data/partners';
import { SHIPMENT_IDS, type RouteId } from '@/data/shipment';
import { haversineKm } from '@/lib/geo';
import { getRoute } from '@/lib/route';
import { useShipment } from '@/store/shipment';

const preset = (id: string) => PRIORITY_PRESETS.find((p) => p.id === id)!.weights;

describe('partner priority scoring', () => {
  const quotes = QUOTES['SHP-2611-0482'];

  it('keeps scores between 0 and 100 and sorts best first', () => {
    for (const p of PRIORITY_PRESETS) {
      const s = scoreQuotes(quotes, p.weights);
      expect(s.every((x) => x.score >= 0 && x.score <= 100)).toBe(true);
      expect(s.map((x) => x.score)).toEqual([...s.map((x) => x.score)].sort((a, b) => b - a));
    }
  });
  it.each(SHIPMENT_IDS)('presets lead with their own criterion · %s', (id) => {
    const q = QUOTES[id];
    // The winner is (one of) the best on the preset's criterion; ties go to the tie-breakers.
    const min = (key: (x: (typeof q)[number]) => number) => Math.min(...q.map(key));
    expect(scoreQuotes(q, preset('cost'))[0].quote.priceUsd).toBe(min((x) => x.priceUsd));
    expect(PARTNERS[scoreQuotes(q, preset('carbon'))[0].quote.partner].gPerTkm).toBe(min((x) => PARTNERS[x.partner].gPerTkm));
    expect(scoreQuotes(q, preset('speed'))[0].quote.transitDays).toBe(min((x) => x.transitDays));
  });
});

describe('lane templates', () => {
  it('registers every lane as a drawable route', () => {
    for (const l of LANES) {
      const g = getRoute(l.route.id as RouteId);
      expect(g.points.length).toBeGreaterThan(10);
      expect(g.km).toBeGreaterThan(500);
    }
  });
  it('flies air lanes on the great circle', () => {
    const l = LANES.find((x) => x.id === 'del-jfk')!;
    const gc = haversineKm(l.route.waypoints[0], l.route.waypoints[1]);
    expect(getRoute(l.route.id as RouteId).km).toBeCloseTo(gc, -2);
  });
});

describe('workflow actions from the dashboards', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('books a shipment and builds its portfolio row', () => {
    const id = useShipment.getState().createShipment({ laneId: 'maa-sin', cargo: 'Wiring harnesses', grossKg: 6200, valueUsd: 54000, exporter: 'X', forwarder: 'Y' });
    expect(id).toBe('SHP-2611-0540');
    const c = useShipment.getState().customShipments[0];
    const row = customRow(c, c.createdH);
    expect(row.status.label).toBe('Booked');
    expect(row.legs.map((l) => l.mode)).toEqual(['road', 'sea']);
    expect(row.costs!.freight).toBeGreaterThan(0);
  });

  it('runs escrow proofs in order and respects the document gate', async () => {
    const s = () => useShipment.getState();
    s().proveMilestone('gateIn');
    vi.advanceTimersByTime(3000);
    expect(s().actuals.gateIn).toBeDefined();

    s().proveMilestone('leo');
    expect(s().actuals.leo).toBeUndefined(); // blocked by the seeded weight mismatch

    vi.useRealTimers();
    await s().resolveDocs();
    s().proveMilestone('leo');
    expect(s().actuals.leo).toBeDefined();
    s().proveMilestone('loaded');
    expect(s().actuals.loaded).toBeDefined();
    expect(s().actuals.vgm).toBeDefined();
    s().proveMilestone('lc');
    expect(s().actuals.ebl).toBeDefined();
    expect(s().actuals.lc).toBeDefined();
  });

  it('answers composer quick-inserts from the right party after a typing beat', () => {
    const s = () => useShipment.getState();
    s().setChannel('shp-0482');
    s().postMessage('ping', { intent: 'ping-driver' });
    vi.advanceTimersByTime(400);
    expect(s().typing?.author).toBe('transporter');
    vi.advanceTimersByTime(1200);
    const reply = s().messages[s().messages.length - 1];
    expect(reply).toMatchObject({ author: 'transporter', via: 'driver-app' });

    s().postMessage('Escalating', { intent: 'escalate-cha' });
    vi.advanceTimersByTime(1600);
    expect(s().messages[s().messages.length - 1].author).toBe('broker');
  });
});
