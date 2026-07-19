'use client';

import { useState } from 'react';
import { HarAnalysis } from '@har-viewer/shared';
import { EChartsWaterfall } from './EChartsWaterfall';
import { CustomWaterfall } from './CustomWaterfall';

interface WaterfallViewProps { analysis: HarAnalysis; }

export function WaterfallView({ analysis }: WaterfallViewProps) {
  const [renderer, setRenderer] = useState<'echarts' | 'custom'>('echarts');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Renderer:</span>
        {(['echarts', 'custom'] as const).map(r => (
          <button key={r} onClick={() => setRenderer(r)}
            className="text-xs px-3 py-1 rounded-md"
            style={{
              background: renderer === r ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
              border: `1px solid ${renderer === r ? 'var(--color-accent)' : 'var(--color-border)'}`,
              color: renderer === r ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}>
            {r === 'echarts' ? 'ECharts (Zoom + Legend)' : 'Custom (Pan + Phase Bars)'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {renderer === 'echarts'
          ? <EChartsWaterfall analysis={analysis} />
          : <CustomWaterfall analysis={analysis} />
        }
      </div>
    </div>
  );
}
