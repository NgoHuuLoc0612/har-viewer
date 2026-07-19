'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  useReactTable, getCoreRowModel,
  getSortedRowModel, flexRender, ColumnDef, SortingState,
  VisibilityState
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, X, ChevronUp, ChevronDown, SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { HarAnalysis, ProcessedEntry } from '@har-viewer/shared';
import { useHarStore } from '@/store/har-store';
import {
  formatBytes, formatDuration, getStatusColor, getMethodColor,
  truncateUrl, getMimeTypeColor, copyToClipboard
} from '@/lib/utils';
import { FilterPanel } from './FilterPanel';
import { ColumnToggle } from './ColumnToggle';

interface RequestTableProps {
  uuid: string;
  analysis: HarAnalysis;
}

const TIMING_BAR_MAX_MS = 5000;

function TimingBar({ entry, totalDuration }: { entry: ProcessedEntry; totalDuration: number }) {
  const phases = [
    { key: 'blockedTime', color: '#6b7280' },
    { key: 'dnsTime', color: '#8b5cf6' },
    { key: 'tcpTime', color: '#3b82f6' },
    { key: 'sslTime', color: '#06b6d4' },
    { key: 'sendTime', color: '#10b981' },
    { key: 'waitTime', color: '#f59e0b' },
    { key: 'receiveTime', color: '#ef4444' },
  ];

  const maxTime = Math.max(totalDuration, 1);
  const startOffset = (entry.startTime / (totalDuration / 1000)) * 100;
  const width = (entry.duration / maxTime) * 100;

  return (
    <div className="flex items-center w-full h-5" style={{ minWidth: 120 }}>
      <div className="relative flex-1 h-3 rounded-sm overflow-visible"
        style={{ background: 'var(--color-surface-3)' }}>
        <div
          className="absolute top-0 h-full flex rounded-sm overflow-hidden"
          style={{
            left: `${Math.min(startOffset, 95)}%`,
            width: `${Math.max(width, 0.5)}%`,
            minWidth: 2,
          }}>
          {phases.map(({ key, color }) => {
            const v = (entry as any)[key] as number;
            if (!v || v <= 0) return null;
            const w = (v / entry.duration) * 100;
            return <div key={key} style={{ width: `${w}%`, background: color, minWidth: 1 }} />;
          })}
        </div>
      </div>
    </div>
  );
}

export function RequestTable({ uuid, analysis }: RequestTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const {
    selectedEntry, setSelectedEntry, setDetailPanelOpen,
    filters, setFilters, columnVisibility, setColumnVisibility,
    waterfallHighlight, setWaterfallHighlight
  } = useHarStore();

  const [showFilters, setShowFilters] = useState(false);
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  const allEntries = analysis.entries as ProcessedEntry[];
  const totalDuration = analysis.dashboard.timingSummary.totalLoadingTime;

  // Apply client-side filters
  const filteredEntries = useMemo(() => {
    let e = allEntries;
    const { search, method, status, domain, resourceType, mimeType, minDuration, maxDuration, minSize, maxSize, cacheStatus, regex } = filters;

    if (search) {
      const q = regex ? null : search.toLowerCase();
      const re = regex ? (() => { try { return new RegExp(search, 'i'); } catch { return null; } })() : null;
      e = e.filter(entry => {
        const targets = [entry.url, entry.domain, entry.path, String(entry.status), entry.mimeType, entry.method];
        if (re) return targets.some(t => t && re.test(t));
        return targets.some(t => t && t.toLowerCase().includes(q!));
      });
    }
    if (method) e = e.filter(en => en.method === method);
    if (status) {
      if (status.endsWith('xx')) {
        const base = parseInt(status[0]) * 100;
        e = e.filter(en => en.status >= base && en.status < base + 100);
      } else {
        e = e.filter(en => String(en.status) === status);
      }
    }
    if (domain) e = e.filter(en => en.domain?.includes(domain));
    if (resourceType) e = e.filter(en => en.resourceType === resourceType);
    if (mimeType) e = e.filter(en => en.mimeType?.includes(mimeType));
    if (minDuration) e = e.filter(en => en.duration >= minDuration);
    if (maxDuration) e = e.filter(en => en.duration <= maxDuration);
    if (minSize) e = e.filter(en => en.transferredSize >= minSize);
    if (maxSize) e = e.filter(en => en.transferredSize <= maxSize);
    if (cacheStatus) e = e.filter(en => en.cacheStatus === cacheStatus);
    return e;
  }, [allEntries, filters]);

  const columns = useMemo<ColumnDef<ProcessedEntry>[]>(() => [
    {
      id: 'index',
      header: '#',
      accessorFn: (row) => row.index + 1,
      size: 48,
      cell: ({ row }) => (
        <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {row.original.index + 1}
        </span>
      ),
    },
    {
      id: 'method',
      header: 'Method',
      accessorKey: 'method',
      size: 68,
      cell: ({ row }) => (
        <span className="text-xs font-bold" style={{ color: getMethodColor(row.original.method), fontFamily: 'var(--font-mono)' }}>
          {row.original.method}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      size: 64,
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <span className="text-xs font-bold" style={{ color: getStatusColor(s), fontFamily: 'var(--font-mono)' }}>
            {s || '—'}
          </span>
        );
      },
    },
    {
      id: 'domain',
      header: 'Domain',
      accessorKey: 'domain',
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs truncate block" style={{ color: 'var(--color-text-secondary)' }}>
          {row.original.domain}
        </span>
      ),
    },
    {
      id: 'path',
      header: 'Path',
      accessorKey: 'path',
      size: 280,
      cell: ({ row }) => (
        <span className="text-xs truncate block" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}
          title={row.original.url}>
          {row.original.path || '/'}
        </span>
      ),
    },
    {
      id: 'resourceType',
      header: 'Type',
      accessorKey: 'resourceType',
      size: 90,
      cell: ({ row }) => (
        <span className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-secondary)' }}>
          {row.original.resourceType}
        </span>
      ),
    },
    {
      id: 'mimeType',
      header: 'MIME',
      accessorKey: 'mimeType',
      size: 140,
      cell: ({ row }) => (
        <span className="text-xs" style={{ color: getMimeTypeColor(row.original.mimeType) }}>
          {row.original.mimeType?.split(';')[0] || '—'}
        </span>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      accessorKey: 'duration',
      size: 88,
      cell: ({ row }) => {
        const d = row.original.duration;
        const color = d > 3000 ? 'var(--color-error)' : d > 1000 ? 'var(--color-warning)' : 'var(--color-text-primary)';
        return (
          <span className="text-xs font-semibold" style={{ color, fontFamily: 'var(--font-mono)' }}>
            {formatDuration(d)}
          </span>
        );
      },
    },
    {
      id: 'ttfb',
      header: 'TTFB',
      accessorKey: 'ttfb',
      size: 80,
      cell: ({ row }) => (
        <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          {formatDuration(row.original.ttfb)}
        </span>
      ),
    },
    {
      id: 'transferredSize',
      header: 'Size',
      accessorKey: 'transferredSize',
      size: 80,
      cell: ({ row }) => (
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {formatBytes(row.original.transferredSize)}
        </span>
      ),
    },
    {
      id: 'protocol',
      header: 'Protocol',
      accessorKey: 'httpVersion',
      size: 80,
      cell: ({ row }) => (
        <span className="text-xs" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
          {row.original.httpVersion || '—'}
        </span>
      ),
    },
    {
      id: 'cacheStatus',
      header: 'Cache',
      accessorKey: 'cacheStatus',
      size: 80,
      cell: ({ row }) => {
        const c = row.original.cacheStatus;
        const color = c === 'memory' || c === 'disk' ? 'var(--color-purple)' : 'var(--color-text-muted)';
        return <span className="text-xs" style={{ color }}>{c || '—'}</span>;
      },
    },
    {
      id: 'waterfall',
      header: 'Waterfall',
      size: 200,
      cell: ({ row }) => (
        <TimingBar entry={row.original} totalDuration={totalDuration} />
      ),
    },
  ], [totalDuration]);

  const visState: VisibilityState = useMemo(() => {
    const v: VisibilityState = {};
    Object.entries(columnVisibility).forEach(([k, show]) => { v[k] = show; });
    return v;
  }, [columnVisibility]);

  const table = useReactTable({
    data: filteredEntries,
    columns,
    state: { sorting, columnVisibility: visState },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 20,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const handleRowClick = useCallback((entry: ProcessedEntry) => {
    setSelectedEntry(entry);
    setDetailPanelOpen(true);
  }, [setSelectedEntry, setDetailPanelOpen]);

  const handleCopyUrl = useCallback((e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    copyToClipboard(url);
    toast.success('URL copied');
  }, []);

  const uniqueDomains = useMemo(() => [...new Set(allEntries.map(e => e.domain))].filter(Boolean).sort(), [allEntries]);
  const uniqueMimeTypes = useMemo(() => [...new Set(allEntries.map(e => e.mimeType?.split(';')[0]))].filter(Boolean).sort(), [allEntries]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }} />
          <input
            value={filters.search}
            onChange={e => setFilters({ search: e.target.value })}
            placeholder={filters.regex ? 'Regex pattern...' : 'Search URL, domain, path...'}
            className="w-full text-xs pl-8 pr-8 py-1.5 rounded-lg outline-none"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          {filters.search && (
            <button onClick={() => setFilters({ search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X size={12} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>

        {/* Regex toggle */}
        <button onClick={() => setFilters({ regex: !filters.regex })}
          className="text-xs px-2 py-1.5 rounded-md font-mono transition-colors"
          style={{
            background: filters.regex ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
            border: `1px solid ${filters.regex ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: filters.regex ? 'var(--color-accent)' : 'var(--color-text-muted)',
          }}>
          .*
        </button>

        {/* Quick filters */}
        {['GET', 'POST', '2xx', '4xx', '5xx'].map(q => (
          <button key={q}
            onClick={() => {
              if (['GET', 'POST'].includes(q)) {
                setFilters({ method: filters.method === q ? '' : q });
              } else {
                setFilters({ status: filters.status === q ? '' : q });
              }
            }}
            className="text-xs px-2 py-1 rounded-md font-mono transition-colors"
            style={{
              background: (filters.method === q || filters.status === q) ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
              border: `1px solid ${(filters.method === q || filters.status === q) ? 'var(--color-accent)' : 'var(--color-border)'}`,
              color: (filters.method === q || filters.status === q) ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}>
            {q}
          </button>
        ))}

        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ml-auto"
          style={{
            background: showFilters ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
            border: `1px solid ${showFilters ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: showFilters ? 'var(--color-accent)' : 'var(--color-text-muted)',
          }}>
          <Filter size={12} />
          Filters
        </button>

        <button onClick={() => setShowColumnToggle(!showColumnToggle)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}>
          <SlidersHorizontal size={12} />
          Columns
        </button>

        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {filteredEntries.length}/{allEntries.length}
        </span>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden flex-shrink-0">
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              resetFilters={() => useHarStore.getState().resetFilters()}
              domains={uniqueDomains}
              mimeTypes={uniqueMimeTypes}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Column Toggle */}
      <AnimatePresence>
        {showColumnToggle && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden flex-shrink-0">
            <ColumnToggle
              columns={columns}
              visibility={columnVisibility}
              setVisibility={setColumnVisibility}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          {table.getHeaderGroups().map(headerGroup => (
            <div key={headerGroup.id} className="flex items-center"
              style={{ background: 'var(--color-surface-0)' }}>
              {headerGroup.headers.map(header => (
                <div key={header.id}
                  className="flex items-center gap-1 px-2 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none flex-shrink-0"
                  style={{
                    width: header.getSize(),
                    color: 'var(--color-text-muted)',
                    borderRight: '1px solid var(--color-border-subtle)',
                  }}
                  onClick={header.column.getToggleSortingHandler()}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc' && <ChevronUp size={11} />}
                  {header.column.getIsSorted() === 'desc' && <ChevronDown size={11} />}
                  {header.column.getCanSort() && !header.column.getIsSorted() && (
                    <ArrowUpDown size={9} style={{ opacity: 0.3 }} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Virtualized body */}
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div style={{ height: totalSize, position: 'relative' }}>
            {virtualRows.map(virtualRow => {
              const row = rows[virtualRow.index];
              const isSelected = selectedEntry?.index === row.original.index;
              const isHighlighted = waterfallHighlight === row.original.index;

              return (
                <div
                  key={row.id}
                  className="flex items-center absolute w-full cursor-pointer"
                  style={{
                    top: virtualRow.start,
                    height: virtualRow.size,
                    background: isSelected
                      ? 'var(--color-accent-bg)'
                      : isHighlighted
                        ? 'var(--color-surface-2)'
                        : 'transparent',
                    borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
                    borderBottom: '1px solid var(--color-border-subtle)',
                  }}
                  onClick={() => handleRowClick(row.original)}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-1)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}>
                  {row.getVisibleCells().map(cell => (
                    <div key={cell.id}
                      className="px-2 overflow-hidden flex-shrink-0"
                      style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {rows.length === 0 && (
            <div className="flex items-center justify-center h-32" style={{ color: 'var(--color-text-muted)' }}>
              <div className="text-center">
                <p className="text-sm mb-1">No requests match the current filters</p>
                <button onClick={() => useHarStore.getState().resetFilters()}
                  className="text-xs" style={{ color: 'var(--color-accent)' }}>
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
