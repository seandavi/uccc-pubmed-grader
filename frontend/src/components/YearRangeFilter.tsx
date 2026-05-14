/**
 * Two-thumb year range slider with a histogram visualization underneath.
 *
 * Renders two `<input type="range">` overlaid on a track, plus a faint
 * year histogram so the user can see where the mass of papers sits while
 * adjusting the range.
 */

type Props = {
  minYear: number;
  maxYear: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  histogram: { label: string; count: number }[];
};

export function YearRangeFilter({ minYear, maxYear, value, onChange, histogram }: Props) {
  const [from, to] = value;
  const range = maxYear - minYear;
  if (range <= 0) return null;

  const handleFrom = (v: number) => onChange([Math.min(v, to), to]);
  const handleTo = (v: number) => onChange([from, Math.max(v, from)]);

  const maxBucket = histogram.reduce((m, b) => Math.max(m, b.count), 0) || 1;

  const pct = (v: number) => ((v - minYear) / range) * 100;
  const isFiltered = from > minYear || to < maxYear;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between font-mono text-[0.7rem] uppercase tracking-eyebrow text-ink2">
        <span className="eyebrow">Filter by year</span>
        <span className="tabular text-ink">
          {from} <span className="text-muted">→</span> {to}
          {isFiltered && (
            <button
              type="button"
              className="ml-3 underline underline-offset-4 hover:text-ink2 transition-colors"
              onClick={() => onChange([minYear, maxYear])}
            >
              clear
            </button>
          )}
        </span>
      </div>

      <div className="relative h-16">
        {/* Year histogram silhouette */}
        <div className="absolute inset-x-0 bottom-6 top-0 flex items-end gap-px">
          {histogram.map((b) => {
            const y = Number(b.label);
            const inRange = Number.isFinite(y) && y >= from && y <= to;
            return (
              <div
                key={b.label}
                className={[
                  "flex-1 origin-bottom transition-colors",
                  inRange ? "bg-gold/60" : "bg-rule",
                ].join(" ")}
                style={{ height: `${(b.count / maxBucket) * 100}%` }}
                aria-hidden
              />
            );
          })}
        </div>

        {/* Track */}
        <div className="absolute inset-x-0 bottom-5 h-px bg-rule" aria-hidden />
        <div
          className="absolute bottom-5 h-px bg-ink"
          style={{ left: `${pct(from)}%`, right: `${100 - pct(to)}%` }}
          aria-hidden
        />

        {/* Two range inputs stacked (both same track), pointer-events on thumbs only */}
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={from}
          onChange={(e) => handleFrom(Number(e.target.value))}
          className="range-thumb absolute inset-x-0 bottom-0 h-10 w-full appearance-none bg-transparent pointer-events-none"
          aria-label="Earliest year"
        />
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={to}
          onChange={(e) => handleTo(Number(e.target.value))}
          className="range-thumb absolute inset-x-0 bottom-0 h-10 w-full appearance-none bg-transparent pointer-events-none"
          aria-label="Latest year"
        />
      </div>

      <div className="flex items-baseline justify-between font-mono text-[0.7rem] text-muted tabular">
        <span>{minYear}</span>
        <span>{maxYear}</span>
      </div>
    </div>
  );
}
