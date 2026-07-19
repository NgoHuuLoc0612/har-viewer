'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Search } from 'lucide-react';
import { HarAnalysis, ProcessedEntry } from '@har-viewer/shared';
import { useHarStore } from '@/store/har-store';
import {
  formatDuration, formatBytes, getMethodColor, getStatusColor,
  TIMING_COLORS, truncateUrl
} from '@/lib/utils';

interface CustomWaterfallProps { analysis: HarAnalysis; }

const ROW_H = 28;
const LABEL_W = 280;

export function CustomWaterfall({ analysis }: CustomWaterfallProps) {
  const { setSelectedEntry, setDetailPanelOpen } = useHarStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, offset: 0 });

  const allEntries = analysis.entries as ProcessedEntry[];
  const resourceTypes = [...new Set(allEntries.map(e => e.resourceType))].sort();

  const filtered = useMemo(() => {
    let e = allEntries;
    if (search) e = e.filter(en => en.url.toLowerCase().includes(search.toLowerCase()));
    if (filterType) e = e.filter(en => en.resourceType === filterType);
    return e;
  }, [allEntries, search, filterType]);

  const totalDuration = useMemo(() => {
    if (!filtered.length) return 1;
    return Math.max(...filtered.map(e => (e.startTime * 1000) + e.duration));
  }, [filtered]);

  const visibleDuration = totalDuration / zoom;

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, offset };
  };
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const barW = (containerRef.current?.offsetWidth ?? 900) - LABEL_W;
    const msPx = totalDuration / (barW * zoom);
    const next = Math.max(0, Math.min(dragStart.current.offset - (e.clientX - dragStart.current.x) * msPx, totalDuration - visibleDuration));
    setOffset(next);
  }, [totalDuration, zoom, visibleDuration]);
  const stopDrag = () => { isDragging.current = false; };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setZoom(z => Math.max(0.5, Math.min(z * (e.deltaY > 0 ? 0.8 : 1.25), 20)));
    }
  };

  const TICK_COUNT = 8;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => ({
    ms: offset + (i / TICK_COUNT) * visibleDuration,
    label: formatDuration(offset + (i / TICK_COUNT) * visibleDuration),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter requests..." className="text-xs pl-7 pr-2 py-1.5 rounded-lg outline-none w-44"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg outline-none"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value="">All types</option>
          {resourceTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setZoom(z => Math.max(0.5, z / 1.5))} className="p-1.5 rounded"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}><ZoomOut size={13} /></button>
          <span className="text-xs px-2" style={{ color: 'var(--color-text-muted)', minWidth: 44, textAlign: 'center' }}>{zoom.toFixed(1)}×</span>
          <button onClick={() => setZoom(z => Math.min(z * 1.5, 20))} className="p-1.5 rounded"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}><ZoomIn size={13} /></button>
          <button onClick={() => { setZoom(1); setOffset(0); }} className="p-1.5 rounded ml-1"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}><RotateCcw size={13} /></button>
        </div>
        <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length} requests · Drag to pan · Ctrl+scroll to zoom
        </span>
      </div>

      {/* Ruler header */}
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-1)', height: 28 }}>
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid var(--color-border)' }} />
        <div className="flex-1 relative overflow-hidden">
          {ticks.map((t, i) => (
            <div key={i} className="absolute top-0 bottom-0" style={{ left: `${(i / TICK_COUNT) * 100}%` }}>
              <div className="w-px h-full" style={{ background: 'var(--color-border)' }} />
              <span style={{ position: 'absolute', bottom: 2, fontSize: 9, color: 'var(--color-text-muted)', transform: 'translateX(-50%)' }}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div ref={containerRef} className="flex-1 overflow-auto cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={stopDrag} onMouseLeave={stopDrag} onWheel={handleWheel}>
        {filtered.map((entry) => {
          const startMs = entry.startTime * 1000;
          const leftPct = ((startMs - offset) / visibleDuration) * 100;
          const widthPct = (entry.duration / visibleDuration) * 100;
          if (leftPct + widthPct < 0 || leftPct > 100) return null;

          const phases = [
            { v: entry.blockedTime, c: TIMING_COLORS.blocked },
            { v: entry.dnsTime,     c: TIMING_COLORS.dns },
            { v: entry.tcpTime,     c: TIMING_COLORS.connect },
            { v: entry.sslTime,     c: TIMING_COLORS.ssl },
            { v: entry.sendTime,    c: TIMING_COLORS.send },
            { v: entry.waitTime,    c: TIMING_COLORS.wait },
            { v: entry.receiveTime, c: TIMING_COLORS.receive },
          ].filter(p => p.v > 0);
          const phaseTotal = phases.reduce((s, p) => s + p.v, 0) || entry.duration;

          return (
            <div key={entry.index} className="flex items-center"
              style={{ height: ROW_H, borderBottom: '1px solid var(--color-border-subtle)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-1)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              {/* Label */}
              <div className="flex items-center gap-1.5 px-2 flex-shrink-0 overflow-hidden"
                style={{ width: LABEL_W, height: '100%', borderRight: '1px solid var(--color-border-subtle)' }}>
                <span className="text-xs font-bold" style={{ color: getMethodColor(entry.method), fontFamily: 'var(--font-mono)', minWidth: 30, fontSize: 10 }}>{entry.method}</span>
                <span className="text-xs font-bold" style={{ color: getStatusColor(entry.status), fontFamily: 'var(--font-mono)', minWidth: 26, fontSize: 10 }}>{entry.status}</span>
                <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)', fontSize: 10, fontFamily: 'var(--font-mono)' }} title={entry.url}>
                  {entry.path || '/'}
                </span>
              </div>

              {/* Bar zone */}
              <div className="flex-1 relative cursor-pointer" style={{ height: '100%' }}
                onClick={() => { setSelectedEntry(entry); setDetailPanelOpen(true); }}>
                <div className="absolute top-1/2 -translate-y-1/2 flex overflow-hidden rounded-sm group"
                  style={{
                    left: `${Math.max(0, leftPct)}%`,
                    width: `${Math.min(100 - Math.max(0, leftPct), Math.max(widthPct, 0.2))}%`,
                    height: 14, minWidth: 2,
                  }}>
                  {phases.map((p, pi) => (
                    <div key={pi} style={{ width: `${(p.v / phaseTotal) * 100}%`, background: p.c, minWidth: 1 }} />
                  ))}
                  {phases.length === 0 && <div style={{ width: '100%', background: 'var(--color-accent)', opacity: 0.5 }} />}
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-0 mb-1 px-2 py-1.5 rounded-lg pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                    style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', fontSize: 11 }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {truncateUrl(entry.url, 50)}
                    </div>
                    <div style={{ color: '#94a3b8', marginTop: 2 }}>
                      {formatDuration(entry.duration)} · TTFB {formatDuration(entry.ttfb)} · {formatBytes(entry.transferredSize)}
                    </div>
                  </div>
                </div>
                {widthPct > 4 && (
                  <span className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${Math.min(98, Math.max(0, leftPct) + Math.min(100 - Math.max(0, leftPct), widthPct) + 0.3)}%`, fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    {formatDuration(entry.duration)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
