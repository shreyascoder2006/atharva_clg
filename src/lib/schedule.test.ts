import { describe, expect, it } from 'vitest';

import { CONTAINER, SEED_ACTUALS, T } from '@/data/shipment';
import { checkDigit, isValidContainerId } from '@/lib/iso6346';
import {
  DEFAULT_INPUTS,
  batonAt,
  buildSchedule,
  cargoAt,
  escrowStatus,
  locateS,
  milestoneStatuses,
  type ScheduleInputs,
} from '@/lib/schedule';

const base = (patch: Partial<ScheduleInputs> = {}): ScheduleInputs => ({
  ...DEFAULT_INPUTS,
  nowH: 0,
  actuals: { ...SEED_ACTUALS },
  ...patch,
});

describe('ISO 6346', () => {
  it('produces a valid check digit for the seeded container', () => {
    expect(isValidContainerId(CONTAINER)).toBe(true);
    // Worked example from the standard's annex.
    expect(checkDigit('CSQU305438')).toBe(3);
  });
});

describe('baseline schedule', () => {
  const s = buildSchedule(base());

  it('starts the truck on the expressway, early in the leg', () => {
    const c = cargoAt(s, 0);
    expect(c.leg.id).toBe('road');
    expect(c.phase).toBe('origin');
    expect(c.f).toBeGreaterThan(0.05);
    expect(c.f).toBeLessThan(0.25);
    expect(c.moving).toBe(true);
  });

  it('reaches JNPT in a plausible time and makes the vessel cutoff', () => {
    expect(s.gateInH).toBeGreaterThan(1.5);
    expect(s.gateInH).toBeLessThan(4);
    expect(s.rolled).toBe(false);
    expect(s.byId.atd.plannedH).toBe(T.loadPlanned + T.sailAfterLoadH);
  });

  it('takes 17 to 21 days door to door via Suez', () => {
    const days = s.deliveredH / 24;
    expect(days).toBeGreaterThan(17);
    expect(days).toBeLessThan(21);
  });

  it('blocks clearance until the documents are reconciled', () => {
    expect(s.byId.leo.blocked).toBe('Document mismatch');
    const ok = buildSchedule(base({ docsVerified: true }));
    expect(ok.byId.leo.blocked).toBeUndefined();
  });

  it('places the cargo at the port between gate-in and sailing', () => {
    const c = cargoAt(s, 10);
    expect(c.phase).toBe('port');
    expect(c.leg.id).toBe('road');
    expect(c.f).toBe(1);
  });

  it('round-trips cumulative distance', () => {
    for (const h of [0, 30, 200, 420]) {
      const c = cargoAt(s, h);
      const back = locateS(s, c.s);
      expect(back.leg.id).toBe(c.leg.id);
      expect(back.f).toBeCloseTo(c.f, 5);
    }
  });
});

describe('statuses, baton and escrow', () => {
  it('hands the baton to the broker after gate-in and releases transporter escrow', () => {
    const before = buildSchedule(base());
    expect(batonAt(before, 0, 0).role).toBe('transporter');

    const after = buildSchedule(base({ actuals: { ...SEED_ACTUALS, gateIn: 0.1 }, forcedArrivalH: 0.1 }));
    expect(batonAt(after, 0.2, 0.2).role).toBe('broker');
    const st = milestoneStatuses(after, 0.2, 0.2);
    expect(st.gateIn).toBe('done');
    expect(escrowStatus(st.gateIn)).toBe('released');
  });

  it('shows forecast completions when scrubbing into the future', () => {
    const s = buildSchedule(base({ docsVerified: true }));
    const st = milestoneStatuses(s, 30, 0);
    expect(st.gateIn).toBe('forecast');
    expect(st.atd).toBe('forecast');
    expect(batonAt(s, 30, 0).projected).toBe(true);
  });

  it('treats milestones after a past view time as not yet done', () => {
    const s = buildSchedule(base());
    const st = milestoneStatuses(s, -20, 0);
    expect(st.invoice).toBe('done');
    expect(st.stuffing).not.toBe('done');
  });
});

describe('disruptions and recovery', () => {
  it('an unresolved ghat delay pushes gate-in by six hours', () => {
    const plain = buildSchedule(base());
    const held = buildSchedule(base({ highway: 'active', highwayAtH: 0 }));
    expect(held.gateInH - plain.gateInH).toBeCloseTo(6, 1);
    expect(held.alert?.legId).toBe('road');
  });

  it('the NH-48 diversion keeps the truck where it was and still makes cutoff', () => {
    const held = buildSchedule(base({ highway: 'active', highwayAtH: 0 }));
    const div = buildSchedule(base({ highway: 'nh48', highwayAtH: 0 }));
    const a = cargoAt(held, 0);
    const b = cargoAt(div, 0);
    expect(Math.abs(a.lat - b.lat)).toBeLessThan(0.01);
    expect(Math.abs(a.lon - b.lon)).toBeLessThan(0.01);
    expect(div.gateInH).toBeLessThan(held.gateInH);
    expect(div.rolled).toBe(false);
  });

  it('rail recovery runs road to the ICD then a rail leg, with lower origin CO2', () => {
    const rail = buildSchedule(base({ highway: 'rail', highwayAtH: 0 }));
    expect(rail.legs.map((l) => l.mode).slice(0, 2)).toEqual(['road', 'rail']);
    const plain = buildSchedule(base());
    const originCo2 = (s: typeof rail) =>
      s.legs.filter((l) => l.group === 'origin').reduce((a, l) => a + l.co2Kg, 0);
    expect(originCo2(rail)).toBeLessThan(originCo2(plain));
  });

  it('an unresolved customs hold rolls the box; AI reclassification recovers the sailing', () => {
    const held = buildSchedule(base({ customs: 'active', customsAtH: 0, docsVerified: true }));
    expect(held.rolled).toBe(true);
    expect(held.byId.leo.blocked).toBe('RMS hold');
    const fixed = buildSchedule(base({ customs: 'ai_reclass', customsAtH: 0, docsVerified: true }));
    expect(fixed.rolled).toBe(false);
    const roll = buildSchedule(base({ customs: 'cfs_roll', customsAtH: 0, docsVerified: true }));
    expect(roll.deliveredH - fixed.deliveredH).toBeCloseTo(T.nextSailingShiftH, 0);
  });

  it('Cape is slower than Suez; sea-air is much faster and much dirtier', () => {
    const suez = buildSchedule(base());
    const cape = buildSchedule(base({ redSea: 'cape', redSeaAtH: 0 }));
    const air = buildSchedule(base({ redSea: 'seaair', redSeaAtH: 0 }));
    const capeDays = (cape.deliveredH - suez.deliveredH) / 24;
    expect(capeDays).toBeGreaterThan(8);
    expect(capeDays).toBeLessThan(15);
    expect(air.deliveredH).toBeLessThan(suez.deliveredH - 7 * 24);
    expect(air.co2Kg / suez.co2Kg).toBeGreaterThan(3);
    expect(cape.co2Kg).toBeGreaterThan(suez.co2Kg);
  });

  it('confirming arrival early moves the truck to the gate at that hour', () => {
    const s = buildSchedule(base({ forcedArrivalH: 0.05 }));
    expect(s.gateInH).toBeLessThan(0.1);
    const c = cargoAt(s, 0.2);
    expect(c.phase).toBe('port');
  });
});

describe('SHA-256 fallback', () => {
  it('matches the FIPS 180-4 test vectors', async () => {
    const { sha256Js } = await import('@/lib/hash');
    const enc = (t: string) => new TextEncoder().encode(t);
    expect(sha256Js(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Js(enc(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Js(enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });
});

describe('fleet schedules', () => {
  it('SHP-2611-0519 is in flight at LIVE, with the forwarder holding the baton', async () => {
    const { buildAirSchedule } = await import('@/lib/fleet');
    const s = buildAirSchedule();
    const c = cargoAt(s, 0);
    expect(c.leg.mode).toBe('air');
    expect(c.moving).toBe(true);
    expect(batonAt(s, 0, 0).role).toBe('forwarder');
    const st = milestoneStatuses(s, 0, 0);
    expect(st.leo).toBe('done');
    expect(st.ata).not.toBe('done');
    // BLR to FRA is roughly 7,700 km: a single long-haul sector.
    const air = s.legs.find((l) => l.mode === 'air')!;
    expect(air.km).toBeGreaterThan(7000);
    expect(air.endH - air.startH).toBeGreaterThan(8);
    expect(air.endH - air.startH).toBeLessThan(11);
  });

  it('SHP-2611-0494 sits at Mundra on an RMS hold that rolls the vessel', async () => {
    const { buildSuratSchedule, SURAT } = await import('@/lib/fleet');
    const held = buildSuratSchedule('active', null);
    expect(cargoAt(held, 0).phase).toBe('port');
    expect(held.byId.leo.blocked).toBe('RMS hold');
    expect(held.rolled).toBe(true);
    expect(held.alert?.legId).toBe('sea');
    expect(batonAt(held, 0, 0).role).toBe('broker');

    const fixed = buildSuratSchedule('resolved', 0.1);
    expect(fixed.rolled).toBe(false);
    expect(fixed.byId.leo.actualH).toBeCloseTo(0.1);
    expect(fixed.alert).toBeNull();
    expect(held.deliveredH - fixed.deliveredH).toBeCloseTo(SURAT.nextSailingShiftH, 0);
    expect(batonAt(fixed, 0.2, 0.2).role).toBe('forwarder');
  });

  it('every schedule hands out the same shape the HUD relies on', async () => {
    const { buildAirSchedule, buildSuratSchedule } = await import('@/lib/fleet');
    for (const s of [buildSchedule(base()), buildAirSchedule(), buildSuratSchedule('active', null)]) {
      expect(s.legs.length).toBeGreaterThan(0);
      expect(s.byId.gateIn).toBeDefined();
      expect(s.byId.atd).toBeDefined();
      expect(s.byId.ata).toBeDefined();
      expect(s.byId.delivered).toBeDefined();
      expect(s.baton.every((b) => s.byId[b.m])).toBe(true);
      expect(s.deliveredH).toBeGreaterThan(s.ataH - 1e-6);
    }
  });
});
