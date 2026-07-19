'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, ChevronDown, ChevronUp, Globe, ArrowUpDown } from 'lucide-react';
import { HarAnalysis, DomainData } from '@har-viewer/shared';
import { formatBytes, formatDuration, getStatusColor } from '@/lib/utils';

interface DomainsViewProps { analysis: HarAnalysis; }

type SortKey = keyof Pick<DomainData, 'requestCount' | 'totalSize' | 'avgLatency' | 'avgTtfb' | 'errorCount'>;

export function DomainsView({ analysis }: DomainsViewProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('requestCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const domains = useMemo(() => {
    let d = analysis.domains;
    if (search) d = d.filter(dom => dom.domain.toLowerCase().includes(search.toLowerCase()));
    d = [...d].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return d;
  }, [analysis.domains, search, sortKey, sortDir]);

  const totalRequests = analysis.dashboard.requestSummary.total;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => handleSort(k)}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors"
      style={{ color: sortKey === k ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
      {label}
      {sortKey === k
        ? (sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />)
        : <ArrowUpDown size={9} style={{ opacity: 0.4 }} />}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search domains..."
            className="text-xs pl-7 pr-2 py-1.5 rounded-lg outline-none w-52"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
          {domains.length} domains
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {/* Header */}
        <div className="grid items-center gap-3 px-4 py-2 rounded-lg"
          style={{ gridTemplateColumns: '1fr 100px 100px 100px 100px 100px 120px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Domain</span>
          <SortButton k="requestCount" label="Reqs" />
          <SortButton k="errorCount" label="Errors" />
          <SortButton k="totalSize" label="Size" />
          <SortButton k="avgLatency" label="Avg Lat" />
          <SortButton k="avgTtfb" label="Avg TTFB" />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>% of Total</span>
        </div>

        {domains.map((domain, i) => {
          const pct = totalRequests > 0 ? (domain.requestCount / totalRequests) * 100 : 0;
          const errorRate = domain.requestCount > 0 ? (domain.errorCount / domain.requestCount) * 100 : 0;
          const isExpanded = expandedDomain === domain.domain;

          return (
            <motion.div key={domain.domain}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}>
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--color-surface-1)', border: `1px solid ${isExpanded ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
                {/* Main row */}
                <div
                  className="grid items-center gap-3 px-4 py-3 cursor-pointer"
                  style={{ gridTemplateColumns: '1fr 100px 100px 100px 100px 100px 120px' }}
                  onClick={() => setExpandedDomain(isExpanded ? null : domain.domain)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {domain.domain}
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {domain.requestCount}
                  </span>
                  <span className="text-sm font-bold"
                    style={{ color: domain.errorCount > 0 ? 'var(--color-error)' : 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {domain.errorCount}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {formatBytes(domain.totalSize)}
                  </span>
                  <span className="text-sm" style={{
                    color: domain.avgLatency > 3000 ? 'var(--color-error)' : domain.avgLatency > 1000 ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {formatDuration(domain.avgLatency)}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {formatDuration(domain.avgTtfb)}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-accent)' }} />
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', minWidth: 36 }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    style={{ borderTop: '1px solid var(--color-border)' }}>
                    <div className="p-4 grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                          style={{ color: 'var(--color-text-muted)' }}>Detailed Stats</div>
                        <div className="space-y-1">
                          {[
                            { label: 'Successful', value: `${domain.successCount} (${((domain.successCount / domain.requestCount) * 100).toFixed(0)}%)` },
                            { label: 'Error Rate', value: `${errorRate.toFixed(1)}%` },
                            { label: 'Slowest Request', value: formatDuration(domain.slowestRequest) },
                            { label: 'Largest Resource', value: formatBytes(domain.largestResource) },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between py-1"
                              style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                              <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider mb-2"
                          style={{ color: 'var(--color-text-muted)' }}>Protocols & MIME Types</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Protocols</div>
                            {Object.entries(domain.protocols).map(([p, c]) => (
                              <div key={p} className="flex justify-between text-xs py-0.5">
                                <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{p}</span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{c}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Top MIME Types</div>
                            {Object.entries(domain.mimeTypes).slice(0, 5).map(([m, c]) => (
                              <div key={m} className="flex justify-between text-xs py-0.5">
                                <span className="truncate mr-2" style={{ color: 'var(--color-text-secondary)' }}>
                                  {m.split('/')[1] || m}
                                </span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
