'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ZoomIn, ZoomOut, RotateCcw, Activity, Filter,
  Target, BarChart3, ChevronDown
} from 'lucide-react';
import { HarAnalysis, ProcessedEntry } from '@har-viewer/shared';
import { useHarStore } from '@/store/har-store';
import { formatDuration, formatBytes, getMethodColor, getStatusColor, TIMING_COLORS, TIMING_LABELS, truncateUrl } from '@/lib/utils';

interface FlameGraphProps { analysis: HarAnalysis; }

const PHASES = [
  { key: 'blockedTime', color: TIMING_COLORS.blocked,  label: 'Stalled',    shortLabel: 'BLK' },
  { key: 'proxyTime',   color: '#9ca3af',               label: 'Proxy',      shortLabel: 'PXY' },
  { key: 'dnsTime',     color: TIMING_COLORS.dns,       label: 'DNS',        shortLabel: 'DNS' },
  { key: 'tcpTime',     color: TIMING_COLORS.connect,   label: 'TCP',        shortLabel: 'TCP' },
  { key: 'sslTime',     color: TIMING_COLORS.ssl,       label: 'TLS',        shortLabel: 'TLS' },
  { key: 'sendTime',    color: TIMING_COLORS.send,      label: 'Send',       shortLabel: 'SND' },
  { key: 'waitTime',    color: TIMING_COLORS.wait,      label: 'TTFB',       shortLabel: 'WIT' },
  { key: 'receiveTime', color: TIMING_COLORS.receive,   label: 'Download',   shortLabel: 'DL'  },
];

const ROW_H = 24;
const LABEL_W = 260;
const MINI_H = 48;
const RULER_H = 24;

type GroupBy = 'none' | 'host' | 'protocol' | 'content-type' | 'status' | 'resource-type';
type SortBy = 'start' | 'duration' | 'size' | 'ttfb';

function calcPercentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function FlameGraph({ analysis }: FlameGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSelectedEntry, setDetailPanelOpen } = useHarStore();

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0); // ms
  const [hoveredEntry, setHoveredEntry] = useState<{ entry: ProcessedEntry; x: number; y: number } | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sortBy, setSortBy] = useState<SortBy>('start');
  const [filterType, setFilterType] = useState('');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPan = useRef(0);

  const allEntries = analysis.entries as ProcessedEntry[];

  // Compute total timeline extent
  const { totalMs, entries } = useMemo(() => {
    let filtered = allEntries;
    if (filterType) filtered = filtered.filter(e => e.resourceType === filterType);

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'start') return a.startTime - b.startTime;
      if (sortBy === 'duration') return b.duration - a.duration;
      if (sortBy === 'size') return b.transferredSize - a.transferredSize;
      if (sortBy === 'ttfb') return b.ttfb - a.ttfb;
      return a.startTime - b.startTime;
    });

    const maxEnd = Math.max(...filtered.map(e => (e.startTime * 1000) + e.duration), 1);
    return { totalMs: maxEnd, entries: filtered };
  }, [allEntries, filterType, sortBy]);

  // Critical path: longest chain
  const criticalPath = useMemo(() => {
    if (!showCriticalPath) return new Set<number>();
    const sorted = [...entries].sort((a, b) => b.duration - a.duration);
    const top10 = new Set(sorted.slice(0, 10).map(e => e.index));
    return top10;
  }, [entries, showCriticalPath]);

  // Visible window in ms
  const visibleMs = totalMs / zoom;
  const clampedPan = Math.max(0, Math.min(panOffset, totalMs - visibleMs));

  // Tick interval
  const tickInterval = useMemo(() => {
    const rough = visibleMs / 8;
    const magnitudes = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];
    return magnitudes.find(m => m >= rough) || magnitudes[magnitudes.length - 1];
  }, [visibleMs]);

  // Stats
  const stats = useMemo(() => {
    const durs = entries.map(e => e.duration).filter(d => d > 0);
    const ttfbs = entries.map(e => e.ttfb).filter(t => t > 0);
    return {
      mean: durs.reduce((a, b) => a + b, 0) / (durs.length || 1),
      p50: calcPercentile(durs, 50),
      p95: calcPercentile(durs, 95),
      stddev: Math.sqrt(durs.reduce((a, b) => a + (b - (durs.reduce((x, y) => x + y, 0) / durs.length)) ** 2, 0) / (durs.length || 1)),
      max: Math.max(...durs, 0),
      min: Math.min(...durs.filter(d => d > 0), Infinity),
      ttfbMean: ttfbs.reduce((a, b) => a + b, 0) / (ttfbs.length || 1),
      ttfbP95: calcPercentile(ttfbs, 95),
    };
  }, [entries]);

  // Draw main canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const barW = W - LABEL_W;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, W, H);

    const msToX = (ms: number) => LABEL_W + ((ms - clampedPan) / visibleMs) * barW;
    const durationToW = (ms: number) => (ms / visibleMs) * barW;

    // Ruler
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(LABEL_W, 0, barW, RULER_H);
    ctx.strokeStyle = '#1e3050';
    ctx.lineWidth = 1;

    const firstTick = Math.ceil(clampedPan / tickInterval) * tickInterval;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    for (let t = firstTick; t <= clampedPan + visibleMs; t += tickInterval) {
      const x = msToX(t);
      if (x < LABEL_W || x > W) continue;
      ctx.beginPath();
      ctx.moveTo(x, RULER_H - 6);
      ctx.lineTo(x, RULER_H);
      ctx.strokeStyle = '#1e3050';
      ctx.stroke();
      ctx.fillText(formatMs(t), x, RULER_H - 8);
    }

    // Grid lines
    ctx.strokeStyle = '#0f1929';
    ctx.lineWidth = 1;
    for (let t = firstTick; t <= clampedPan + visibleMs; t += tickInterval) {
      const x = msToX(t);
      if (x < LABEL_W || x > W) continue;
      ctx.beginPath();
      ctx.moveTo(x, RULER_H);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Rows
    entries.forEach((entry, rowIdx) => {
      const y = RULER_H + rowIdx * ROW_H;
      if (y + ROW_H < RULER_H || y > H) return;

      const startMs = entry.startTime * 1000;
      const endMs = startMs + entry.duration;
      if (endMs < clampedPan || startMs > clampedPan + visibleMs) return;

      const isCritical = criticalPath.has(entry.index);

      // Row BG
      if (rowIdx % 2 === 0) {
        ctx.fillStyle = '#0c1018';
        ctx.fillRect(0, y, W, ROW_H);
      }
      if (isCritical) {
        ctx.fillStyle = 'rgba(239,68,68,0.06)';
        ctx.fillRect(0, y, W, ROW_H);
      }

      // Label
      const methodColor = getMethodColor(entry.method);
      ctx.fillStyle = methodColor;
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(entry.method.padEnd(7), 4, y + ROW_H - 7);

      const statusColor = getStatusColor(entry.status);
      ctx.fillStyle = statusColor;
      ctx.fillText(String(entry.status || '—'), 48, y + ROW_H - 7);

      ctx.fillStyle = '#475569';
      ctx.font = '10px Inter, sans-serif';
      const maxLabelW = LABEL_W - 80;
      const path = entry.path || entry.url.slice(entry.url.indexOf('/', 8)) || '/';
      const truncated = path.length > 30 ? path.slice(0, 28) + '…' : path;
      ctx.fillText(truncated, 82, y + ROW_H - 7);

      // Bar: render phase segments
      const totalPhaseTime = PHASES.reduce((s, p) => s + Math.max(0, (entry as any)[p.key] || 0), 0) || entry.duration;
      let segX = msToX(startMs);
      const barH = ROW_H - 6;
      const barY = y + 3;
      const endX = msToX(endMs);
      const totalBarW = Math.max(endX - segX, 2);

      PHASES.forEach(phase => {
        const phaseMs = Math.max(0, (entry as any)[phase.key] || 0);
        if (phaseMs <= 0) return;
        const segW = (phaseMs / totalPhaseTime) * totalBarW;
        if (segW < 0.5) return;

        const clippedX = Math.max(segX, LABEL_W);
        const clippedW = Math.min(segX + segW, W) - clippedX;
        if (clippedW <= 0) { segX += segW; return; }

        ctx.fillStyle = phase.color;
        ctx.globalAlpha = isCritical ? 1 : 0.85;
        const r = Math.min(2, clippedW / 4, barH / 4);
        if (clippedW >= 4) {
          ctx.beginPath();
          ctx.roundRect(clippedX, barY, clippedW, barH, r);
          ctx.fill();
        } else {
          ctx.fillRect(clippedX, barY, clippedW, barH);
        }
        ctx.globalAlpha = 1;
        segX += segW;
      });

      // Duration label on bar if wide enough
      const barWidth2 = Math.min(msToX(endMs), W) - Math.max(msToX(startMs), LABEL_W);
      if (barWidth2 > 40) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(formatMs(entry.duration), Math.max(msToX(startMs), LABEL_W) + 3, barY + barH - 4);
      }

      // Critical path indicator
      if (isCritical) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, y, 2, ROW_H);
      }

      // Separator
      ctx.strokeStyle = '#0f1929';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + ROW_H - 0.5);
      ctx.lineTo(W, y + ROW_H - 0.5);
      ctx.stroke();
    });

    // Label column separator
    ctx.strokeStyle = '#1e3050';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LABEL_W, RULER_H);
    ctx.lineTo(LABEL_W, H);
    ctx.stroke();
  }, [entries, clampedPan, visibleMs, tickInterval, criticalPath]);

  // Draw minimap
  const drawMini = useCallback(() => {
    const canvas = miniRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(0, 0, W, H);

    entries.forEach((entry, i) => {
      const startMs = entry.startTime * 1000;
      const x = (startMs / totalMs) * W;
      const barW2 = Math.max(1, (entry.duration / totalMs) * W);
      const y2 = (i / entries.length) * H;
      const h2 = Math.max(1, H / entries.length);

      const phase = PHASES.find(p => ((entry as any)[p.key] || 0) > 0) || PHASES[6];
      ctx.fillStyle = phase.color;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x, y2, barW2, h2);
      ctx.globalAlpha = 1;
    });

    // Viewport indicator
    const vpX = (clampedPan / totalMs) * W;
    const vpW = Math.max(4, (visibleMs / totalMs) * W);
    ctx.fillStyle = 'rgba(6,182,212,0.15)';
    ctx.fillRect(vpX, 0, vpW, H);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpX, 0, vpW, H);
  }, [entries, clampedPan, visibleMs, totalMs]);

  // Setup canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = Math.max(entries.length * ROW_H + RULER_H, 200);
      if (miniRef.current) {
        miniRef.current.width = container.clientWidth;
        miniRef.current.height = MINI_H;
      }
      draw();
      drawMini();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [entries.length]);

  useEffect(() => { draw(); drawMini(); }, [draw, drawMini]);

  // Mouse events on main canvas
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging.current) {
      const dx = e.clientX - dragStartX.current;
      const barW = canvas.width - LABEL_W;
      const msPx = visibleMs / barW;
      const newPan = dragStartPan.current - dx * msPx;
      setPanOffset(Math.max(0, Math.min(newPan, totalMs - visibleMs)));
      return;
    }

    const rowIdx = Math.floor((y - RULER_H) / ROW_H);
    if (rowIdx >= 0 && rowIdx < entries.length && x > LABEL_W) {
      setHoveredEntry({ entry: entries[rowIdx], x: e.clientX, y: e.clientY });
    } else {
      setHoveredEntry(null);
    }
  }, [entries, visibleMs, totalMs]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartPan.current = panOffset;
  }, [panOffset]);

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (Math.abs(e.clientX - dragStartX.current) > 5) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rowIdx = Math.floor((y - RULER_H) / ROW_H);
    if (rowIdx >= 0 && rowIdx < entries.length) {
      setSelectedEntry(entries[rowIdx]);
      setDetailPanelOpen(true);
    }
  }, [entries, setSelectedEntry, setDetailPanelOpen]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - LABEL_W;
      const mouseMs = clampedPan + (mouseX / (canvas.width - LABEL_W)) * visibleMs;
      const factor = e.deltaY > 0 ? 0.75 : 1.33;
      const newZoom = Math.max(1, Math.min(zoom * factor, 100));
      const newVisibleMs = totalMs / newZoom;
      const newPan = Math.max(0, mouseMs - (mouseX / (canvas.width - LABEL_W)) * newVisibleMs);
      setZoom(newZoom);
      setPanOffset(Math.min(newPan, totalMs - newVisibleMs));
    } else {
      const delta = e.deltaY;
      const msPx = visibleMs / ((canvasRef.current?.width || 800) - LABEL_W);
      setPanOffset(p => Math.max(0, Math.min(p + delta * msPx * 3, totalMs - visibleMs)));
    }
  }, [zoom, clampedPan, visibleMs, totalMs]);

  // Minimap click to pan
  const handleMiniClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = miniRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickMs = (x / canvas.width) * totalMs;
    setPanOffset(Math.max(0, Math.min(clickMs - visibleMs / 2, totalMs - visibleMs)));
  }, [totalMs, visibleMs]);

  const resourceTypes = [...new Set(allEntries.map(e => e.resourceType))].sort();

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <Activity size={14} style={{ color: 'var(--color-accent)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Flame Graph
        </span>

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg outline-none ml-2"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value="">All types</option>
          {resourceTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
          className="text-xs px-2 py-1.5 rounded-lg outline-none"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value="start">Sort: Start Time</option>
          <option value="duration">Sort: Duration ↓</option>
          <option value="size">Sort: Size ↓</option>
          <option value="ttfb">Sort: TTFB ↓</option>
        </select>

        <button onClick={() => setShowCriticalPath(!showCriticalPath)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
          style={{
            background: showCriticalPath ? 'rgba(239,68,68,0.1)' : 'var(--color-surface-2)',
            border: `1px solid ${showCriticalPath ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`,
            color: showCriticalPath ? '#ef4444' : 'var(--color-text-secondary)',
          }}>
          <Target size={12} /> Critical Path
        </button>

        <button onClick={() => setShowStats(!showStats)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
          style={{
            background: showStats ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
            border: `1px solid ${showStats ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: showStats ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          }}>
          <BarChart3 size={12} /> Stats
        </button>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setZoom(z => Math.max(1, z / 1.5))} className="p-1.5 rounded"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <ZoomOut size={13} />
          </button>
          <span className="text-xs px-2 font-mono" style={{ color: 'var(--color-text-muted)', minWidth: 48, textAlign: 'center' }}>
            {zoom.toFixed(1)}×
          </span>
          <button onClick={() => setZoom(z => Math.min(z * 1.5, 100))} className="p-1.5 rounded"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <ZoomIn size={13} />
          </button>
          <button onClick={() => { setZoom(1); setPanOffset(0); }} className="p-1.5 rounded ml-1"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
            <RotateCcw size={13} />
          </button>
        </div>

        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {entries.length} req · {formatDuration(totalMs)} · Ctrl+scroll=zoom
        </span>
      </div>

      {/* Stats panel */}
      {showStats && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          className="flex-shrink-0 grid grid-cols-8 gap-px overflow-hidden"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-border)' }}>
          {[
            { label: 'Mean', value: formatMs(stats.mean), color: 'var(--color-accent)' },
            { label: 'P50', value: formatMs(stats.p50), color: '#10b981' },
            { label: 'P95', value: formatMs(stats.p95), color: '#f59e0b' },
            { label: 'Max', value: formatMs(stats.max), color: '#ef4444' },
            { label: 'Min', value: formatMs(stats.min === Infinity ? 0 : stats.min), color: '#10b981' },
            { label: 'StdDev', value: formatMs(stats.stddev), color: 'var(--color-text-secondary)' },
            { label: 'TTFB Mean', value: formatMs(stats.ttfbMean), color: TIMING_COLORS.wait },
            { label: 'TTFB P95', value: formatMs(stats.ttfbP95), color: '#f97316' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center py-2.5"
              style={{ background: 'var(--color-surface-0)' }}>
              <span className="text-xs font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</span>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Phase legend */}
      <div className="flex items-center gap-3 px-4 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        {PHASES.map(p => (
          <div key={p.key} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: p.color }} />
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{p.label}</span>
          </div>
        ))}
      </div>

      {/* Minimap */}
      <div className="flex-shrink-0 relative" style={{ height: MINI_H, borderBottom: '1px solid var(--color-border)' }}>
        <canvas ref={miniRef} className="w-full cursor-crosshair" style={{ height: MINI_H, display: 'block' }}
          onClick={handleMiniClick} />
        <div className="absolute top-0 left-0 h-full flex items-center px-1"
          style={{ width: LABEL_W, background: 'var(--color-surface-1)', borderRight: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>Minimap — click to pan</span>
        </div>
      </div>

      {/* Main canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="cursor-grab active:cursor-grabbing"
          style={{ display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); setHoveredEntry(null); }}
          onClick={handleClick}
          onWheel={handleWheel}
        />

        {/* Hover tooltip */}
        {hoveredEntry && (
          <div className="fixed z-50 pointer-events-none rounded-xl px-3 py-2.5 shadow-2xl"
            style={{
              left: Math.min(hoveredEntry.x + 12, window.innerWidth - 280),
              top: Math.min(hoveredEntry.y - 10, window.innerHeight - 200),
              background: 'var(--color-surface-3)',
              border: '1px solid var(--color-border)',
              minWidth: 240,
            }}>
            <div className="text-xs font-medium mb-1.5 truncate max-w-xs"
              style={{ color: 'var(--color-text-primary)' }}>
              {truncateUrl(hoveredEntry.entry.url, 55)}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold" style={{ color: getMethodColor(hoveredEntry.entry.method), fontFamily: 'var(--font-mono)' }}>
                {hoveredEntry.entry.method}
              </span>
              <span className="text-xs font-bold" style={{ color: getStatusColor(hoveredEntry.entry.status), fontFamily: 'var(--font-mono)' }}>
                {hoveredEntry.entry.status}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hoveredEntry.entry.resourceType}</span>
            </div>

            {/* Phase breakdown mini-bar */}
            <div className="h-3 flex rounded overflow-hidden mb-2" style={{ background: 'var(--color-surface-1)' }}>
              {PHASES.map(p => {
                const v = Math.max(0, (hoveredEntry.entry as any)[p.key] || 0);
                const pct = hoveredEntry.entry.duration > 0 ? (v / hoveredEntry.entry.duration) * 100 : 0;
                return pct > 0 ? <div key={p.key} style={{ width: `${pct}%`, background: p.color, minWidth: 1 }} /> : null;
              })}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {[
                { label: 'Duration', value: formatMs(hoveredEntry.entry.duration) },
                { label: 'TTFB', value: formatMs(hoveredEntry.entry.ttfb) },
                { label: 'Start', value: formatMs(hoveredEntry.entry.startTime * 1000) },
                { label: 'Size', value: formatBytes(hoveredEntry.entry.transferredSize) },
                { label: 'DNS', value: formatMs(hoveredEntry.entry.dnsTime) },
                { label: 'TCP', value: formatMs(hoveredEntry.entry.tcpTime) },
                { label: 'TLS', value: formatMs(hoveredEntry.entry.sslTime) },
                { label: 'Wait', value: formatMs(hoveredEntry.entry.waitTime) },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-1.5 items-baseline">
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)', minWidth: 44 }}>{label}:</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 6 }}>Click to open detail panel</p>
          </div>
        )}
      </div>
    </div>
  );
}
