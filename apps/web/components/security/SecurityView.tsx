'use client';

import { motion } from 'framer-motion';
import { Shield, ShieldAlert, ShieldCheck, Lock, Unlock, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { HarAnalysis } from '@har-viewer/shared';
import { formatBytes } from '@/lib/utils';

interface SecurityViewProps { analysis: HarAnalysis; }

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={8} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x={55} y={52} textAnchor="middle" fill="var(--color-text-primary)"
          fontSize={20} fontWeight={700} fontFamily="var(--font-mono)">{score}</text>
        <text x={55} y={67} textAnchor="middle" fill="var(--color-text-muted)" fontSize={10}>/100</text>
      </svg>
      <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
    </div>
  );
}

function IssueRow({ severity, label, value, detail }: {
  severity: 'error' | 'warning' | 'info' | 'success';
  label: string;
  value?: string;
  detail?: string;
}) {
  const colors = {
    error: 'var(--color-error)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
    success: 'var(--color-success)',
  };
  const icons = {
    error: <XCircle size={14} />,
    warning: <AlertTriangle size={14} />,
    info: <Info size={14} />,
    success: <CheckCircle2 size={14} />,
  };

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg"
      style={{ background: `${colors[severity]}10`, border: `1px solid ${colors[severity]}30` }}>
      <span style={{ color: colors[severity], flexShrink: 0, marginTop: 1 }}>{icons[severity]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
          {value && (
            <span className="text-xs font-bold flex-shrink-0"
              style={{ color: colors[severity], fontFamily: 'var(--font-mono)' }}>{value}</span>
          )}
        </div>
        {detail && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{detail}</p>
        )}
      </div>
    </div>
  );
}

export function SecurityView({ analysis }: SecurityViewProps) {
  const { security, entries } = analysis;
  const total = entries.length;

  // Compute security score
  const score = Math.max(0, Math.round(
    (security.httpsPercentage * 0.3) +
    (security.hstsEnabled ? 15 : 0) +
    (security.cspEnabled ? 15 : 0) +
    (security.insecureRequests === 0 ? 10 : Math.max(0, 10 - security.insecureRequests)) +
    (security.mixedContent === 0 ? 10 : 0) +
    (security.cookieSecurityIssues.length === 0 ? 20 : Math.max(0, 20 - security.cookieSecurityIssues.length * 2))
  ));

  const tlsEntries = Object.entries(security.tlsVersions);
  const cipherEntries = Object.entries(security.cipherSuites);

  // Check headers
  const responseHeaders = entries.flatMap(e => e.rawEntry.response.headers || []);
  const getHeader = (name: string) => responseHeaders.find(h => h.name.toLowerCase() === name.toLowerCase());
  const hsts = getHeader('strict-transport-security');
  const csp = getHeader('content-security-policy');
  const xframe = getHeader('x-frame-options');
  const xcto = getHeader('x-content-type-options');
  const rp = getHeader('referrer-policy');
  const pp = getHeader('permissions-policy');

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Score overview */}
      <div className="rounded-xl p-6" style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Security Score
        </div>
        <div className="flex items-center gap-8">
          <ScoreRing score={score} label="Overall Score" />
          <div className="flex-1 grid grid-cols-3 gap-4">
            {[
              { label: 'HTTPS Usage', value: `${security.httpsPercentage.toFixed(1)}%`, ok: security.httpsPercentage >= 90 },
              { label: 'HSTS Enabled', value: security.hstsEnabled ? 'Yes' : 'No', ok: security.hstsEnabled },
              { label: 'CSP Enabled', value: security.cspEnabled ? 'Yes' : 'No', ok: security.cspEnabled },
              { label: 'Insecure Requests', value: String(security.insecureRequests), ok: security.insecureRequests === 0 },
              { label: 'Mixed Content', value: String(security.mixedContent), ok: security.mixedContent === 0 },
              { label: 'Cookie Issues', value: String(security.cookieSecurityIssues.length), ok: security.cookieSecurityIssues.length === 0 },
            ].map(({ label, value, ok }) => (
              <div key={label} className="rounded-lg p-3"
                style={{ background: 'var(--color-surface-2)', border: `1px solid ${ok ? 'var(--color-success)30' : 'var(--color-error)30'}` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  {ok
                    ? <CheckCircle2 size={11} style={{ color: 'var(--color-success)' }} />
                    : <XCircle size={11} style={{ color: 'var(--color-error)' }} />}
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{label}</span>
                </div>
                <span className="text-base font-bold" style={{ color: ok ? 'var(--color-success)' : 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Security Headers */}
        <div className="space-y-2">
          <SectionHeader title="Security Headers" />
          {[
            { header: hsts, name: 'Strict-Transport-Security', desc: 'Enforces HTTPS connections' },
            { header: csp, name: 'Content-Security-Policy', desc: 'Prevents XSS and injection attacks' },
            { header: xframe, name: 'X-Frame-Options', desc: 'Prevents clickjacking' },
            { header: xcto, name: 'X-Content-Type-Options', desc: 'Prevents MIME sniffing' },
            { header: rp, name: 'Referrer-Policy', desc: 'Controls referrer information' },
            { header: pp, name: 'Permissions-Policy', desc: 'Controls browser features' },
          ].map(({ header, name, desc }) => (
            <IssueRow
              key={name}
              severity={header ? 'success' : 'warning'}
              label={name}
              value={header ? 'Present' : 'Missing'}
              detail={header ? header.value.substring(0, 80) + (header.value.length > 80 ? '…' : '') : desc}
            />
          ))}
        </div>

        {/* HTTPS & TLS */}
        <div className="space-y-4">
          <div>
            <SectionHeader title="HTTPS Analysis" />
            <div className="space-y-2">
              <IssueRow
                severity={security.httpsPercentage >= 90 ? 'success' : security.httpsPercentage >= 50 ? 'warning' : 'error'}
                label="HTTPS Coverage"
                value={`${security.httpsPercentage.toFixed(1)}%`}
                detail={`${Math.round((security.httpsPercentage / 100) * total)} of ${total} requests use HTTPS`}
              />
              {security.insecureRequests > 0 && (
                <IssueRow
                  severity="error"
                  label="Insecure HTTP Requests"
                  value={String(security.insecureRequests)}
                  detail="Requests sent over unencrypted HTTP"
                />
              )}
              {security.mixedContent > 0 && (
                <IssueRow
                  severity="warning"
                  label="Mixed Content"
                  value={String(security.mixedContent)}
                  detail="Non-HTTPS resources loaded on HTTPS page"
                />
              )}
            </div>
          </div>

          {tlsEntries.length > 0 && (
            <div>
              <SectionHeader title="TLS Versions" />
              <div className="space-y-2">
                {tlsEntries.map(([version, count]) => {
                  const isOld = version === 'TLSv1' || version === 'TLSv1.1' || version === 'TLS 1.0' || version === 'TLS 1.1';
                  return (
                    <IssueRow
                      key={version}
                      severity={isOld ? 'warning' : 'success'}
                      label={version}
                      value={`${count} requests`}
                      detail={isOld ? 'Outdated TLS version — upgrade to TLS 1.2 or higher' : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cookie Security */}
      {security.cookieSecurityIssues.length > 0 && (
        <div>
          <SectionHeader title={`Cookie Security Issues (${security.cookieSecurityIssues.length})`} />
          <div className="space-y-2">
            {security.cookieSecurityIssues.slice(0, 20).map((issue, i) => (
              <IssueRow
                key={i}
                severity="warning"
                label={`${issue.name} on ${issue.domain}`}
                value={issue.issues.length > 1 ? `${issue.issues.length} issues` : issue.issues[0]}
                detail={issue.issues.join(', ')}
              />
            ))}
            {security.cookieSecurityIssues.length > 20 && (
              <p className="text-xs px-3" style={{ color: 'var(--color-text-muted)' }}>
                +{security.cookieSecurityIssues.length - 20} more cookie issues
              </p>
            )}
          </div>
        </div>
      )}

      {/* Cipher Suites */}
      {cipherEntries.length > 0 && (
        <div>
          <SectionHeader title="Cipher Suites" />
          <div className="grid grid-cols-2 gap-2">
            {cipherEntries.map(([cipher, count]) => (
              <div key={cipher} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {cipher}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
    </div>
  );
}
