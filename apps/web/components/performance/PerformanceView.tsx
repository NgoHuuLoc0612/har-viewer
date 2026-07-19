'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, Clock, HardDrive, RotateCcw, Shield, Archive } from 'lucide-react';
import { HarAnalysis } from '@har-viewer/shared';
import { formatBytes, formatDuration, truncateUrl } from '@/lib/utils';

interface PerformanceViewProps { analysis: HarAnalysis; }

function IssueList<T>({
  title, items, icon: Icon, color, renderItem, empty,
}: {
  title: string;
  items: T[];
  icon: React.ElementType;
  color: string;
  renderItem: (item: T, i: number) => React.ReactNode;
  empty?: string;
}) {
  const [show, setShow] = useState(false);
  const visible = show ? items : items.slice(0, 5);

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
            <Icon size={12} style={{ color }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: items.length > 0 ? `${color}18` : 'var(--color-surface-3)',
              color: items.length > 0 ? color : 'var(--color-text-muted)' }}>
            {items.length}
          </span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-3 text-xs" style={{ color: 'var(--color-success)' }}>
          ✓ {empty || 'No issues found'}
        </div>
      ) : (
        <div>
          <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {visible.map((item, i) => renderItem(item, i))}
          </div>
          {items.length > 5 && (
            <button onClick={() => setShow(!show)}
              className="w-full text-xs py-2 transition-colors"
              style={{ color: 'var(--color-accent)', borderTop: '1px solid var(--color-border-subtle)' }}>
              {show ? 'Show less' : `Show ${items.length - 5} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function UrlRow({ url, metric }: { url: string; metric?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
      <span className="text-xs truncate flex-1"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}
        title={url}>
        {truncateUrl(url, 70)}
      </span>
      {metric && (
        <span className="text-xs font-semibold flex-shrink-0"
          style={{ color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
          {metric}
        </span>
      )}
    </div>
  );
}

export function PerformanceView({ analysis }: PerformanceViewProps) {
  const { performance, dashboard, entries } = analysis;
  const { timingSummary: ts } = dashboard;

  const totalIssues =
    performance.slowRequests.length +
    performance.largeResources.length +
    performance.missingCompression.length +
    performance.missingCacheHeaders.length +
    performance.duplicateRequests.length +
    performance.highTtfb.length +
    performance.blockingResources.length;

  const score = Math.max(0, Math.round(100 - totalIssues * 3));

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Performance score */}
      <div className="rounded-xl p-5"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-start gap-8">
          <div className="text-center">
            <div className="text-5xl font-bold mb-1"
              style={{ color: score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>
              {score}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Performance Score</div>
            <div className="text-xs mt-1"
              style={{ color: score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-error)' }}>
              {score >= 80 ? 'Good' : score >= 60 ? 'Needs Work' : 'Poor'}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-4 gap-3">
            {[
              { label: 'Avg Load Time', value: formatDuration(ts.avgDuration), warn: ts.avgDuration > 3000 },
              { label: 'P95 Load Time', value: formatDuration(ts.p95), warn: ts.p95 > 5000 },
              { label: 'Avg TTFB', value: formatDuration(ts.avgTtfb), warn: ts.avgTtfb > 600 },
              { label: 'Total Issues', value: String(totalIssues), warn: totalIssues > 0 },
              { label: 'Slow Requests', value: String(performance.slowRequests.length), warn: performance.slowRequests.length > 0 },
              { label: 'Large Resources', value: String(performance.largeResources.length), warn: performance.largeResources.length > 0 },
              { label: 'Duplicates', value: String(performance.duplicateRequests.length), warn: performance.duplicateRequests.length > 0 },
              { label: 'Missing Cache', value: String(performance.missingCacheHeaders.length), warn: performance.missingCacheHeaders.length > 0 },
            ].map(({ label, value, warn }) => (
              <div key={label} className="rounded-lg p-3"
                style={{ background: 'var(--color-surface-2)', border: `1px solid ${warn ? 'rgba(245,158,11,0.3)' : 'var(--color-border)'}` }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                <div className="text-lg font-bold" style={{ color: warn ? 'var(--color-warning)' : 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Issue lists grid */}
      <div className="grid grid-cols-2 gap-4">
        <IssueList
          title="Slow Requests (>3s)"
          items={performance.slowRequests}
          icon={Clock}
          color="var(--color-error)"
          empty="No requests exceeded 3 second threshold"
          renderItem={(item, i) => (
            <UrlRow key={i} url={item.url} metric={formatDuration(item.duration)} />
          )}
        />

        <IssueList
          title="Large Resources (>1MB)"
          items={performance.largeResources}
          icon={HardDrive}
          color="var(--color-warning)"
          empty="No resources exceeded 1 MB threshold"
          renderItem={(item, i) => (
            <UrlRow key={i} url={item.url} metric={formatBytes(item.size)} />
          )}
        />

        <IssueList
          title="High TTFB (>600ms)"
          items={performance.highTtfb}
          icon={Zap}
          color="var(--color-warning)"
          empty="All TTFB values are within acceptable range"
          renderItem={(url, i) => <UrlRow key={i} url={url} />}
        />

        <IssueList
          title="Missing Compression"
          items={performance.missingCompression}
          icon={Archive}
          color="var(--color-info)"
          empty="All compressible resources are compressed"
          renderItem={(url, i) => <UrlRow key={i} url={url} />}
        />

        <IssueList
          title="Missing Cache Headers"
          items={performance.missingCacheHeaders}
          icon={Shield}
          color="var(--color-info)"
          empty="All cacheable resources have cache headers"
          renderItem={(url, i) => <UrlRow key={i} url={url} />}
        />

        <IssueList
          title="Duplicate Requests"
          items={performance.duplicateRequests}
          icon={RotateCcw}
          color="var(--color-warning)"
          empty="No duplicate requests detected"
          renderItem={(url, i) => <UrlRow key={i} url={url} />}
        />

        <IssueList
          title="Redirect Chains"
          items={performance.longRedirectChains}
          icon={RotateCcw}
          color="var(--color-warning)"
          empty="No redirect chains detected"
          renderItem={(url, i) => <UrlRow key={i} url={url} />}
        />

        <IssueList
          title="Blocking Resources"
          items={performance.blockingResources}
          icon={AlertTriangle}
          color="var(--color-error)"
          empty="No render-blocking resources detected"
          renderItem={(url, i) => <UrlRow key={i} url={url} />}
        />
      </div>
    </div>
  );
}
