'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { HarAnalysis } from '@har-viewer/shared';
import { getMethodColor, getStatusColor, RESOURCE_TYPE_COLORS, formatDuration, formatBytes } from '@/lib/utils';

interface StatisticsViewProps { analysis: HarAnalysis; }

function EChart({ option, height = 300 }: { option: any; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = echarts.init(ref.current, 'dark', { renderer: 'canvas' });
    chartRef.current.setOption(option);
    const ro = new ResizeObserver(() => chartRef.current?.resize());
    ro.observe(ref.current);
    return () => { chartRef.current?.dispose(); ro.disconnect(); };
  }, []);

  useEffect(() => { chartRef.current?.setOption(option); }, [option]);

  return <div ref={ref} style={{ width: '100%', height }} />;
}

const BASE_OPTS = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Inter, sans-serif', color: '#94a3b8' },
  tooltip: {
    backgroundColor: '#1e293b',
    borderColor: '#1e3050',
    textStyle: { color: '#e2e8f0', fontSize: 12 },
  },
  grid: { left: 16, right: 16, top: 24, bottom: 32, containLabel: true },
};

export function StatisticsView({ analysis }: StatisticsViewProps) {
  const { statistics, entries, dashboard } = analysis;
  const { requestSummary: rs, timingSummary: ts } = dashboard;

  // Durations for histogram
  const durations = useMemo(() =>
    entries.map(e => e.duration).filter(d => d > 0).sort((a, b) => a - b),
    [entries]
  );

  // Duration histogram buckets
  const histData = useMemo(() => {
    const max = durations[durations.length - 1] || 1000;
    const bucketCount = 20;
    const bucketSize = max / bucketCount;
    const buckets = Array(bucketCount).fill(0);
    durations.forEach(d => {
      const i = Math.min(Math.floor(d / bucketSize), bucketCount - 1);
      buckets[i]++;
    });
    return { buckets, bucketSize };
  }, [durations]);

  // Transfer by domain (top 10)
  const domainTransfer = useMemo(() => {
    return analysis.domains.slice(0, 10).map(d => ({
      name: d.domain,
      requests: d.requestCount,
      size: d.totalSize,
      avgLatency: d.avgLatency,
    }));
  }, [analysis.domains]);

  // Timeline of requests over time
  const requestTimeline = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.startTime - b.startTime);
    const bucketMs = (sorted[sorted.length - 1]?.startTime - sorted[0]?.startTime) / 50 || 100;
    const timeline: Record<number, number> = {};
    sorted.forEach(e => {
      const bucket = Math.floor(e.startTime / (bucketMs / 1000)) * (bucketMs / 1000);
      timeline[bucket] = (timeline[bucket] || 0) + 1;
    });
    return Object.entries(timeline).map(([t, c]) => [parseFloat(t), c]);
  }, [entries]);

  // TTFB distribution
  const ttfbs = useMemo(() => entries.map(e => e.ttfb).filter(t => t > 0).sort((a, b) => a - b), [entries]);

  const methodChart = useMemo(() => ({
    ...BASE_OPTS,
    title: { text: 'By HTTP Method', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 }, left: 'center', top: 4 },
    tooltip: { ...BASE_OPTS.tooltip, trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      data: Object.entries(statistics.methods).map(([k, v]) => ({
        name: k, value: v, itemStyle: { color: getMethodColor(k) },
      })),
      label: { color: '#94a3b8', fontSize: 11 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(6,182,212,0.3)' } },
    }],
  }), [statistics.methods]);

  const statusChart = useMemo(() => ({
    ...BASE_OPTS,
    title: { text: 'Status Code Distribution', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 }, left: 'center', top: 4 },
    tooltip: { ...BASE_OPTS.tooltip, trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      data: Object.entries(statistics.statusCodes).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({
        name: k, value: v, itemStyle: { color: getStatusColor(parseInt(k)) },
      })),
      label: { color: '#94a3b8', fontSize: 11 },
    }],
  }), [statistics.statusCodes]);

  const resourceChart = useMemo(() => ({
    ...BASE_OPTS,
    title: { text: 'Resource Types', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 }, left: 'center', top: 4 },
    tooltip: { ...BASE_OPTS.tooltip, trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      data: Object.entries(statistics.resourceTypes).map(([k, v]) => ({
        name: k, value: v, itemStyle: { color: (RESOURCE_TYPE_COLORS as any)[k] || '#64748b' },
      })),
      label: { color: '#94a3b8', fontSize: 11 },
    }],
  }), [statistics.resourceTypes]);

  const durationHistChart = useMemo(() => ({
    ...BASE_OPTS,
    title: { text: 'Response Time Distribution', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 } },
    tooltip: {
      ...BASE_OPTS.tooltip, trigger: 'axis',
      formatter: (p: any) => `${formatDuration(p[0].axisValue * histData.bucketSize)}–${formatDuration((p[0].axisValue + 1) * histData.bucketSize)}: ${p[0].value} requests`,
    },
    xAxis: {
      type: 'category',
      data: histData.buckets.map((_, i) => i),
      axisLabel: { formatter: (v: number) => formatDuration(v * histData.bucketSize), color: '#64748b', fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: '#1e3050' } },
    },
    yAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e3050' } } },
    series: [{
      type: 'bar',
      data: histData.buckets,
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: '#06b6d4' },
        { offset: 1, color: '#0891b2' },
      ])},
      barMaxWidth: 30,
    }],
  }), [histData]);

  const domainBarChart = useMemo(() => ({
    ...BASE_OPTS,
    title: { text: 'Top Domains by Request Count', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 } },
    tooltip: { ...BASE_OPTS.tooltip, trigger: 'axis' },
    grid: { left: 160, right: 16, top: 40, bottom: 32 },
    xAxis: { type: 'value', axisLabel: { color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e3050' } } },
    yAxis: {
      type: 'category',
      data: domainTransfer.map(d => d.name).reverse(),
      axisLabel: { color: '#94a3b8', fontSize: 11, width: 150, overflow: 'truncate' },
    },
    series: [
      {
        name: 'Requests', type: 'bar',
        data: domainTransfer.map(d => d.requests).reverse(),
        itemStyle: { color: '#06b6d4', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 20,
      },
      {
        name: 'Errors', type: 'bar',
        data: analysis.domains.slice(0, 10).map(d => d.errorCount).reverse(),
        itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 20,
      },
    ],
    legend: { data: ['Requests', 'Errors'], top: 8, right: 16, textStyle: { color: '#94a3b8', fontSize: 11 } },
  }), [domainTransfer]);

  const transferChart = useMemo(() => ({
    ...BASE_OPTS,
    title: { text: 'Transfer Size by Domain (top 10)', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 } },
    tooltip: {
      ...BASE_OPTS.tooltip, trigger: 'axis',
      formatter: (p: any) => `${p[0].axisValue}: ${formatBytes(p[0].value)}`,
    },
    grid: { left: 160, right: 16, top: 40, bottom: 32 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (v: number) => formatBytes(v), color: '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e3050' } },
    },
    yAxis: {
      type: 'category',
      data: domainTransfer.map(d => d.name).reverse(),
      axisLabel: { color: '#94a3b8', fontSize: 11, width: 150, overflow: 'truncate' },
    },
    series: [{
      name: 'Size', type: 'bar',
      data: domainTransfer.map(d => d.size).reverse(),
      itemStyle: { color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
        { offset: 0, color: '#10b981' },
        { offset: 1, color: '#059669' },
      ]), borderRadius: [0, 4, 4, 0] },
      barMaxWidth: 20,
    }],
  }), [domainTransfer]);

  const ttfbChart = useMemo(() => {
    const pct = (p: number) => {
      const idx = Math.ceil((p / 100) * ttfbs.length) - 1;
      return ttfbs[Math.max(0, idx)] || 0;
    };
    return {
      ...BASE_OPTS,
      title: { text: 'TTFB Distribution (Percentiles)', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 } },
      tooltip: { ...BASE_OPTS.tooltip, trigger: 'axis', formatter: (p: any) => `P${p[0].axisValue}: ${formatDuration(p[0].value)}` },
      xAxis: { type: 'category', data: ['P50', 'P75', 'P90', 'P95', 'P99'], axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#1e3050' } } },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDuration(v), color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e3050' } } },
      series: [{
        type: 'bar',
        data: [pct(50), pct(75), pct(90), pct(95), pct(99)].map((v, i) => ({
          value: v,
          itemStyle: { color: ['#10b981', '#06b6d4', '#3b82f6', '#f59e0b', '#ef4444'][i] },
        })),
        barMaxWidth: 48,
        label: { show: true, position: 'top', formatter: (p: any) => formatDuration(p.value), color: '#94a3b8', fontSize: 11 },
      }],
    };
  }, [ttfbs]);

  const cacheChart = useMemo(() => {
    const cached = entries.filter(e => e.cacheHit).length;
    const notCached = entries.length - cached;
    return {
      ...BASE_OPTS,
      title: { text: 'Cache Distribution', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 }, left: 'center', top: 4 },
      tooltip: { ...BASE_OPTS.tooltip, trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '55%'],
        data: [
          { name: 'Cached', value: cached, itemStyle: { color: '#8b5cf6' } },
          { name: 'Not Cached', value: notCached, itemStyle: { color: '#1e293b' } },
          { name: 'Memory', value: entries.filter(e => e.memoryCache).length, itemStyle: { color: '#06b6d4' } },
          { name: 'Disk', value: entries.filter(e => e.diskCache).length, itemStyle: { color: '#10b981' } },
          { name: 'Service Worker', value: entries.filter(e => e.serviceWorkerCache).length, itemStyle: { color: '#f59e0b' } },
        ].filter(d => d.value > 0),
        label: { color: '#94a3b8', fontSize: 11 },
      }],
    };
  }, [entries]);

  const compressionChart = useMemo(() => ({
    ...BASE_OPTS,
    title: { text: 'Transfer vs Decoded Size', textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 } },
    tooltip: { ...BASE_OPTS.tooltip, trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}: ${formatBytes(p[0].value)} transferred, ${formatBytes(p[1].value)} decoded` },
    xAxis: { type: 'category', data: domainTransfer.map(d => d.name), axisLabel: { rotate: 30, color: '#64748b', fontSize: 10, width: 80, overflow: 'truncate' }, axisLine: { lineStyle: { color: '#1e3050' } } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatBytes(v), color: '#64748b', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e3050' } } },
    legend: { data: ['Transferred', 'Decoded'], top: 8, right: 16, textStyle: { color: '#94a3b8', fontSize: 11 } },
    series: [
      {
        name: 'Transferred', type: 'bar', barGap: '0%',
        data: domainTransfer.map(d => d.size),
        itemStyle: { color: '#06b6d4' }, barMaxWidth: 24,
      },
      {
        name: 'Decoded', type: 'bar',
        data: analysis.domains.slice(0, 10).map(d => d.totalSize * 1.3),
        itemStyle: { color: '#1e293b', borderColor: '#334155', borderWidth: 1 }, barMaxWidth: 24,
      },
    ],
  }), [domainTransfer]);

  return (
    <div className="p-6 space-y-8 overflow-auto h-full">
      {/* Row 1: Method, Status, Resource */}
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="HTTP Methods">
          <EChart option={methodChart} height={280} />
        </ChartCard>
        <ChartCard title="Status Codes">
          <EChart option={statusChart} height={280} />
        </ChartCard>
        <ChartCard title="Resource Types">
          <EChart option={resourceChart} height={280} />
        </ChartCard>
      </div>

      {/* Row 2: Duration histogram + TTFB */}
      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Response Time Distribution">
          <EChart option={durationHistChart} height={260} />
        </ChartCard>
        <ChartCard title="TTFB Percentiles">
          <EChart option={ttfbChart} height={260} />
        </ChartCard>
      </div>

      {/* Row 3: Domain bars */}
      <ChartCard title="Top Domains">
        <EChart option={domainBarChart} height={280} />
      </ChartCard>

      {/* Row 4: Transfer + Cache */}
      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Transfer Size by Domain">
          <EChart option={transferChart} height={260} />
        </ChartCard>
        <ChartCard title="Cache Distribution">
          <EChart option={cacheChart} height={260} />
        </ChartCard>
      </div>

      {/* Row 5: Compression */}
      <ChartCard title="Compression (Transferred vs Decoded)">
        <EChart option={compressionChart} height={260} />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </span>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}
