'use client';

import { useMemo, useRef, useEffect, useState } from 'react';
import * as echarts from 'echarts';
import { HarAnalysis, ProcessedEntry } from '@har-viewer/shared';
import { useHarStore } from '@/store/har-store';
import {
  formatDuration, formatBytes, getMethodColor, getStatusColor,
  TIMING_COLORS, TIMING_LABELS, truncateUrl
} from '@/lib/utils';
import { ZoomIn, ZoomOut, RotateCcw, Search, Filter } from 'lucide-react';

interface EChartsWaterfallProps { analysis: HarAnalysis; }

const PHASES = [
  { key: 'blockedTime', color: TIMING_COLORS.blocked, label: 'Stalled' },
  { key: 'dnsTime',     color: TIMING_COLORS.dns,     label: 'DNS' },
  { key: 'tcpTime',     color: TIMING_COLORS.connect,  label: 'TCP' },
  { key: 'sslTime',     color: TIMING_COLORS.ssl,      label: 'SSL' },
  { key: 'sendTime',    color: TIMING_COLORS.send,     label: 'Send' },
  { key: 'waitTime',    color: TIMING_COLORS.wait,     label: 'Wait' },
  { key: 'receiveTime', color: TIMING_COLORS.receive,  label: 'Receive' },
];

export function EChartsWaterfall({ analysis }: EChartsWaterfallProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInst = useRef<echarts.ECharts | null>(null);
  const { setSelectedEntry, setDetailPanelOpen } = useHarStore();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [pageSize] = useState(120);
  const [page, setPage] = useState(0);

  const allEntries = analysis.entries as ProcessedEntry[];
  const resourceTypes = [...new Set(allEntries.map(e => e.resourceType))].sort();

  const filtered = useMemo(() => {
    let e = allEntries;
    if (search) e = e.filter(en => en.url.toLowerCase().includes(search.toLowerCase()));
    if (filterType) e = e.filter(en => en.resourceType === filterType);
    return e;
  }, [allEntries, search, filterType]);

  const pageEntries = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const totalDuration = useMemo(() => {
    if (!filtered.length) return 1;
    return Math.max(...filtered.map(e => (e.startTime * 1000) + e.duration));
  }, [filtered]);

  const option = useMemo(() => {
    const yData = pageEntries.map((e, i) =>
      `${(page * pageSize + i + 1).toString().padStart(3, ' ')}  ${e.method.padEnd(6)} ${e.status}  ${truncateUrl(e.url, 60)}`
    );

    // Each entry needs: startTime spacer + each phase segment
    const series: echarts.SeriesOption[] = [];

    // Transparent offset (start position)
    series.push({
      name: 'Start',
      type: 'bar',
      stack: 'waterfall',
      itemStyle: { color: 'transparent' },
      data: pageEntries.map(e => e.startTime * 1000),
      emphasis: { disabled: true },
    } as any);

    // One series per timing phase
    PHASES.forEach(({ key, color, label }) => {
      series.push({
        name: label,
        type: 'bar',
        stack: 'waterfall',
        itemStyle: { color, borderRadius: 0 },
        emphasis: { itemStyle: { opacity: 0.85 } },
        data: pageEntries.map(e => {
          const v = Math.max(0, (e as any)[key] as number);
          return v > 0 ? v : null;
        }),
        tooltip: {
          formatter: (p: any) => {
            const entry = pageEntries[p.dataIndex];
            if (!entry) return '';
            const phaseVal = Math.max(0, (entry as any)[key] as number);
            return `<div style="font-family:var(--font-mono);font-size:11px;max-width:320px">
              <div style="font-weight:700;margin-bottom:4px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${entry.url}</div>
              <div style="color:#94a3b8">${label}: <b style="color:${color}">${formatDuration(phaseVal)}</b></div>
              <div style="color:#94a3b8">Total: <b style="color:#06b6d4">${formatDuration(entry.duration)}</b></div>
              <div style="color:#94a3b8">TTFB: <b style="color:#f59e0b">${formatDuration(entry.ttfb)}</b></div>
              <div style="color:#94a3b8">Size: <b style="color:#10b981">${formatBytes(entry.transferredSize)}</b></div>
            </div>`;
          },
        },
      } as any);
    });

    return {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1e293b',
        borderColor: '#1e3050',
        borderWidth: 1,
        padding: 10,
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        confine: true,
      },
      legend: {
        data: PHASES.map(p => p.label),
        top: 4,
        right: 16,
        textStyle: { color: '#64748b', fontSize: 10 },
        itemWidth: 10,
        itemHeight: 8,
      },
      grid: { left: 320, right: 120, top: 36, bottom: 32, containLabel: false },
      xAxis: {
        type: 'value',
        min: 0,
        axisLabel: {
          formatter: (v: number) => formatDuration(v),
          color: '#475569',
          fontSize: 10,
        },
        splitLine: { lineStyle: { color: '#1e3050', type: 'dashed' } },
        axisLine: { lineStyle: { color: '#1e3050' } },
      },
      yAxis: {
        type: 'category',
        data: yData,
        inverse: false,
        axisLabel: {
          color: '#475569',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, Consolas, monospace',
          width: 300,
          overflow: 'truncate',
          formatter: (v: string) => v,
        },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#0f1929' } },
      },
      series,
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 4,
          height: 18,
          handleSize: '80%',
          textStyle: { color: '#475569', fontSize: 10 },
          borderColor: '#1e3050',
          fillerColor: 'rgba(6,182,212,0.08)',
          handleStyle: { color: '#06b6d4', borderColor: '#06b6d4' },
          moveHandleStyle: { color: '#06b6d4' },
        },
        { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: true },
      ],
    } as echarts.EChartsOption;
  }, [pageEntries, page]);

  useEffect(() => {
    if (!chartRef.current) return;
    const height = Math.max(400, pageEntries.length * 28 + 80);
    chartRef.current.style.height = `${height}px`;

    if (!chartInst.current) {
      chartInst.current = echarts.init(chartRef.current, 'dark', { renderer: 'canvas' });
      chartInst.current.on('click', (p: any) => {
        if (p.seriesName === 'Start') return;
        const entry = pageEntries[p.dataIndex];
        if (entry) { setSelectedEntry(entry); setDetailPanelOpen(true); }
      });
    }
    chartInst.current.setOption(option, { notMerge: true });

    const ro = new ResizeObserver(() => chartInst.current?.resize());
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, [option]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Filter requests..." className="text-xs pl-7 pr-2 py-1.5 rounded-lg outline-none w-52"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>

        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}
          className="text-xs px-2 py-1.5 rounded-lg outline-none"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
          <option value="">All types</option>
          {resourceTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
          style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          {PHASES.map(p => (
            <span key={p.key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: p.color }} />
              <span style={{ fontSize: 10 }}>{p.label}</span>
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} requests · {formatDuration(totalDuration)} total
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="text-xs px-2 py-1 rounded disabled:opacity-40"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                ←
              </button>
              <span className="text-xs px-2" style={{ color: 'var(--color-text-muted)' }}>
                {page + 1} / {totalPages}
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="text-xs px-2 py-1 rounded disabled:opacity-40"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                →
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <div ref={chartRef} style={{ width: '100%', minHeight: 400 }} />
      </div>
    </div>
  );
}
