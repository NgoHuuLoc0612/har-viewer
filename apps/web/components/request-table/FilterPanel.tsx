'use client';

import { FilterState } from '@/store/har-store';

interface FilterPanelProps {
  filters: FilterState;
  setFilters: (f: Partial<FilterState>) => void;
  resetFilters: () => void;
  domains: string[];
  mimeTypes: string[];
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT'];
const STATUSES = ['2xx', '3xx', '4xx', '5xx', '200', '201', '204', '301', '302', '304', '400', '401', '403', '404', '500', '502', '503'];
const RESOURCE_TYPES = ['document', 'stylesheet', 'script', 'image', 'font', 'media', 'xhr', 'fetch', 'websocket', 'manifest', 'other'];
const PROTOCOLS = ['HTTP/1.0', 'HTTP/1.1', 'HTTP/2', 'h2', 'HTTP/3'];
const CACHE_STATUSES = ['memory', 'disk', 'service-worker', '304', 'none'];

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-xs px-2 py-1.5 rounded-md outline-none"
        style={{
          background: 'var(--color-surface-3)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
        }}>
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function NumberInput({ label, value, placeholder, onChange }: {
  label: string; value: number | undefined; placeholder: string;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
      <input
        type="number"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="text-xs px-2 py-1.5 rounded-md outline-none w-24"
        style={{
          background: 'var(--color-surface-3)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  );
}

export function FilterPanel({ filters, setFilters, resetFilters, domains, mimeTypes }: FilterPanelProps) {
  return (
    <div className="px-4 py-3 flex flex-wrap gap-4"
      style={{ background: 'var(--color-surface-1)', borderBottom: '1px solid var(--color-border)' }}>
      <FilterSelect label="Method" value={filters.method} options={METHODS}
        onChange={v => setFilters({ method: v })} />
      <FilterSelect label="Status" value={filters.status} options={STATUSES}
        onChange={v => setFilters({ status: v })} />
      <FilterSelect label="Domain" value={filters.domain} options={domains.slice(0, 30)}
        onChange={v => setFilters({ domain: v })} />
      <FilterSelect label="Resource Type" value={filters.resourceType} options={RESOURCE_TYPES}
        onChange={v => setFilters({ resourceType: v })} />
      <FilterSelect label="MIME Type" value={filters.mimeType} options={mimeTypes.slice(0, 20)}
        onChange={v => setFilters({ mimeType: v })} />
      <FilterSelect label="Protocol" value={filters.protocol} options={PROTOCOLS}
        onChange={v => setFilters({ protocol: v })} />
      <FilterSelect label="Cache" value={filters.cacheStatus} options={CACHE_STATUSES}
        onChange={v => setFilters({ cacheStatus: v })} />
      <NumberInput label="Min Duration (ms)" value={filters.minDuration} placeholder="e.g. 500"
        onChange={v => setFilters({ minDuration: v })} />
      <NumberInput label="Max Duration (ms)" value={filters.maxDuration} placeholder="e.g. 5000"
        onChange={v => setFilters({ maxDuration: v })} />
      <NumberInput label="Min Size (bytes)" value={filters.minSize} placeholder="e.g. 1024"
        onChange={v => setFilters({ minSize: v })} />
      <NumberInput label="Max Size (bytes)" value={filters.maxSize} placeholder="e.g. 1048576"
        onChange={v => setFilters({ maxSize: v })} />
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>HTTPS Only</label>
        <div className="flex gap-2 mt-0.5">
          {[{ label: 'All', value: undefined }, { label: 'HTTPS', value: true }, { label: 'HTTP', value: false }].map(opt => (
            <button key={String(opt.label)}
              onClick={() => setFilters({ https: opt.value })}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: filters.https === opt.value ? 'var(--color-accent-bg)' : 'var(--color-surface-3)',
                border: `1px solid ${filters.https === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: filters.https === opt.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={resetFilters}
        className="self-end text-xs px-3 py-1.5 rounded-md transition-colors"
        style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-error)' }}>
        Reset All
      </button>
    </div>
  );
}
