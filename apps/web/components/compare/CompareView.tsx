'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompare, Plus, Minus, Edit3, Loader2, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import * as jsondiffpatch from 'jsondiffpatch';
import { HarAnalysis } from '@har-viewer/shared';
import { harApi } from '@/lib/api';
import { useHarStore } from '@/store/har-store';
import { formatBytes, formatDuration, getMethodColor, getStatusColor, truncateUrl } from '@/lib/utils';
import { getHttpStatus } from '@/lib/enrichment';

interface CompareViewProps { currentUuid: string; analysis: HarAnalysis; }

// Build jsondiffpatch instance
const differ = jsondiffpatch.create({
  objectHash: (obj: any) => obj?.name ?? obj?.id ?? JSON.stringify(obj),
  arrays: { detectMove: true },
});

function renderDelta(delta: any, left: any, indent = 0): React.ReactNode[] {
  if (!delta) return [];
  const nodes: React.ReactNode[] = [];
  const pad = '  '.repeat(indent);

  if (Array.isArray(delta)) {
    // Added: [value]
    if (delta.length === 1) {
      nodes.push(
        <div key="add" style={{ color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {pad}+ {JSON.stringify(delta[0])}
        </div>
      );
    }
    // Modified: [oldVal, newVal]
    else if (delta.length === 2) {
      nodes.push(
        <div key="old" style={{ color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {pad}- {JSON.stringify(delta[0])}
        </div>,
        <div key="new" style={{ color: '#10b981', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {pad}+ {JSON.stringify(delta[1])}
        </div>
      );
    }
    // Deleted: [value, 0, 0]
    else if (delta.length === 3 && delta[1] === 0 && delta[2] === 0) {
      nodes.push(
        <div key="del" style={{ color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {pad}- {JSON.stringify(delta[0])}
        </div>
      );
    }
  } else if (typeof delta === 'object') {
    for (const [key, val] of Object.entries(delta)) {
      if (key === '_t') continue; // array marker
      nodes.push(
        <div key={key} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-accent)' }}>
          {pad}<span style={{ color: 'var(--color-text-muted)' }}>{key}:</span>
        </div>,
        ...renderDelta(val, (left as any)?.[key], indent + 1)
      );
    }
  }
  return nodes;
}

function JsonDiffView({ left, right }: { left: any; right: any }) {
  const delta = useMemo(() => {
    try { return differ.diff(left, right); } catch { return null; }
  }, [left, right]);

  if (!delta) return (
    <p className="text-xs p-3" style={{ color: 'var(--color-success)' }}>✓ No differences</p>
  );

  const nodes = renderDelta(delta, left);

  return (
    <div className="p-3 overflow-auto max-h-64">
      {nodes.length > 0 ? nodes : (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No visible changes</p>
      )}
    </div>
  );
}

function StatusChangeBar({ a, b }: { a: number; b: number }) {
  const sa = getHttpStatus(a);
  const sb = getHttpStatus(b);
  if (a === b) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold" style={{ color: sa.color, fontFamily: 'var(--font-mono)' }}>
        {sa.emoji} {a}
      </span>
      <ArrowUpDown size={11} style={{ color: 'var(--color-text-muted)' }} />
      <span className="text-xs font-bold" style={{ color: sb.color, fontFamily: 'var(--font-mono)' }}>
        {sb.emoji} {b}
      </span>
    </div>
  );
}

function CompareRow({ entry, type }: { entry: any; type: 'added' | 'removed' }) {
  const color = type === 'added' ? 'var(--color-success)' : 'var(--color-error)';
  const Icon  = type === 'added' ? Plus : Minus;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <Icon size={12} style={{ color, flexShrink: 0 }} />
      <span className="text-xs font-bold w-12 flex-shrink-0"
        style={{ color: getMethodColor(entry.method), fontFamily: 'var(--font-mono)' }}>
        {entry.method}
      </span>
      <span className="text-xs font-bold w-10 flex-shrink-0"
        style={{ color: getStatusColor(entry.status), fontFamily: 'var(--font-mono)' }}>
        {entry.status}
      </span>
      <span className="text-xs truncate flex-1"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
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
  const [diffTab, setDiffTab] = useState<'headers' | 'body' | 'cookies'>('headers');

  const reqHeadersA = entry.a?.rawEntry?.request?.headers || [];
  const reqHeadersB = entry.b?.rawEntry?.request?.headers || [];
  const resHeadersA = entry.a?.rawEntry?.response?.headers || [];
  const resHeadersB = entry.b?.rawEntry?.response?.headers || [];
  const bodyA = entry.a?.rawEntry?.request?.postData?.text || '';
  const bodyB = entry.b?.rawEntry?.request?.postData?.text || '';
  const cookiesA = entry.a?.rawEntry?.request?.cookies || [];
  const cookiesB = entry.b?.rawEntry?.request?.cookies || [];

  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{ background: expanded ? 'var(--color-surface-2)' : 'transparent' }}>
        <Edit3 size={12} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
        <span className="text-xs font-bold w-12 flex-shrink-0"
          style={{ color: getMethodColor(entry.a?.method), fontFamily: 'var(--font-mono)' }}>
          {entry.a?.method}
        </span>
        <span className="text-xs flex-1 truncate"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {truncateUrl(entry.url, 60)}
        </span>
        <div className="flex items-center gap-3 text-xs flex-shrink-0">
          <StatusChangeBar a={entry.a?.status} b={entry.b?.status} />
          {Math.abs(entry.timingDiff || 0) > 50 && (
            <span style={{ color: (entry.timingDiff || 0) > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
              {(entry.timingDiff || 0) > 0 ? '+' : ''}{formatDuration(entry.timingDiff)}
            </span>
          )}
          {Math.abs(entry.sizeDiff || 0) > 512 && (
            <span style={{ color: (entry.sizeDiff || 0) > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {(entry.sizeDiff || 0) > 0 ? '+' : ''}{formatBytes(entry.sizeDiff)}
            </span>
          )}
          {entry.headerDiffs?.length > 0 && (
            <span style={{ color: 'var(--color-info)' }}>{entry.headerDiffs.length} header Δ</span>
          )}
          {entry.bodyChanged && (
            <span style={{ color: 'var(--color-warning)' }}>body changed</span>
          )}
        </div>
        {expanded ? <ChevronDown size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {/* Diff tab bar */}
            <div className="flex items-center gap-1 px-4 py-1.5"
              style={{ borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-1)' }}>
              {([
                { id: 'headers', label: `Req Headers (${entry.headerDiffs?.length || 0} Δ)` },
                { id: 'body',    label: 'Request Body' },
                { id: 'cookies', label: `Cookies (${entry.cookieDiffs?.length || 0} Δ)` },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setDiffTab(t.id)}
                  className="text-xs px-2.5 py-1 rounded transition-colors"
                  style={{
                    background: diffTab === t.id ? 'var(--color-accent-bg)' : 'transparent',
                    color: diffTab === t.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    border: `1px solid ${diffTab === t.id ? 'var(--color-accent)' : 'transparent'}`,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ background: 'var(--color-surface-1)', maxHeight: 280, overflow: 'auto' }}>
              {diffTab === 'headers' && (
                <JsonDiffView
                  left={Object.fromEntries((reqHeadersA).map((h: any) => [h.name, h.value]))}
                  right={Object.fromEntries((reqHeadersB).map((h: any) => [h.name, h.value]))}
                />
              )}
              {diffTab === 'body' && (
                (() => {
                  let la = bodyA, rb = bodyB;
                  try { la = JSON.parse(bodyA); } catch {}
                  try { rb = JSON.parse(bodyB); } catch {}
                  return typeof la === 'object' && typeof rb === 'object'
                    ? <JsonDiffView left={la} right={rb} />
                    : (
                      <div className="grid grid-cols-2 gap-2 p-3">
                        {[['A (Before)', la, 'var(--color-error)'], ['B (After)', rb, 'var(--color-success)']].map(([label, val, color]) => (
                          <div key={label as string}>
                            <div className="text-xs mb-1 font-semibold" style={{ color: color as string }}>{label as string}</div>
                            <pre className="text-xs p-2 rounded overflow-auto max-h-40"
                              style={{ background: 'var(--color-surface-2)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                              {String(val) || '(empty)'}
                            </pre>
                          </div>
                        ))}
                      </div>
                    );
                })()
              )}
              {diffTab === 'cookies' && (
                <JsonDiffView
                  left={Object.fromEntries(cookiesA.map((c: any) => [c.name, c.value]))}
                  right={Object.fromEntries(cookiesB.map((c: any) => [c.name, c.value]))}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DiffRow({ url, left, right, diff, diffPositive, note }: {
  url: string; left: string; right: string; diff: string; diffPositive: boolean; note: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span className="text-xs truncate flex-1"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {truncateUrl(url, 60)}
      </span>
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{left}</span>
      <ArrowUpDown size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>{right}</span>
      <span className="text-xs font-bold flex-shrink-0 w-28 text-right"
        style={{ color: diffPositive ? 'var(--color-success)' : 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>
        {diff} ({note})
      </span>
    </div>
  );
}

export function CompareView({ currentUuid, analysis }: CompareViewProps) {
  const { harFiles } = useHarStore();
  const [targetUuid, setTargetUuid] = useState('');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'added' | 'removed' | 'modified' | 'timing' | 'size'>('modified');

  const availableFiles = harFiles.filter(f => f.uuid !== currentUuid && f.status === 'complete');

  const handleCompare = async () => {
    if (!targetUuid) { toast.error('Select a HAR file to compare'); return; }
    setComparing(true);
    try {
      const r = await harApi.compare(currentUuid, targetUuid);
      setResult(r);
      toast.success('Comparison complete', {
        description: `${r.added?.length} added, ${r.removed?.length} removed, ${r.modified?.length} modified`
      });
    } catch (err: any) {
      toast.error('Comparison failed', { description: err.message });
    } finally { setComparing(false); }
  };

  const tabs = [
    { id: 'added',    label: 'Added',     count: result?.added?.length     || 0, color: 'var(--color-success)' },
    { id: 'removed',  label: 'Removed',   count: result?.removed?.length   || 0, color: 'var(--color-error)' },
    { id: 'modified', label: 'Modified',  count: result?.modified?.length  || 0, color: 'var(--color-warning)' },
    { id: 'timing',   label: 'Timing Δ',  count: result?.timingDifferences?.length || 0, color: 'var(--color-info)' },
    { id: 'size',     label: 'Size Δ',    count: result?.sizeDifferences?.length   || 0, color: 'var(--color-purple)' },
  ] as const;

  return (
    <div className="flex flex-col h-full p-6 space-y-5 overflow-auto">
      {/* Setup panel */}
      <div className="rounded-xl p-5"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <GitCompare size={16} style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Compare Archives — jsondiffpatch powered
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 items-end">
          {/* A */}
          <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-accent)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--color-accent)' }}>Archive A (Current)</div>
            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
              {analysis.fileInfo.fileName}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {analysis.entries.length} requests
            </div>
          </div>

          {/* B selector */}
          <div className="flex flex-col gap-2">
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Archive B (Compare to)</div>
            {availableFiles.length > 0 ? (
              <select value={targetUuid} onChange={e => setTargetUuid(e.target.value)}
                className="text-xs px-3 py-2 rounded-lg outline-none"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                <option value="">Select archive…</option>
                {availableFiles.map(f => (
                  <option key={f.uuid} value={f.uuid}>{f.fileName} ({f.entryCount} reqs)</option>
                ))}
              </select>
            ) : (
              <div className="text-xs px-3 py-2 rounded-lg"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                Upload another HAR to compare
              </div>
            )}
          </div>

          <button onClick={handleCompare} disabled={!targetUuid || comparing}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-40"
            style={{ background: targetUuid ? 'var(--color-accent)' : 'var(--color-surface-3)', color: targetUuid ? '#000' : 'var(--color-text-muted)' }}>
            {comparing ? <Loader2 size={14} className="animate-spin" /> : <GitCompare size={14} />}
            {comparing ? 'Comparing…' : 'Run Comparison'}
          </button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-5 gap-3">
              {tabs.map(t => (
                <div key={t.id} onClick={() => setActiveTab(t.id as any)}
                  className="rounded-xl p-4 text-center cursor-pointer transition-all"
                  style={{
                    background: activeTab === t.id ? `${t.color}12` : 'var(--color-surface-1)',
                    border: `1px solid ${activeTab === t.id ? t.color : 'var(--color-border)'}`,
                  }}>
                  <div className="text-2xl font-bold mb-1"
                    style={{ color: t.count > 0 ? t.color : 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {t.count}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.label}</div>
                </div>
              ))}
            </div>

            {/* Tab detail */}
            <div className="rounded-xl overflow-hidden"
              style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              {/* Tab bar */}
              <div className="flex border-b" style={{ borderColor: 'var(--color-border)' }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                    className="flex-1 text-xs py-2.5 font-medium transition-colors"
                    style={{
                      color: activeTab === t.id ? t.color : 'var(--color-text-muted)',
                      borderBottom: activeTab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                      background: activeTab === t.id ? `${t.color}08` : 'transparent',
                    }}>
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              <div className="max-h-[560px] overflow-auto divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {activeTab === 'added'    && (result.added    || []).map((e: any, i: number) => <CompareRow key={i} entry={e} type="added" />)}
                {activeTab === 'removed'  && (result.removed  || []).map((e: any, i: number) => <CompareRow key={i} entry={e} type="removed" />)}
                {activeTab === 'modified' && (result.modified || []).map((e: any, i: number) => <ModifiedRow key={i} entry={e} />)}
                {activeTab === 'timing'   && (result.timingDifferences || []).map((t: any, i: number) => (
                  <DiffRow key={i} url={t.url}
                    left={formatDuration(t.aDuration)} right={formatDuration(t.bDuration)}
                    diff={`${t.diff > 0 ? '+' : ''}${formatDuration(t.diff)}`}
                    diffPositive={t.diff <= 0}
                    note={`${t.percentChange > 0 ? '+' : ''}${t.percentChange.toFixed(0)}%`} />
                ))}
                {activeTab === 'size' && (result.sizeDifferences || []).map((s: any, i: number) => (
                  <DiffRow key={i} url={s.url}
                    left={formatBytes(s.aSize)} right={formatBytes(s.bSize)}
                    diff={`${s.diff > 0 ? '+' : ''}${formatBytes(s.diff)}`}
                    diffPositive={s.diff <= 0}
                    note={`${s.percentChange > 0 ? '+' : ''}${s.percentChange.toFixed(0)}%`} />
                ))}
                {((activeTab === 'added'    && !result.added?.length)    ||
                  (activeTab === 'removed'  && !result.removed?.length)  ||
                  (activeTab === 'modified' && !result.modified?.length) ||
                  (activeTab === 'timing'   && !result.timingDifferences?.length) ||
                  (activeTab === 'size'     && !result.sizeDifferences?.length)) && (
                  <div className="py-10 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    No differences in this category ✓
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && !comparing && (
        <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <div className="text-center">
            <GitCompare size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">Select a HAR file and click Compare to see a jsondiffpatch-powered diff</p>
          </div>
        </div>
      )}
    </div>
  );
}
