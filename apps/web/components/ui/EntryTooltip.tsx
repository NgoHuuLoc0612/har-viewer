'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ProcessedEntry } from '@har-viewer/shared';
import { formatBytes, formatDuration, getMethodColor, getStatusColor, TIMING_COLORS } from '@/lib/utils';

interface EntryTooltipProps {
  entry: ProcessedEntry;
  visible: boolean;
  x: number;
  y: number;
}

export function EntryTooltip({ entry, visible, x, y }: EntryTooltipProps) {
  const phases = [
    { label: 'Blocked', value: entry.blockedTime, color: TIMING_COLORS.blocked },
    { label: 'DNS',     value: entry.dnsTime,     color: TIMING_COLORS.dns },
    { label: 'Connect', value: entry.tcpTime,     color: TIMING_COLORS.connect },
    { label: 'SSL',     value: entry.sslTime,     color: TIMING_COLORS.ssl },
    { label: 'Send',    value: entry.sendTime,    color: TIMING_COLORS.send },
    { label: 'Wait',    value: entry.waitTime,    color: TIMING_COLORS.wait },
    { label: 'Receive', value: entry.receiveTime, color: TIMING_COLORS.receive },
  ].filter(p => p.value > 0.5);

  const totalPhase = phases.reduce((s, p) => s + p.value, 0) || 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'fixed',
            left: Math.min(x + 16, window.innerWidth - 320),
            top: Math.min(y - 20, window.innerHeight - 260),
            zIndex: 9999,
            pointerEvents: 'none',
          }}>
          <div className="rounded-xl shadow-2xl p-3 w-72"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            {/* URL */}
            <div className="text-xs mb-2 break-all leading-relaxed"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
              {entry.url.length > 80 ? entry.url.slice(0, 80) + '…' : entry.url}
            </div>

            {/* Method / Status / Protocol */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs font-bold" style={{ color: getMethodColor(entry.method), fontFamily: 'var(--font-mono)' }}>
                {entry.method}
              </span>
              <span className="text-xs font-bold" style={{ color: getStatusColor(entry.status), fontFamily: 'var(--font-mono)' }}>
                {entry.status} {entry.statusText}
              </span>
              <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                {entry.httpVersion}
              </span>
            </div>

            {/* Timing mini-bar */}
            {phases.length > 0 && (
              <div className="mb-2.5">
                <div className="h-3 rounded flex overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                  {phases.map((p, i) => (
                    <div key={i} title={`${p.label}: ${formatDuration(p.value)}`}
                      style={{ width: `${(p.value / totalPhase) * 100}%`, background: p.color, minWidth: 1 }} />
                  ))}
                </div>
              </div>
            )}

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: 'Duration', value: formatDuration(entry.duration) },
                { label: 'TTFB',     value: formatDuration(entry.ttfb) },
                { label: 'Size',     value: formatBytes(entry.transferredSize) },
                { label: 'Decoded',  value: formatBytes(entry.decodedSize) },
                { label: 'Type',     value: entry.resourceType },
                { label: 'Cache',    value: entry.cacheStatus || 'none' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-1">
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)', minWidth: 52 }}>{label}:</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Domain */}
            <div className="mt-2 pt-2 text-xs" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
              {entry.domain} · {entry.remoteIp || 'IP unknown'}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
