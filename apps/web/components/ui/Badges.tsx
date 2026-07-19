'use client';

import { getStatusColor, getMethodColor } from '@/lib/utils';

interface StatusBadgeProps {
  status: number;
  text?: string;
  size?: 'xs' | 'sm';
}

export function StatusBadge({ status, text, size = 'xs' }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const label = text || String(status || '—');
  const fz = size === 'sm' ? 13 : 11;
  return (
    <span style={{
      color,
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      fontSize: fz,
      letterSpacing: '0.03em',
    }}>
      {label}
    </span>
  );
}

interface MethodBadgeProps {
  method: string;
  size?: 'xs' | 'sm';
}

export function MethodBadge({ method, size = 'xs' }: MethodBadgeProps) {
  const color = getMethodColor(method);
  const fz = size === 'sm' ? 13 : 11;
  return (
    <span style={{
      color,
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      fontSize: fz,
      letterSpacing: '0.05em',
    }}>
      {method}
    </span>
  );
}

interface SizeBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
}

export function SizeBar({ value, max, color = 'var(--color-accent)', height = 4 }: SizeBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: '100%', height, background: 'var(--color-surface-3)', borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: height / 2, transition: 'width 0.3s ease' }} />
    </div>
  );
}

interface PctRingProps {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  label?: string;
}

export function PctRing({ value, max = 100, size = 48, color = 'var(--color-accent)', label }: PctRingProps) {
  const pct = Math.min(100, (value / max) * 100);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="var(--color-text-primary)"
        fontSize={size < 48 ? 9 : 11} fontWeight={700} fontFamily="var(--font-mono)">
        {label || `${Math.round(pct)}%`}
      </text>
    </svg>
  );
}
