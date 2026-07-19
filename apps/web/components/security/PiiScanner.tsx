'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, Copy, AlertTriangle, Shield, Search,
  ChevronDown, ChevronRight, Filter, Download, Scan,
  Loader2, ExternalLink, X
} from 'lucide-react';
import { toast } from 'sonner';
import { HarAnalysis } from '@har-viewer/shared';
import { copyToClipboard, downloadFile, truncateUrl } from '@/lib/utils';

interface PiiScannerProps { analysis: HarAnalysis; uuid: string; }

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type Category = 'email' | 'phone' | 'credit-card' | 'identity' | 'authentication' | 'crypto' | 'secret' | 'cloud' | 'database' | 'cookie' | 'pii';

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', label: 'Critical' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', label: 'High' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Medium' },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  label: 'Low' },
  info:     { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)', label: 'Info' },
};

const CATEGORY_ICONS: Record<string, string> = {
  email: '📧', phone: '📱', 'credit-card': '💳', identity: '🪪',
  authentication: '🔑', crypto: '₿', secret: '🔐', cloud: '☁️',
  database: '🗄️', cookie: '🍪', pii: '👤',
};

const CONTEXT_LABELS: Record<string, string> = {
  'header': 'Header', 'cookie': 'Cookie', 'request-body': 'Req Body',
  'response-body': 'Res Body', 'url': 'URL', 'query': 'Query',
  'form-data': 'Form', 'multipart': 'Multipart',
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

function EntropyBar({ value }: { value: number }) {
  const max = 6;
  const pct = Math.min(100, (value / max) * 100);
  const color = value > 4.5 ? '#ef4444' : value > 3.5 ? '#f59e0b' : '#10b981';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span className="text-xs" style={{ color, fontFamily: 'var(--font-mono)' }}>{value.toFixed(2)}</span>
    </div>
  );
}

function MatchRow({ match, index, revealAll = false }: { match: any; index: number; revealAll?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[match.severity as Severity] || SEVERITY_CONFIG.info;

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}
      className="rounded-xl overflow-hidden mb-2"
      style={{ background: 'var(--color-surface-1)', border: `1px solid ${cfg.border}` }}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}>
        {/* Category icon */}
        <span className="text-base flex-shrink-0">{CATEGORY_ICONS[match.category] || '🔍'}</span>

        {/* Type/subtype */}
        <div className="min-w-0" style={{ width: 160, flexShrink: 0 }}>
          <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{match.type}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{match.subtype}</div>
        </div>

        {/* Masked value */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <code className="text-xs px-2 py-0.5 rounded truncate max-w-xs"
            style={{ background: cfg.bg, color: cfg.color, fontFamily: 'var(--font-mono)', border: `1px solid ${cfg.border}` }}>
            {(revealAll || revealed) ? match.value : match.maskedValue}
          </code>
          <button onClick={e => { e.stopPropagation(); setRevealed(!revealed); }}
            className="p-1 rounded flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}
            title={(revealAll || revealed) ? 'Hide value' : 'Reveal value'}>
            {(revealAll || revealed) ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button onClick={e => { e.stopPropagation(); copyToClipboard(match.value); toast.success('Copied!'); }}
            className="p-1 rounded flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            <Copy size={12} />
          </button>
        </div>

        {/* Context badge */}
        <span className="text-xs px-2 py-0.5 rounded flex-shrink-0"
          style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-secondary)' }}>
          {CONTEXT_LABELS[match.context] || match.context}
        </span>

        {/* Severity */}
        <div className="flex-shrink-0"><SeverityBadge severity={match.severity} /></div>

        {/* Entropy */}
        <div className="flex-shrink-0 hidden lg:block"><EntropyBar value={match.entropy} /></div>

        {/* Occurrences */}
        {match.occurrences > 1 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--color-surface-3)', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
            ×{match.occurrences}
          </span>
        )}

        {expanded ? <ChevronDown size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            style={{ borderTop: `1px solid ${cfg.border}` }}>
            <div className="px-4 py-3 grid grid-cols-2 gap-4">
              {/* Left */}
              <div className="space-y-2">
                <InfoRow label="Full Value">
                  <code className="text-xs break-all"
                    style={{ color: cfg.color, fontFamily: 'var(--font-mono)' }}>
                    {(revealAll || revealed) ? match.value : match.maskedValue}
                  </code>
                </InfoRow>
                <InfoRow label="Location">
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{match.location}</span>
                </InfoRow>
                <InfoRow label="Found In">
                  <span className="text-xs truncate" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                    title={match.entryUrl}>
                    {truncateUrl(match.entryUrl, 60)}
                  </span>
                </InfoRow>
                <InfoRow label="Entry">
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    #{match.entryIndex + 1}
                  </span>
                </InfoRow>
                <InfoRow label="Entropy">
                  <div className="flex items-center gap-2">
                    <EntropyBar value={match.entropy} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {match.entropy > 4.5 ? 'Very High (suspicious)' : match.entropy > 3.5 ? 'High' : match.entropy > 2.5 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </InfoRow>
                <InfoRow label="Length">
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {match.length} chars
                  </span>
                </InfoRow>
                <InfoRow label="Occurrences">
                  <span className="text-xs font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                    {match.occurrences}
                  </span>
                </InfoRow>
              </div>

              {/* Right */}
              <div className="space-y-3">
                <div className="rounded-lg p-3"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: cfg.color }}>Risk</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{match.description}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg p-3"
                  style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#10b981' }}>Recommendation</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{match.recommendation}</p>
                </div>
                {match.regex && (
                  <InfoRow label="Pattern">
                    <code className="text-xs break-all" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {match.regex.slice(0, 80)}
                    </code>
                  </InfoRow>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs flex-shrink-0 w-24" style={{ color: 'var(--color-text-muted)' }}>{label}:</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function PiiScanner({ analysis, uuid }: PiiScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [contextFilter, setContextFilter] = useState<string>('all');
  const [revealAll, setRevealAll] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/pii/scan/${uuid}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) { toast.error('Scan failed: ' + data.error); return; }
      setResult(data);
      toast.success(`PII scan complete — ${data.totalMatches} findings`, {
        description: `${data.critical} critical, ${data.high} high severity`
      });
    } catch (e: any) {
      toast.error('Scan error: ' + e.message);
    } finally {
      setScanning(false);
    }
  }, [uuid]);

  const filteredMatches = useMemo(() => {
    if (!result?.matches) return [];
    return result.matches.filter((m: any) => {
      if (severityFilter !== 'all' && m.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
      if (contextFilter !== 'all' && m.context !== contextFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return m.type.toLowerCase().includes(s) ||
          m.subtype.toLowerCase().includes(s) ||
          m.entryUrl.toLowerCase().includes(s) ||
          m.maskedValue.toLowerCase().includes(s) ||
          m.location.toLowerCase().includes(s);
      }
      return true;
    });
  }, [result, severityFilter, categoryFilter, contextFilter, search]);

  const exportReport = useCallback(() => {
    if (!result) return;
    const lines = [
      '# PII Scan Report',
      `Scanned: ${result.entriesScanned} entries | Found: ${result.totalMatches} matches`,
      `Critical: ${result.critical} | High: ${result.high} | Medium: ${result.medium} | Low: ${result.low}`,
      '',
      ...result.matches.map((m: any) =>
        `[${m.severity.toUpperCase()}] ${m.type} / ${m.subtype}\n  Value: ${m.maskedValue}\n  Location: ${m.location}\n  URL: ${m.entryUrl}\n  Risk: ${m.description}\n  Fix: ${m.recommendation}\n`
      )
    ];
    downloadFile(lines.join('\n'), 'pii-scan-report.md', 'text/markdown');
    toast.success('Report exported');
  }, [result]);

  const categories = result ? Object.keys(result.byCategory) : [];
  const contexts = result ? [...new Set(result.matches.map((m: any) => m.context))] : [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <Shield size={14} style={{ color: 'var(--color-accent)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          PII Scanner
        </span>
        <button onClick={scan} disabled={scanning}
          className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-medium disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#000' }}>
          {scanning ? <Loader2 size={13} className="animate-spin" /> : <Scan size={13} />}
          {scanning ? `Scanning ${analysis.entries.length} requests…` : 'Run PII Scan'}
        </button>
        {result && (
          <>
            <button onClick={exportReport}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <Download size={12} /> Export Report
            </button>
            <button onClick={() => setRevealAll(!revealAll)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: revealAll ? 'rgba(239,68,68,0.1)' : 'var(--color-surface-2)', border: `1px solid ${revealAll ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`, color: revealAll ? '#ef4444' : 'var(--color-text-secondary)' }}>
              {revealAll ? <EyeOff size={12} /> : <Eye size={12} />}
              {revealAll ? 'Mask All' : 'Reveal All'}
            </button>
          </>
        )}
      </div>

      {/* Summary bar */}
      {result && (
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
          {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map(sev => {
            const count = result[sev];
            const cfg = SEVERITY_CONFIG[sev];
            return count > 0 ? (
              <button key={sev}
                onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                style={{
                  background: severityFilter === sev ? cfg.bg : 'transparent',
                  border: `1px solid ${severityFilter === sev ? cfg.color : cfg.border}`,
                  color: cfg.color,
                }}>
                {count} {cfg.label}
              </button>
            ) : null;
          })}
          <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
            {result.entriesScanned} requests · {(result.bytesScanned / 1024).toFixed(0)} KB scanned
          </span>
          {severityFilter !== 'all' && (
            <button onClick={() => setSeverityFilter('all')} className="ml-auto">
              <X size={13} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>
      )}

      {/* Filters row */}
      {result && (
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter findings…"
              className="text-xs pl-6 pr-2 py-1.5 rounded-lg outline-none w-44"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>

          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{CATEGORY_ICONS[c] || ''} {c} ({result.byCategory[c]})</option>
            ))}
          </select>

          <select value={contextFilter} onChange={e => setContextFilter(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg outline-none"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
            <option value="all">All Contexts</option>
            {(contexts as string[]).map(c => (
              <option key={c} value={c}>{CONTEXT_LABELS[c] || c}</option>
            ))}
          </select>

          <span className="ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {filteredMatches.length} / {result.totalMatches} shown
          </span>
        </div>
      )}

      {/* Category breakdown */}
      {result && (
        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 overflow-x-auto"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
          {categories.map(cat => (
            <button key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all flex-shrink-0"
              style={{
                background: categoryFilter === cat ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                border: `1px solid ${categoryFilter === cat ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: categoryFilter === cat ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}>
              {CATEGORY_ICONS[cat] || '🔍'} {cat}
              <span className="font-bold ml-1">{result.byCategory[cat]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {!result && !scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-5"
            style={{ color: 'var(--color-text-muted)' }}>
            <Shield size={56} style={{ opacity: 0.12 }} />
            <div className="text-center max-w-md">
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                PII & Secret Scanner
              </p>
              <p className="text-xs mb-4">
                Scan all {analysis.entries.length} requests for emails, phone numbers, credit cards, API keys,
                crypto addresses, OAuth tokens, cloud credentials, database URIs, and 40+ more patterns.
              </p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {['📧 Email', '💳 Cards', '🔑 Auth Tokens', '₿ Crypto',
                  '☁️ Cloud Keys', '🗄️ DB URIs', '🪪 Identity', '🔐 Secrets'].map(label => (
                  <div key={label} className="px-2 py-1.5 rounded-lg text-center"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={scan}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--color-accent)', color: '#000' }}>
              <Scan size={16} />
              Start PII Scan
            </button>
          </div>
        )}

        {scanning && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Scanning {analysis.entries.length} requests across 40+ PII patterns…
            </p>
          </div>
        )}

        {result && filteredMatches.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3"
            style={{ color: 'var(--color-text-muted)' }}>
            {result.totalMatches === 0 ? (
              <>
                <Shield size={40} style={{ color: '#10b981', opacity: 0.5 }} />
                <p className="text-sm font-medium" style={{ color: '#10b981' }}>No PII detected!</p>
                <p className="text-xs">No sensitive data patterns found across {result.entriesScanned} requests.</p>
              </>
            ) : (
              <>
                <Filter size={32} style={{ opacity: 0.3 }} />
                <p className="text-xs">No matches for current filters. <button onClick={() => { setSeverityFilter('all'); setCategoryFilter('all'); setContextFilter('all'); setSearch(''); }} style={{ color: 'var(--color-accent)' }}>Clear filters</button></p>
              </>
            )}
          </div>
        )}

        {result && filteredMatches.length > 0 && (
          <div>
            {/* Stats row */}
            <div className="grid grid-cols-5 gap-3 mb-5">
              {(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map(sev => {
                const cfg = SEVERITY_CONFIG[sev];
                const count = result[sev] || 0;
                return (
                  <div key={sev} className="rounded-xl p-3 text-center"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <div className="text-2xl font-black" style={{ color: cfg.color, fontFamily: 'var(--font-mono)' }}>
                      {count}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: cfg.color }}>{cfg.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Match list */}
            <div>
              {filteredMatches.map((match: any, i: number) => (
                <MatchRow key={match.id} match={match} index={i} revealAll={revealAll} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
