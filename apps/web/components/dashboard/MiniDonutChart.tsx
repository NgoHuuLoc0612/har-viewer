'use client';

import { useMemo } from 'react';

interface MiniDonutChartProps {
  data: Record<string, number>;
  colorMap?: Record<string, string>;
}

const DEFAULT_COLORS = [
  '#06b6d4', '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

export function MiniDonutChart({ data, colorMap = {} }: MiniDonutChartProps) {
  const entries = useMemo(() =>
    Object.entries(data).sort((a, b) => b[1] - a[1]),
    [data]
  );

  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const segments = useMemo(() => {
    let accumulated = 0;
    return entries.map(([key, value], i) => {
      const pct = value / total;
      const startAngle = accumulated * 360;
      accumulated += pct;
      const endAngle = accumulated * 360;
      const color = colorMap[key] || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      return { key, value, pct, startAngle, endAngle, color };
    });
  }, [entries, total, colorMap]);

  const size = 110;
  const cx = size / 2;
  const cy = size / 2;
  const R = 42;
  const r = 26;

  function polarToXY(angle: number, radius: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function describeArc(startAngle: number, endAngle: number) {
    const gap = 1.5;
    const s = polarToXY(startAngle + gap / 2, R);
    const e = polarToXY(endAngle - gap / 2, R);
    const si = polarToXY(startAngle + gap / 2, r);
    const ei = polarToXY(endAngle - gap / 2, r);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${r} ${r} 0 ${large} 0 ${si.x} ${si.y} Z`;
  }

  const top5 = segments.slice(0, 5);

  return (
    <div className="rounded-xl p-4"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-start gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
          {segments.map((seg) => (
            <path key={seg.key} d={describeArc(seg.startAngle, seg.endAngle)}
              fill={seg.color} opacity={0.9} />
          ))}
          <text x={cx} y={cy - 5} textAnchor="middle" fill="var(--color-text-primary)"
            fontSize={13} fontWeight={700} fontFamily="var(--font-mono)">
            {total}
          </text>
          <text x={cx} y={cy + 9} textAnchor="middle" fill="var(--color-text-muted)"
            fontSize={9}>total</text>
        </svg>
        <div className="flex-1 min-w-0 space-y-1.5">
          {top5.map((seg) => (
            <div key={seg.key} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                {seg.key}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                {seg.value}
              </span>
              <span className="text-xs w-9 text-right" style={{ color: 'var(--color-text-muted)' }}>
                {(seg.pct * 100).toFixed(0)}%
              </span>
            </div>
          ))}
          {segments.length > 5 && (
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              +{segments.length - 5} more
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
