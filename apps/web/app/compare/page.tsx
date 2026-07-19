'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, GitCompare, Loader2, Plus, Minus, Edit3, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { harApi } from '@/lib/api';
import { useHarStore } from '@/store/har-store';
import { formatBytes, formatDuration, getMethodColor, getStatusColor, truncateUrl } from '@/lib/utils';

export default function ComparePage() {
  const router = useRouter();
  const { harFiles, setHarFiles } = useHarStore();
  const [uuidA, setUuidA] = useState('');
  const [uuidB, setUuidB] = useState('');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'added' | 'removed' | 'modified' | 'timing' | 'size'>('modified');

  useEffect(() => {
    harApi.list().then(setHarFiles).catch(() => {});
  }, []);

  const readyFiles = harFiles.filter(f => f.status === 'complete');

  const handleCompare = async () => {
    if (!uuidA || !uuidB) { toast.error('Select two HAR files'); return; }
    if (uuidA === uuidB) { toast.error('Select two different files'); return; }
    setComparing(true);
    setResult(null);
    try {
      const r = await harApi.compare(uuidA, uuidB);
      setResult(r);
      toast.success('Comparison complete');
    } catch (err: any) {
      toast.error('Comparison failed', { description: err.message });
    } finally {
      setComparing(false);
    }
  };

  const fileA = readyFiles.find(f => f.uuid === uuidA);
  const fileB = readyFiles.find(f => f.uuid === uuidB);

  const tabs = [
    { id: 'added', label: 'Added', count: result?.added?.length || 0, color: 'var(--color-success)', icon: Plus },
    { id: 'removed', label: 'Removed', count: result?.removed?.length || 0, color: 'var(--color-error)', icon: Minus },
    { id: 'modified', label: 'Modified', count: result?.modified?.length || 0, color: 'var(--color-warning)', icon: Edit3 },
    { id: 'timing', label: 'Timing Δ', count: result?.timingDifferences?.length || 0, color: 'var(--color-info)', icon: ArrowUpDown },
    { id: 'size', label: 'Size Δ', count: result?.sizeDifferences?.length || 0, color: 'var(--color-purple)', icon: ArrowUpDown },
  ] as const;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <header className="har-header sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <button onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md"
            style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-2)' }}>
            <ArrowLeft size={13} /> Back
          </button>
          <GitCompare size={16} style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            HAR Comparison
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Setup panel */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--color-text-muted)' }}>
            SELECT TWO ARCHIVES TO COMPARE
          </h2>
          <div className="grid grid-cols-5 gap-4 items-end">
            {/* Archive A */}
            <div className="col-span-2">
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>
                Archive A (Baseline)
              </label>
              <select value={uuidA} onChange={e => setUuidA(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                style={{ background: 'var(--color-surface-2)', border: `1px solid ${uuidA ? 'var(--color-accent)' : 'var(--color-border)'}`, color: 'var(--color-text-primary)' }}>
                <option value="">Select baseline archive...</option>
                {readyFiles.map(f => (
                  <option key={f.uuid} value={f.uuid}>{f.fileName} ({f.entryCount} requests)</option>
                ))}
              </select>
              {fileA && (
                <div className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {fileA.browserName} {fileA.browserVersion} · {formatBytes(fileA.fileSize)}
                </div>
              )}
            </div>

            {/* VS divider */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-px h-6" style={{ background: 'var(--color-border)' }} />
              <span className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                VS
              </span>
              <div className="w-px h-6" style={{ background: 'var(--color-border)' }} />
            </div>

            {/* Archive B */}
            <div className="col-span-2">
              <label className="text-xs mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>
                Archive B (Compare)
              </label>
              <select value={uuidB} onChange={e => setUuidB(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
                style={{ background: 'var(--color-surface-2)', border: `1px solid ${uuidB ? 'var(--color-accent)' : 'var(--color-border)'}`, color: 'var(--color-text-primary)' }}>
                <option value="">Select comparison archive...</option>
                {readyFiles.map(f => (
                  <option key={f.uuid} value={f.uuid}>{f.fileName} ({f.entryCount} requests)</option>
                ))}
              </select>
              {fileB && (
                <div className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {fileB.browserName} {fileB.browserVersion} · {formatBytes(fileB.fileSize)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button onClick={handleCompare} disabled={!uuidA || !uuidB || comparing || uuidA === uuidB}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-40"
              style={{ background: 'var(--color-accent)', color: '#000' }}>
              {comparing ? <Loader2 size={16} className="animate-spin" /> : <GitCompare size={16} />}
              {comparing ? 'Comparing...' : 'Run Comparison'}
            </button>
            {readyFiles.length < 2 && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                You need at least 2 processed HAR archives to compare.{' '}
                <button onClick={() => router.push('/')} style={{ color: 'var(--color-accent)' }}>
                  Upload more →
                </button>
              </p>
            )}
          </div>
        </motion.div>

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-3">
              {tabs.map(({ id, label, count, color, icon: Icon }) => (
                <div key={id} className="rounded-xl p-4 text-center cursor-pointer transition-all"
                  onClick={() => setActiveTab(id as any)}
                  style={{
                    background: activeTab === id ? `${color}12` : 'var(--color-surface-1)',
                    border: `1px solid ${activeTab === id ? color : 'var(--color-border)'}`,
                    boxShadow: activeTab === id ? `0 0 16px ${color}20` : 'none',
                  }}>
                  <Icon size={18} className="mx-auto mb-2" style={{ color: count > 0 ? color : 'var(--color-text-muted)' }} />
                  <div className="text-2xl font-bold mb-1"
                    style={{ color: count > 0 ? color : 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {count}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Comparison insight */}
            <div className="rounded-xl p-4"
              style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              <div className="flex flex-wrap gap-6 text-xs">
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>New requests: </span>
                  <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{result.added?.length || 0}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Removed requests: </span>
                  <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>{result.removed?.length || 0}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>Modified requests: </span>
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{result.modified?.length || 0}</span>
                </div>
                {result.timingDifferences?.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Performance regressions: </span>
                    <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>
                      {result.timingDifferences.filter((t: any) => t.diff > 0).length}
                    </span>
                  </div>
                )}
                {result.timingDifferences?.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Performance improvements: </span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                      {result.timingDifferences.filter((t: any) => t.diff < 0).length}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Detail table */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              {/* Tab bar */}
              <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
                {tabs.map(({ id, label, count, color }) => (
                  <button key={id} onClick={() => setActiveTab(id as any)}
                    className="flex-1 text-xs py-3 font-medium transition-colors"
                    style={{
                      color: activeTab === id ? color : 'var(--color-text-muted)',
                      borderBottom: activeTab === id ? `2px solid ${color}` : '2px solid transparent',
                      background: activeTab === id ? `${color}08` : 'transparent',
                    }}>
                    {label} ({count})
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="divide-y overflow-auto max-h-[520px]" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {activeTab === 'added' && (result.added || []).map((e: any, i: number) => (
                  <CompareRow key={i} entry={e} type="added" />
                ))}
                {activeTab === 'removed' && (result.removed || []).map((e: any, i: number) => (
                  <CompareRow key={i} entry={e} type="removed" />
                ))}
                {activeTab === 'modified' && (result.modified || []).map((e: any, i: number) => (
                  <ModifiedRow key={i} entry={e} />
                ))}
                {activeTab === 'timing' && (result.timingDifferences || []).map((t: any, i: number) => (
                  <DiffRow key={i}
                    url={t.url}
                    left={formatDuration(t.aDuration)}
                    right={formatDuration(t.bDuration)}
                    diff={`${t.diff > 0 ? '+' : ''}${formatDuration(t.diff)}`}
                    diffPositive={t.diff <= 0}
                    note={`${t.percentChange > 0 ? '+' : ''}${t.percentChange.toFixed(0)}%`}
                  />
                ))}
                {activeTab === 'size' && (result.sizeDifferences || []).map((s: any, i: number) => (
                  <DiffRow key={i}
                    url={s.url}
                    left={formatBytes(s.aSize)}
                    right={formatBytes(s.bSize)}
                    diff={`${s.diff > 0 ? '+' : ''}${formatBytes(s.diff)}`}
                    diffPositive={s.diff <= 0}
                    note={`${s.percentChange > 0 ? '+' : ''}${s.percentChange.toFixed(0)}%`}
                  />
                ))}
                {((activeTab === 'added' && !result.added?.length) ||
                  (activeTab === 'removed' && !result.removed?.length) ||
                  (activeTab === 'modified' && !result.modified?.length) ||
                  (activeTab === 'timing' && !result.timingDifferences?.length) ||
                  (activeTab === 'size' && !result.sizeDifferences?.length)) && (
                  <div className="py-12 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    No differences in this category
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function CompareRow({ entry, type }: { entry: any; type: 'added' | 'removed' }) {
  const color = type === 'added' ? 'var(--color-success)' : 'var(--color-error)';
  const Icon = type === 'added' ? Plus : Minus;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Icon size={12} style={{ color, flexShrink: 0 }} />
      <span className="text-xs font-bold w-12 flex-shrink-0" style={{ color: getMethodColor(entry.method), fontFamily: 'var(--font-mono)' }}>
        {entry.method}
      </span>
      <span className="text-xs font-bold w-10 flex-shrink-0" style={{ color: getStatusColor(entry.status), fontFamily: 'var(--font-mono)' }}>
        {entry.status}
      </span>
      <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {truncateUrl(entry.url, 80)}
      </span>
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {formatDuration(entry.duration)}
      </span>
    </div>
  );
}

function ModifiedRow({ entry }: { entry: any }) {
  const [expanded, setExpanded] = useState(false);
  const statusChanged = entry.a?.status !== entry.b?.status;
  const headerCount = entry.headerDiffs?.length || 0;
  const cookieCount = entry.cookieDiffs?.length || 0;

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{ background: expanded ? 'var(--color-surface-2)' : 'transparent' }}>
        <Edit3 size={12} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
        <span className="text-xs font-bold w-12 flex-shrink-0" style={{ color: getMethodColor(entry.a?.method), fontFamily: 'var(--font-mono)' }}>
          {entry.a?.method}
        </span>
        <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {truncateUrl(entry.url, 70)}
        </span>
        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          {statusChanged && (
            <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)' }}>
              Status: {entry.a?.status} → {entry.b?.status}
            </span>
          )}
          {Math.abs(entry.timingDiff || 0) > 100 && (
            <span style={{ color: (entry.timingDiff || 0) > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
              {(entry.timingDiff || 0) > 0 ? '+' : ''}{formatDuration(entry.timingDiff)}
            </span>
          )}
          {headerCount > 0 && (
            <span style={{ color: 'var(--color-info)' }}>{headerCount} header Δ</span>
          )}
          {entry.bodyChanged && (
            <span style={{ color: 'var(--color-warning)' }}>Body changed</span>
          )}
        </div>
      </div>

      {expanded && headerCount > 0 && (
        <div className="px-10 pb-3 space-y-1.5">
          {entry.headerDiffs.slice(0, 15).map((h: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`w-4 text-center rounded font-bold flex-shrink-0 ${
                h.type === 'added' ? 'text-green-400' : h.type === 'removed' ? 'text-red-400' : 'text-yellow-400'
              }`}>{h.type === 'added' ? '+' : h.type === 'removed' ? '-' : '~'}</span>
              <span style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', minWidth: 160 }}>{h.name}:</span>
              <div className="flex gap-2 flex-wrap">
                {h.aValue && <span className="line-through opacity-60" style={{ color: 'var(--color-error)' }}>{h.aValue.slice(0, 80)}</span>}
                {h.bValue && <span style={{ color: 'var(--color-success)' }}>{h.bValue.slice(0, 80)}</span>}
              </div>
            </div>
          ))}
          {headerCount > 15 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>+{headerCount - 15} more header changes</span>
          )}
        </div>
      )}
    </div>
  );
}

function DiffRow({ url, left, right, diff, diffPositive, note }: {
  url: string; left: string; right: string; diff: string; diffPositive: boolean; note: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {truncateUrl(url, 60)}
      </span>
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{left}</span>
      <ArrowUpDown size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>{right}</span>
      <span className="text-xs font-bold flex-shrink-0 w-24 text-right"
        style={{ color: diffPositive ? 'var(--color-success)' : 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>
        {diff} ({note})
      </span>
    </div>
  );
}
