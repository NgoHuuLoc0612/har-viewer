'use client';

import { ProcessedEntry } from '@har-viewer/shared';
import { formatDuration, TIMING_COLORS, TIMING_LABELS } from '@/lib/utils';

interface TimingTabProps { entry: ProcessedEntry; }

interface Phase {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function TimingTab({ entry }: TimingTabProps) {
  const phases: Phase[] = [
    { key: 'queued', label: TIMING_LABELS.queued, value: Math.max(0, entry.queueTime || 0), color: TIMING_COLORS.queued },
    { key: 'blocked', label: TIMING_LABELS.blocked, value: Math.max(0, entry.blockedTime || 0), color: TIMING_COLORS.blocked },
    { key: 'proxy', label: TIMING_LABELS.proxy, value: Math.max(0, entry.proxyTime || 0), color: TIMING_COLORS.proxy },
    { key: 'dns', label: TIMING_LABELS.dns, value: Math.max(0, entry.dnsTime || 0), color: TIMING_COLORS.dns },
    { key: 'connect', label: TIMING_LABELS.connect, value: Math.max(0, entry.tcpTime || 0), color: TIMING_COLORS.connect },
    { key: 'ssl', label: TIMING_LABELS.ssl, value: Math.max(0, entry.sslTime || 0), color: TIMING_COLORS.ssl },
    { key: 'send', label: TIMING_LABELS.send, value: Math.max(0, entry.sendTime || 0), color: TIMING_COLORS.send },
    { key: 'wait', label: TIMING_LABELS.wait, value: Math.max(0, entry.waitTime || 0), color: TIMING_COLORS.wait },
    { key: 'receive', label: TIMING_LABELS.receive, value: Math.max(0, entry.receiveTime || 0), color: TIMING_COLORS.receive },
  ].filter(p => p.value > 0);

  const total = entry.duration;
  const maxValue = Math.max(...phases.map(p => p.value), 1);

  // Compute cumulative offsets for stacked bar
  let cumulative = 0;
  const phaseSegments = phases.map(p => {
    const start = (cumulative / total) * 100;
    cumulative += p.value;
    const width = (p.value / total) * 100;
    return { ...p, start, width };
  });

  return (
    <div className="p-4 space-y-6">
      {/* Stacked bar */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-muted)' }}>
          Timing Waterfall — Total: {formatDuration(total)}
        </div>
        <div className="h-6 rounded-lg overflow-hidden flex"
          style={{ background: 'var(--color-surface-3)' }}>
          {phaseSegments.map(seg => (
            <div key={seg.key}
              className="h-full relative group"
              style={{ width: `${Math.max(seg.width, 0.5)}%`, background: seg.color }}
              title={`${seg.label}: ${formatDuration(seg.value)}`}>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-xs
                whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                {seg.label}: {formatDuration(seg.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {phaseSegments.map(seg => (
            <div key={seg.key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: seg.color }} />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{seg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed table */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-muted)' }}>
          Phase Breakdown
        </div>
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
          {phases.map((phase, i) => (
            <div key={phase.key} className="flex items-center gap-4 px-4 py-3"
              style={{ borderBottom: i < phases.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: phase.color }} />
              <span className="text-sm w-44 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                {phase.label}
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background: 'var(--color-surface-3)' }}>
                <div className="h-full rounded-full"
                  style={{
                    width: `${(phase.value / maxValue) * 100}%`,
                    background: phase.color,
                    transition: 'width 0.6s ease',
                  }} />
              </div>
              <span className="text-sm font-semibold w-20 text-right"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                {formatDuration(phase.value)}
              </span>
              <span className="text-xs w-12 text-right"
                style={{ color: 'var(--color-text-muted)' }}>
                {((phase.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary metrics */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-muted)' }}>
          Summary Metrics
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'TTFB', value: formatDuration(entry.ttfb), desc: 'Time to First Byte' },
            { label: 'Total Duration', value: formatDuration(entry.duration), desc: 'End-to-end time' },
            { label: 'DNS', value: formatDuration(entry.dnsTime), desc: 'DNS resolution' },
            { label: 'TCP', value: formatDuration(entry.tcpTime), desc: 'TCP connection' },
            { label: 'TLS/SSL', value: formatDuration(entry.sslTime), desc: 'TLS handshake' },
            { label: 'Server Wait', value: formatDuration(entry.waitTime), desc: 'Server processing' },
            { label: 'Download', value: formatDuration(entry.receiveTime), desc: 'Response download' },
            { label: 'Start Time', value: `${entry.startTime.toFixed(3)}s`, desc: 'Relative to page load' },
          ].map(({ label, value, desc }) => (
            <div key={label} className="rounded-lg p-3"
              style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
              <div className="text-base font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                {value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HAR raw timings */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-text-muted)' }}>Raw HAR Timings</div>
        <pre className="p-3 rounded-lg text-xs overflow-auto"
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-secondary)',
          }}>
          {JSON.stringify(entry.rawEntry.timings, null, 2)}
        </pre>
      </div>
    </div>
  );
}
