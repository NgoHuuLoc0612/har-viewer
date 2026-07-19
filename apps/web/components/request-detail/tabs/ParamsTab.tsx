'use client';

import { ProcessedEntry } from '@har-viewer/shared';
import { formatBytes } from '@/lib/utils';

interface ParamsTabProps { entry: ProcessedEntry; }

export function ParamsTab({ entry }: ParamsTabProps) {
  const queryParams = entry.rawEntry.request.queryString || [];
  const postData = entry.rawEntry.request.postData;
  const formParams = postData?.params || [];

  return (
    <div className="p-3 space-y-4">
      {queryParams.length > 0 && (
        <Section title={`Query Parameters (${queryParams.length})`}>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Name', 'Value', 'Decoded Value'].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryParams.map((p, i) => {
                  let decoded = p.value;
                  try { decoded = decodeURIComponent(p.value); } catch {}
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <td className="px-2 py-1.5 font-medium"
                        style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{p.name}</td>
                      <td className="px-2 py-1.5 break-all"
                        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.value}</td>
                      <td className="px-2 py-1.5 break-all"
                        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {decoded !== p.value ? decoded : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {formParams.length > 0 && (
        <Section title={`Form Data (${formParams.length})`}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Name', 'Value', 'File Name', 'MIME Type'].map(h => (
                  <th key={h} className="text-left px-2 py-1.5 font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formParams.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <td className="px-2 py-1.5 font-medium"
                    style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{p.name}</td>
                  <td className="px-2 py-1.5 break-all max-w-xs"
                    style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {p.value?.slice(0, 200) || '—'}
                  </td>
                  <td className="px-2 py-1.5"
                    style={{ color: 'var(--color-text-muted)' }}>{p.fileName || '—'}</td>
                  <td className="px-2 py-1.5"
                    style={{ color: 'var(--color-text-muted)' }}>{p.contentType || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {queryParams.length === 0 && formParams.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
          No parameters in this request
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-muted)' }}>{title}</div>
      <div className="rounded-lg overflow-hidden"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
        {children}
      </div>
    </div>
  );
}
