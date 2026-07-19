'use client';

import { useMemo } from 'react';
import { ProcessedEntry } from '@har-viewer/shared';
import { formatDuration, TIMING_COLORS, TIMING_LABELS } from '@/lib/utils';

interface TimingBreakdownProps {
  entries: ProcessedEntry[];
}

export function TimingBreakdown({ entries }: TimingBreakdownProps) {
  const phases = useMemo(() => {
    const keys = ['queueTime', 'blockedTime', 'proxyTime', 'dnsTime', 'tcpTime', 'sslTime', 'sendTime', 'waitTime', 'receiveTime'];
    const colorKeys = ['queued', 'blocked', 'proxy', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'];

    return keys.map((key, i) => {
      const values = entries.map(e => (e as any)[key] as number).filter(v => v > 0);
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { key: colorKeys[i], label: TIMING_LABELS[colorKeys[i]], color: TIMING_COLORS[colorKeys[i]], avg };
    }).filter(p => p.avg > 0.1);
  }, [entries]);

  const maxAvg = Math.max(...phases.map(p => p.avg), 1);

  return (
    <div className="rounded-xl p-4 space-y-2"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
      {phases.map(({ key, label, color, avg }) => (
        <div key={key} className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-xs w-36 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
            {label}
          </span>
          <div className="flex-1 h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--color-surface-3)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(avg / maxAvg) * 100}%`, background: color, opacity: 0.8 }} />
          </div>
          <span className="text-xs font-semibold w-16 text-right"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {formatDuration(avg)}
          </span>
        </div>
      ))}
    </div>
  );
}
