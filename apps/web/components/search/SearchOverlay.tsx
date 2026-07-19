'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ExternalLink, Command } from 'lucide-react';
import { HarAnalysis, ProcessedEntry } from '@har-viewer/shared';
import { useHarStore } from '@/store/har-store';
import {
  getMethodColor, getStatusColor, formatDuration, formatBytes,
  truncateUrl, getMimeTypeColor
} from '@/lib/utils';

interface SearchOverlayProps {
  analysis: HarAnalysis;
  open: boolean;
  onClose: () => void;
}

const SEARCH_FIELDS = [
  { key: 'url', label: 'URL' },
  { key: 'domain', label: 'Domain' },
  { key: 'path', label: 'Path' },
  { key: 'mimeType', label: 'MIME' },
  { key: 'status', label: 'Status' },
  { key: 'method', label: 'Method' },
  { key: 'remoteIp', label: 'IP' },
  { key: 'httpVersion', label: 'Protocol' },
  { key: 'cacheStatus', label: 'Cache' },
];

export function SearchOverlay({ analysis, open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(['url', 'domain', 'path']);
  const [regex, setRegex] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSelectedEntry, setDetailPanelOpen, setActiveTab } = useHarStore();

  useEffect(() => {
    if (open) { setQuery(''); setSelectedIdx(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim() || !analysis?.entries) return [];
    const q = query.toLowerCase();
    const entries = analysis.entries as ProcessedEntry[];

    let matched: ProcessedEntry[];
    if (regex) {
      try {
        const re = new RegExp(query, 'i');
        matched = entries.filter(e =>
          selectedFields.some(f => { const v = String((e as any)[f] ?? ''); return re.test(v); })
        );
      } catch { return []; }
    } else {
      matched = entries.filter(e =>
        selectedFields.some(f => String((e as any)[f] ?? '').toLowerCase().includes(q))
      );
    }
    return matched.slice(0, 100);
  }, [query, selectedFields, regex, analysis]);

  const handleSelect = (entry: ProcessedEntry) => {
    setSelectedEntry(entry);
    setDetailPanelOpen(true);
    setActiveTab('requests');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) handleSelect(results[selectedIdx]);
    if (e.key === 'Escape') onClose();
  };

  const toggleField = (field: string) => {
    setSelectedFields(f => f.includes(field) ? f.filter(x => x !== field) : [...f, field]);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose} />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl"
            style={{ top: '10vh' }}>
            <div className="rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
              {/* Input row */}
              <div className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Search size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search requests, URLs, headers, IPs…"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--color-text-primary)' }}
                />
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setRegex(!regex)}
                    className="text-xs px-1.5 py-0.5 rounded font-mono"
                    style={{
                      background: regex ? 'var(--color-accent-bg)' : 'var(--color-surface-3)',
                      border: `1px solid ${regex ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      color: regex ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}>.*</button>
                  {query && (
                    <button onClick={() => setQuery('')} className="p-0.5 rounded"
                      style={{ color: 'var(--color-text-muted)' }}>
                      <X size={14} />
                    </button>
                  )}
                  <kbd className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    ESC
                  </kbd>
                </div>
              </div>

              {/* Fields row */}
              <div className="flex items-center gap-1.5 px-4 py-2 flex-wrap"
                style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Search in:</span>
                {SEARCH_FIELDS.map(({ key, label }) => (
                  <button key={key} onClick={() => toggleField(key)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      background: selectedFields.includes(key) ? 'var(--color-accent-bg)' : 'var(--color-surface-3)',
                      border: `1px solid ${selectedFields.includes(key) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      color: selectedFields.includes(key) ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Results */}
              <div className="overflow-auto" style={{ maxHeight: '55vh' }}>
                {query && results.length === 0 && (
                  <div className="py-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No results for "{query}"
                  </div>
                )}
                {!query && (
                  <div className="py-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    <Command size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Type to search across {analysis?.entries?.length || 0} requests</p>
                    <p className="text-xs mt-1">↑↓ navigate · Enter select · ESC close</p>
                  </div>
                )}
                {results.map((entry, i) => (
                  <div key={entry.index}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                    style={{
                      background: i === selectedIdx ? 'var(--color-accent-bg)' : 'transparent',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      borderLeft: i === selectedIdx ? '2px solid var(--color-accent)' : '2px solid transparent',
                    }}
                    onClick={() => handleSelect(entry)}
                    onMouseEnter={() => setSelectedIdx(i)}>
                    <span className="text-xs font-bold w-11 flex-shrink-0"
                      style={{ color: getMethodColor(entry.method), fontFamily: 'var(--font-mono)' }}>
                      {entry.method}
                    </span>
                    <span className="text-xs font-bold w-9 flex-shrink-0"
                      style={{ color: getStatusColor(entry.status), fontFamily: 'var(--font-mono)' }}>
                      {entry.status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate"
                        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
                        title={entry.url}>
                        {entry.domain}<span style={{ color: 'var(--color-text-muted)' }}>{entry.path}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: getMimeTypeColor(entry.mimeType), fontSize: 10 }}>
                          {entry.mimeType?.split(';')[0] || entry.resourceType}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                          {formatDuration(entry.duration)} · {formatBytes(entry.transferredSize)}
                        </span>
                      </div>
                    </div>
                    <ExternalLink size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0, opacity: i === selectedIdx ? 1 : 0 }} />
                  </div>
                ))}
              </div>

              {/* Footer */}
              {results.length > 0 && (
                <div className="px-4 py-2 flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {results.length}{results.length === 100 ? '+' : ''} result{results.length !== 1 ? 's' : ''}
                    {query && ` for "${query}"`}
                  </span>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>↑↓ navigate</span>
                    <span>↵ open</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
