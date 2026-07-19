'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, GitCompare, Zap, ChevronDown,
  FileJson, FileText, File, Code2, Search
} from 'lucide-react';
import { harApi } from '@/lib/api';
import { formatBytes, formatDuration, downloadFile } from '@/lib/utils';
import { HarAnalysis } from '@har-viewer/shared';

interface ViewerHeaderProps {
  analysis: HarAnalysis;
  uuid: string;
  onSearchOpen?: () => void;
}

export function ViewerHeader({ analysis, uuid, onSearchOpen }: ViewerHeaderProps) {
  const router = useRouter();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { fileInfo, dashboard } = analysis;
  const { requestSummary: rs, timingSummary: ts, transferSummary: tr } = dashboard;

  const handleExport = async (format: string) => {
    setExportMenuOpen(false);
    setExporting(true);
    try {
      const result = await harApi.export(uuid, format);
      downloadFile(result.content, result.fileName, result.mimeType);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error('Export failed', { description: err.message });
    } finally {
      setExporting(false);
    }
  };

  const stats = [
    { label: 'Requests', value: rs.total.toString() },
    { label: 'Failed',   value: rs.failed.toString(), accent: rs.failed > 0 ? 'var(--color-error)' : undefined },
    { label: 'Cached',   value: rs.cached.toString(), accent: rs.cached > 0 ? 'var(--color-purple)' : undefined },
    { label: 'Transferred', value: formatBytes(tr.totalTransferredBytes) },
    { label: 'Avg Time', value: formatDuration(ts.avgDuration) },
    { label: 'P95',      value: formatDuration(ts.p95) },
  ];

  return (
    <header className="har-header flex-shrink-0 z-40">
      <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <button onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors flex-shrink-0"
          style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-2)' }}>
          <ArrowLeft size={13} /> Back
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <Zap size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span className="text-sm font-semibold truncate max-w-[220px]" style={{ color: 'var(--color-text-primary)' }}>
            {fileInfo.fileName}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)' }}>
            {fileInfo.browserName} {fileInfo.browserVersion}
          </span>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-px rounded-lg overflow-hidden flex-shrink-0"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          {stats.map((stat, i) => (
            <div key={stat.label} className="flex flex-col items-center px-2.5 py-1.5 gap-px"
              style={{ borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
              <span className="text-xs font-semibold"
                style={{ color: stat.accent || 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                {stat.value}
              </span>
              <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {onSearchOpen && (
            <button onClick={onSearchOpen}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <Search size={13} />
              <span>Search</span>
              <kbd className="text-xs px-1 rounded"
                style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', fontSize: 9 }}>⌘K</kbd>
            </button>
          )}

          <button onClick={() => router.push('/compare')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <GitCompare size={13} /> Compare
          </button>

          <div className="relative">
            <button onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: 'var(--color-accent)', color: '#000' }}
              disabled={exporting}>
              <Download size={13} /> Export <ChevronDown size={11} />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 rounded-lg shadow-2xl z-50 overflow-hidden"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', minWidth: 170 }}>
                {[
                  { fmt: 'json', icon: FileJson, label: 'Export JSON' },
                  { fmt: 'csv',  icon: FileText, label: 'Export CSV' },
                  { fmt: 'markdown', icon: File, label: 'Export Markdown' },
                  { fmt: 'html', icon: Code2,  label: 'Export HTML Report' },
                ].map(({ fmt, icon: Icon, label }) => (
                  <button key={fmt} onClick={() => handleExport(fmt)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <Icon size={13} style={{ color: 'var(--color-accent)' }} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
