import { useEffect } from 'react';

import { GlobeScene } from '@/components/globe/GlobeScene';
import { companyById } from '@/engine/graph';
import { formatCr } from '@/lib/palette';
import { useSimStore } from '@/store/sim';
import { useUiStore } from '@/store/ui';

export default function App() {
  const run = useSimStore((s) => s.run);
  const result = useSimStore((s) => s.result);
  const running = useSimStore((s) => s.running);

  const hiddenOnly = useUiStore((s) => s.hiddenOnly);
  const toggleHiddenOnly = useUiStore((s) => s.toggleHiddenOnly);
  const selectedId = useUiStore((s) => s.selectedId);
  const play = useUiStore((s) => s.play);
  const playing = useUiStore((s) => s.playing);

  // Run the baseline on load and play it through, so the globe is never a dead object.
  useEffect(() => {
    void run().then(() => useUiStore.getState().play());
  }, [run]);

  return (
    <div className="relative h-full w-full">
      <GlobeScene />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-7">
        <header className="flex items-start justify-between">
          <div>
            <div className="text-muted text-[10px] tracking-[0.28em] uppercase">
              Climate exposure intelligence
            </div>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
              CLIMATRIX <span className="text-muted font-normal">India</span>
            </h1>
          </div>

          {result && (
            <div className="text-right">
              <div className="num text-muted text-[10px] tracking-wider">
                {result.scenarioId}
              </div>
              <div className="text-muted mt-0.5 text-[11px]">{result.hazard.name}</div>
            </div>
          )}
        </header>

        <footer className="flex items-end justify-between gap-8">
          <div className="pointer-events-auto">
            <button
              onClick={play}
              disabled={!result || playing}
              className="border-accent/60 bg-accent/10 hover:bg-accent/20 mr-2 border px-4 py-2 text-[11px] tracking-wider uppercase backdrop-blur-sm transition-colors disabled:opacity-40"
              style={{ color: 'var(--color-accent)' }}
            >
              {playing ? 'Propagating…' : '▶ Run propagation'}
            </button>

            <button
              onClick={toggleHiddenOnly}
              className="border-border bg-surface/80 hover:border-muted/50 border px-3 py-2 text-[11px] tracking-wider uppercase backdrop-blur-sm transition-colors"
              style={hiddenOnly ? { borderColor: 'var(--color-ev-assumed)' } : undefined}
            >
              <span style={hiddenOnly ? { color: 'var(--color-ev-assumed)' } : undefined}>
                Hidden exposure only
              </span>
            </button>

            <div className="text-muted mt-3 max-w-xs text-[11px] leading-relaxed">
              {hiddenOnly
                ? 'Showing only entities with negligible direct hazard exposure whose risk arrives entirely through dependencies.'
                : 'Marker size and colour encode lost contribution margin, not disruption percentage. Purple halo marks hidden exposure.'}
            </div>

            {selectedId && (
              <div className="num mt-3 text-[11px]" style={{ color: 'var(--color-accent)' }}>
                selected: {companyById.get(selectedId)?.name}
              </div>
            )}
          </div>

          <div className="text-right">
            {running && <div className="text-muted text-[11px]">Running simulation…</div>}
            {result && (
              <div className="flex gap-6">
                <Metric
                  label="Affected entities"
                  value={String(result.totals.affectedEntities)}
                />
                <Metric
                  label="Hidden exposures"
                  value={String(result.totals.hiddenExposureCount)}
                  tone="var(--color-ev-assumed)"
                />
                <Metric
                  label="Incremental ECL"
                  value={formatCr(result.totals.deltaEl_cr)}
                  chip="synthetic"
                />
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  chip,
}: {
  label: string;
  value: string;
  tone?: string;
  chip?: string;
}) {
  return (
    <div>
      <div className="num text-[19px]" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="text-muted mt-0.5 text-[10px] tracking-wider uppercase">{label}</div>
      {chip && (
        <div
          className="mt-1 inline-block px-1 text-[8px] tracking-[0.12em] uppercase"
          style={{
            color: 'var(--color-ev-assumed)',
            border: '1px solid color-mix(in oklab, var(--color-ev-assumed) 40%, transparent)',
          }}
        >
          {chip}
        </div>
      )}
    </div>
  );
}
