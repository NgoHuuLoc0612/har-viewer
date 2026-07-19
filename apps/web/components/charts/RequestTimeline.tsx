'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { HarAnalysis, ProcessedEntry } from '@har-viewer/shared';
import { formatDuration, formatBytes, RESOURCE_TYPE_COLORS, getStatusColor } from '@/lib/utils';

interface RequestTimelineProps { analysis: HarAnalysis; height?: number; }

export function RequestTimeline({ analysis, height = 280 }: RequestTimelineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  const entries = analysis.entries as ProcessedEntry[];

  const option = useMemo<echarts.EChartsOption>(() => {
    // Group requests into 50 time buckets for the timeline
    if (!entries.length) return {};
    const minStart = Math.min(...entries.map(e => e.startTime));
    const maxEnd = Math.max(...entries.map(e => e.endTime));
    const span = maxEnd - minStart || 1;
    const BUCKETS = 60;
    const bucketSize = span / BUCKETS;

    const concurrency = Array(BUCKETS).fill(0);
    const transferArr = Array(BUCKETS).fill(0);

    entries.forEach(e => {
      const startBucket = Math.max(0, Math.floor((e.startTime - minStart) / bucketSize));
      const endBucket = Math.min(BUCKETS - 1, Math.floor((e.endTime - minStart) / bucketSize));
      for (let b = startBucket; b <= endBucket; b++) concurrency[b]++;
      transferArr[startBucket] += e.transferredSize;
    });

    const xData = Array.from({ length: BUCKETS }, (_, i) =>
      formatDuration((minStart + i * bucketSize) * 1000)
    );

    return {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#1e3050',
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: (params: any) => {
          const [c, t] = params;
          return `<div style="font-size:11px">
            <b>${c.axisValue}</b><br/>
            Concurrent: <b style="color:#06b6d4">${c.value}</b><br/>
            Transfer: <b style="color:#10b981">${formatBytes(t.value)}</b>
          </div>`;
        },
      },
      legend: {
        data: ['Concurrent Requests', 'Transfer Rate'],
        top: 2, right: 8,
        textStyle: { color: '#64748b', fontSize: 10 },
        itemWidth: 10, itemHeight: 6,
      },
      grid: { left: 48, right: 48, top: 28, bottom: 28 },
      xAxis: {
        type: 'category',
        data: xData,
        axisLabel: { color: '#475569', fontSize: 9, rotate: 0, interval: Math.floor(BUCKETS / 8) },
        axisLine: { lineStyle: { color: '#1e3050' } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Requests',
          nameTextStyle: { color: '#475569', fontSize: 9 },
          axisLabel: { color: '#475569', fontSize: 9 },
          splitLine: { lineStyle: { color: '#1e3050', type: 'dashed' } },
          axisLine: { show: false },
        },
        {
          type: 'value',
          name: 'Bytes',
          nameTextStyle: { color: '#475569', fontSize: 9 },
          axisLabel: { color: '#475569', fontSize: 9, formatter: (v: number) => formatBytes(v) },
          splitLine: { show: false },
          axisLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Concurrent Requests',
          type: 'line',
          data: concurrency,
          smooth: 0.4,
          lineStyle: { color: '#06b6d4', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(6,182,212,0.25)' },
              { offset: 1, color: 'rgba(6,182,212,0.01)' },
            ]),
          },
          itemStyle: { color: '#06b6d4' },
          symbol: 'none',
          yAxisIndex: 0,
        },
        {
          name: 'Transfer Rate',
          type: 'bar',
          data: transferArr,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16,185,129,0.8)' },
              { offset: 1, color: 'rgba(16,185,129,0.1)' },
            ]),
          },
          barMaxWidth: 8,
          yAxisIndex: 1,
        },
      ],
    };
  }, [entries]);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current, 'dark', { renderer: 'canvas' });
    chart.current.setOption(option);
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => { chart.current?.dispose(); ro.disconnect(); };
  }, []);

  useEffect(() => { chart.current?.setOption(option, { notMerge: true }); }, [option]);

  return <div ref={ref} style={{ width: '100%', height }} />;
}
