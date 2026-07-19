'use client';

import { useState } from 'react';
import { Search, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { HarHeader } from '@har-viewer/shared';
import { copyToClipboard } from '@/lib/utils';

interface HeadersTabProps {
  headers: HarHeader[];
  title: string;
}

const KNOWN_SECURITY_HEADERS = new Set([
  'strict-transport-security', 'content-security-policy', 'x-frame-options',
  'x-content-type-options', 'permissions-policy', 'referrer-policy',
  'cross-origin-embedder-policy', 'cross-origin-opener-policy',
]);

export function HeadersTab({ headers, title }: HeadersTabProps) {
  const [search, setSearch] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const filtered = headers.filter(h =>
    !search ||
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.value.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const rawText = headers.map(h => `${h.name}: ${h.value}`).join('\n');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="relative flex-1">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter headers..."
            className="w-full text-xs pl-6 pr-2 py-1 rounded outline-none"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
        <button onClick={() => { copyToClipboard(rawText); toast.success('Headers copied'); }}
          className="text-xs px-2 py-1 rounded"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          <Copy size={11} />
        </button>
        <button onClick={() => setShowRaw(!showRaw)}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: showRaw ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
            border: `1px solid ${showRaw ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: showRaw ? 'var(--color-accent)' : 'var(--color-text-muted)',
          }}>
          Raw
        </button>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length}/{headers.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {showRaw ? (
          <pre className="text-xs p-3 rounded-lg overflow-auto"
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
            {rawText}
          </pre>
        ) : (
          <div className="space-y-0.5">
            {sorted.map((header, i) => {
              const isSecurity = KNOWN_SECURITY_HEADERS.has(header.name.toLowerCase());
              return (
                <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded group hover:bg-slate-800/40">
                  <span className="text-xs flex-shrink-0 break-all"
                    style={{
                      color: isSecurity ? 'var(--color-warning)' : 'var(--color-accent)',
                      fontFamily: 'var(--font-mono)',
                      width: 180,
                      minWidth: 180,
                    }}>
                    {header.name}
                  </span>
                  <span className="text-xs flex-1 break-all"
                    style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {header.value}
                  </span>
                  <button
                    onClick={() => { copyToClipboard(header.value); toast.success('Copied'); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                    <Copy size={10} style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                No headers match
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
