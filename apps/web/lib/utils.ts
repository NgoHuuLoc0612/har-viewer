import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(utc);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Bytes ────────────────────────────────────────────────────────────────
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// ─── Duration (dayjs) ─────────────────────────────────────────────────────
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0 ms';
  if (ms < 1)    return `${(ms * 1000).toFixed(0)} μs`;
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  return dayjs.duration(ms, 'milliseconds').format('m[m] s[s]');
}

// ─── Timestamp (dayjs) ───────────────────────────────────────────────────
export function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  return dayjs(iso).format('MMM DD, YYYY HH:mm:ss');
}

export function formatTimestampShort(iso: string): string {
  return dayjs(iso).format('HH:mm:ss.SSS');
}

export function timeFromNow(iso: string): string {
  return dayjs(iso).fromNow();
}

// ─── Number helpers ───────────────────────────────────────────────────────
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Status colors ───────────────────────────────────────────────────────
export function getStatusColor(status: number): string {
  if (status === 0)    return '#6b7280';
  if (status < 200)    return '#94a3b8';
  if (status < 300)    return '#10b981';
  if (status < 400)    return '#f59e0b';
  if (status < 500)    return '#ef4444';
  return '#dc2626';
}

export function getStatusClass(status: number): string {
  if (status === 0)    return 'status-0';
  if (status < 200)    return 'status-1xx';
  if (status < 300)    return 'status-2xx';
  if (status < 400)    return 'status-3xx';
  if (status < 500)    return 'status-4xx';
  return 'status-5xx';
}

// ─── Method colors ────────────────────────────────────────────────────────
export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '#10b981', POST: '#3b82f6', PUT: '#f59e0b', PATCH: '#f59e0b',
    DELETE: '#ef4444', OPTIONS: '#8b5cf6', HEAD: '#64748b',
    CONNECT: '#06b6d4', TRACE: '#ec4899',
  };
  return colors[method?.toUpperCase()] || '#94a3b8';
}

// ─── MIME color ───────────────────────────────────────────────────────────
export function getMimeTypeColor(mimeType: string): string {
  if (!mimeType) return '#64748b';
  const t = mimeType.split(';')[0].trim().toLowerCase();
  // Text types
  if (t === 'text/html' || t === 'application/xhtml+xml') return '#06b6d4';
  if (t === 'text/css')                                   return '#a78bfa';
  if (t.includes('javascript') || t.includes('ecmascript')) return '#f59e0b';
  if (t.includes('json'))                                 return '#10b981';
  if (t.includes('xml') || t.includes('svg'))             return '#3b82f6';
  if (t === 'text/markdown' || t === 'text/plain')        return '#94a3b8';
  if (t === 'text/csv' || t === 'text/tab-separated-values') return '#34d399';
  if (t.includes('yaml') || t.includes('yml'))            return '#fbbf24';
  if (t.startsWith('text/'))                              return '#64748b';
  // Binary/app types
  if (t === 'application/wasm')                           return '#84cc16';
  if (t === 'application/pdf')                            return '#ef4444';
  if (t === 'application/zip' || t.includes('compressed') || t.includes('gzip') || t.includes('bzip') || t.includes('7z') || t === 'application/vnd.rar') return '#f97316';
  if (t.includes('msword') || t.includes('wordprocessingml')) return '#2563eb';
  if (t.includes('spreadsheet') || t.includes('ms-excel') || t === 'text/csv') return '#16a34a';
  if (t.includes('presentationml') || t.includes('ms-powerpoint')) return '#dc2626';
  if (t.includes('sqlite') || t.includes('sql'))          return '#0891b2';
  if (t === 'application/octet-stream')                   return '#6b7280';
  if (t.startsWith('application/vnd.'))                   return '#8b5cf6';
  if (t.startsWith('application/'))                       return '#3b82f6';
  // Media types
  if (t.startsWith('image/'))                             return '#ec4899';
  if (t.startsWith('video/'))                             return '#ef4444';
  if (t.startsWith('audio/'))                             return '#f97316';
  if (t.startsWith('font/') || t.includes('font'))        return '#8b5cf6';
  // Model/chemical/other
  if (t.startsWith('model/'))                             return '#6366f1';
  if (t.startsWith('chemical/'))                          return '#14b8a6';
  return '#64748b';
}

// ─── URL helpers ──────────────────────────────────────────────────────────
export function truncateUrl(url: string, maxLength = 80): string {
  if (url.length <= maxLength) return url;
  try {
    const u = new URL(url);
    const base = u.hostname + u.pathname;
    if (base.length <= maxLength) return base + (u.search ? '?…' : '');
    return base.substring(0, maxLength - 3) + '…';
  } catch {
    return url.substring(0, maxLength - 3) + '…';
  }
}

export function parseUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      protocol: u.protocol.replace(':', ''),
      host: u.host, hostname: u.hostname,
      port: u.port, pathname: u.pathname,
      search: u.search, hash: u.hash,
      searchParams: Object.fromEntries(u.searchParams.entries()),
    };
  } catch { return null; }
}

// ─── JSON helpers ─────────────────────────────────────────────────────────
export function isJsonString(str: string): boolean {
  if (!str || str.length < 2) return false;
  const t = str.trimStart();
  if (!t.startsWith('{') && !t.startsWith('[')) return false;
  try { JSON.parse(str); return true; } catch { return false; }
}

// ─── Misc ─────────────────────────────────────────────────────────────────
export function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timer: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Timing constants ─────────────────────────────────────────────────────
export const TIMING_COLORS: Record<string, string> = {
  queued:  '#374151', blocked: '#6b7280', proxy: '#9ca3af',
  dns:     '#8b5cf6', connect: '#3b82f6', ssl:   '#06b6d4',
  send:    '#10b981', wait:    '#f59e0b', receive: '#ef4444',
};

export const TIMING_LABELS: Record<string, string> = {
  queued:  'Queueing',   blocked: 'Stalled',       proxy:   'Proxy',
  dns:     'DNS Lookup', connect: 'TCP Connection', ssl:     'TLS Handshake',
  send:    'Request Sent', wait:  'Waiting (TTFB)', receive: 'Content Download',
};

export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  document:  '#06b6d4', stylesheet: '#a78bfa', script: '#f59e0b',
  image:     '#ec4899', font:       '#8b5cf6', media:  '#ef4444',
  xhr:       '#3b82f6', fetch:      '#10b981', websocket: '#f97316',
  manifest:  '#6b7280', wasm:       '#84cc16', other:  '#94a3b8',
};

export function getResourceTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    document: '📄', stylesheet: '🎨', script: '⚡', image: '🖼️',
    font: '🔤', media: '🎬', xhr: '🔄', fetch: '↗️',
    websocket: '🔌', manifest: '📋', wasm: '⚙️', other: '📦',
  };
  return icons[type] || '📦';
}
