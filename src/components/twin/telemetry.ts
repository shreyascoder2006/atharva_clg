/**
 * Simulated IoT stream for the container: temperature, humidity, shock and tilt.
 *
 * Deterministic smooth noise plus event spikes, sampled at 2 Hz. Shock spikes only
 * happen while the box is on the road, which is what a real accelerometer would show:
 * quiet at the terminal, busy in the ghat section.
 */
export interface Sample {
  t: number;
  temp: number;
  rh: number;
  shock: number;
  tilt: number;
}

const HISTORY = 72;

function noise(t: number, seed: number) {
  return (
    Math.sin(t * 0.91 + seed) * 0.5 +
    Math.sin(t * 2.17 + seed * 1.7) * 0.3 +
    Math.sin(t * 5.3 + seed * 2.3) * 0.2
  );
}

class Telemetry {
  history: Sample[] = [];
  onRoad = true;
  private last: Sample = { t: 0, temp: 18.4, rh: 58, shock: 0.2, tilt: 1.2 };

  sample(now = performance.now() / 1000): Sample {
    const road = this.onRoad;
    const spike = road && Math.sin(now * 0.73) > 0.985 ? 0.9 + Math.abs(noise(now, 9)) * 0.8 : 0;
    const s: Sample = {
      t: now,
      temp: 18.4 + noise(now / 9, 1) * 0.7,
      rh: 58 + noise(now / 13, 2) * 3.2,
      shock: Math.max(0.04, (road ? 0.22 : 0.06) + Math.abs(noise(now * 1.7, 3)) * (road ? 0.28 : 0.05) + spike),
      tilt: 1.2 + noise(now / 5, 4) * (road ? 0.7 : 0.15),
    };
    this.last = s;
    this.history.push(s);
    if (this.history.length > HISTORY) this.history.shift();
    return s;
  }

  latest(): Sample {
    return this.last;
  }

  /** Back-fill so sparklines are full the moment the twin opens. */
  prime() {
    if (this.history.length) return;
    const now = performance.now() / 1000;
    for (let i = HISTORY; i > 0; i--) this.sample(now - i * 0.5);
  }
}

export const telemetry = new Telemetry();
