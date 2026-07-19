'use client';

import { HarCookie } from '@har-viewer/shared';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface CookiesTabProps {
  reqCookies: HarCookie[];
  resCookies: HarCookie[];
}

function CookieRow({ cookie }: { cookie: HarCookie }) {
  const issues = [];
  if (!cookie.secure) issues.push('No Secure');
  if (!cookie.httpOnly) issues.push('No HttpOnly');
  if (!cookie.sameSite) issues.push('No SameSite');

  return (
    <div className="rounded-lg p-3 space-y-2"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold break-all" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
          {cookie.name}
        </span>
        {issues.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <AlertTriangle size={12} style={{ color: 'var(--color-warning)' }} />
            <span className="text-xs" style={{ color: 'var(--color-warning)' }}>{issues.join(', ')}</span>
          </div>
        )}
      </div>
      <div className="text-xs break-all px-2 py-1.5 rounded"
        style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {cookie.value || '(empty)'}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {[
          { label: 'Domain', value: cookie.domain },
          { label: 'Path', value: cookie.path },
          { label: 'Expires', value: cookie.expires },
          { label: 'SameSite', value: cookie.sameSite },
        ].map(({ label, value }) => value && (
          <div key={label} className="flex gap-1.5">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}:</span>
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{value}</span>
          </div>
        ))}
        <div className="flex gap-3 col-span-2 mt-1">
          {[
            { label: 'Secure', val: cookie.secure },
            { label: 'HttpOnly', val: cookie.httpOnly },
          ].map(({ label, val }) => (
            <div key={label} className="flex items-center gap-1">
              {val
                ? <CheckCircle2 size={11} style={{ color: 'var(--color-success)' }} />
                : <XCircle size={11} style={{ color: 'var(--color-error)' }} />}
              <span className="text-xs" style={{ color: val ? 'var(--color-success)' : 'var(--color-error)' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CookiesTab({ reqCookies, resCookies }: CookiesTabProps) {
  return (
    <div className="p-3 space-y-4">
      {reqCookies.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-muted)' }}>
            Request Cookies ({reqCookies.length})
          </div>
          <div className="space-y-2">
            {reqCookies.map((c, i) => <CookieRow key={i} cookie={c} />)}
          </div>
        </div>
      )}
      {resCookies.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-muted)' }}>
            Response Cookies ({resCookies.length})
          </div>
          <div className="space-y-2">
            {resCookies.map((c, i) => <CookieRow key={i} cookie={c} />)}
          </div>
        </div>
      )}
      {reqCookies.length === 0 && resCookies.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
          No cookies in this request
        </p>
      )}
    </div>
  );
}
