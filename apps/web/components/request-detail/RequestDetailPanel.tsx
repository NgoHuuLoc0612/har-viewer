'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ProcessedEntry } from '@har-viewer/shared';
import { useHarStore, DetailTab } from '@/store/har-store';
import { formatBytes, formatDuration, getMethodColor, getStatusColor, copyToClipboard, parseUrl } from '@/lib/utils';
import { GeneralTab } from './tabs/GeneralTab';
import { HeadersTab } from './tabs/HeadersTab';
import { CookiesTab } from './tabs/CookiesTab';
import { ParamsTab } from './tabs/ParamsTab';
import { RequestBodyTab } from './tabs/RequestBodyTab';
import { ResponseBodyTab } from './tabs/ResponseBodyTab';
import { TimingTab } from './tabs/TimingTab';

interface RequestDetailPanelProps {
  entry: ProcessedEntry;
}

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'request-headers', label: 'Req Headers' },
  { id: 'response-headers', label: 'Res Headers' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'params', label: 'Params' },
  { id: 'request-body', label: 'Request Body' },
  { id: 'response-body', label: 'Response Body' },
  { id: 'timing', label: 'Timing' },
];

export function RequestDetailPanel({ entry }: RequestDetailPanelProps) {
  const { activeDetailTab, setActiveDetailTab, setDetailPanelOpen } = useHarStore();

  const reqHeaders = entry.rawEntry.request.headers || [];
  const resHeaders = entry.rawEntry.response.headers || [];
  const reqCookies = entry.rawEntry.request.cookies || [];
  const resCookies = entry.rawEntry.response.cookies || [];

  const tabBadges: Partial<Record<DetailTab, number>> = {
    'request-headers': reqHeaders.length,
    'response-headers': resHeaders.length,
    'cookies': reqCookies.length + resCookies.length,
    'params': (entry.rawEntry.request.queryString?.length || 0) + (entry.rawEntry.request.postData?.params?.length || 0),
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface-0)', borderLeft: '1px solid var(--color-border)' }}>
      {/* Panel Header */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-1)' }}>
        <span className="text-xs font-bold" style={{ color: getMethodColor(entry.method) }}>
          {entry.method}
        </span>
        <span className="text-xs font-bold" style={{ color: getStatusColor(entry.status) }}>
          {entry.status}
        </span>
        <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}
          title={entry.url}>
          {entry.domain}{entry.path}
        </span>
        <button onClick={() => { copyToClipboard(entry.url); toast.success('URL copied'); }}
          className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
          <Copy size={13} />
        </button>
        <a href={entry.url} target="_blank" rel="noopener noreferrer"
          className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}
          onClick={e => e.stopPropagation()}>
          <ExternalLink size={13} />
        </a>
        <button onClick={() => setDetailPanelOpen(false)}
          className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
          <X size={14} />
        </button>
      </div>

      {/* Quick info bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        {[
          { label: 'Duration', value: formatDuration(entry.duration) },
          { label: 'TTFB', value: formatDuration(entry.ttfb) },
          { label: 'Size', value: formatBytes(entry.transferredSize) },
          { label: 'Protocol', value: entry.httpVersion || '—' },
          { label: 'Cache', value: entry.cacheStatus || 'none' },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col">
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{label}</span>
            <span className="text-xs font-semibold"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-px overflow-x-auto flex-shrink-0 px-2 pt-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        {DETAIL_TABS.map(({ id, label }) => {
          const badge = tabBadges[id];
          return (
            <button key={id} onClick={() => setActiveDetailTab(id)}
              className="relative flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-t-md whitespace-nowrap transition-colors flex-shrink-0"
              style={{
                background: activeDetailTab === id ? 'var(--color-surface-2)' : 'transparent',
                color: activeDetailTab === id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                borderBottom: activeDetailTab === id ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}>
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="text-xs px-1 rounded-full"
                  style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', fontSize: 10 }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeDetailTab === 'general' && <GeneralTab entry={entry} />}
        {activeDetailTab === 'request-headers' && (
          <HeadersTab headers={reqHeaders} title="Request Headers" />
        )}
        {activeDetailTab === 'response-headers' && (
          <HeadersTab headers={resHeaders} title="Response Headers" />
        )}
        {activeDetailTab === 'cookies' && (
          <CookiesTab reqCookies={reqCookies} resCookies={resCookies} />
        )}
        {activeDetailTab === 'params' && <ParamsTab entry={entry} />}
        {activeDetailTab === 'request-body' && <RequestBodyTab entry={entry} />}
        {activeDetailTab === 'response-body' && <ResponseBodyTab entry={entry} />}
        {activeDetailTab === 'timing' && <TimingTab entry={entry} />}
      </div>
    </div>
  );
}
