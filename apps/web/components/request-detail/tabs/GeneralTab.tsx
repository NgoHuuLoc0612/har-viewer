'use client';

import { useMemo } from 'react';
import { Copy, Globe, Monitor, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { ProcessedEntry } from '@har-viewer/shared';
import { formatBytes, copyToClipboard } from '@/lib/utils';
import {
  parseUA, parseDomainFrontend, parseMimeFrontend,
  getHttpStatus, analyzeIpFrontend, formatDate,
  formatDurationDayjs, certExpiryLabel, formatRelative
} from '@/lib/enrichment';

interface GeneralTabProps { entry: ProcessedEntry; }

function Row({ label, value, mono = false, copyable = false, children, accent }: {
  label: string; value?: string; mono?: boolean; copyable?: boolean;
  children?: React.ReactNode; accent?: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 group"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span className="text-xs flex-shrink-0 pt-0.5" style={{ color: 'var(--color-text-muted)', width: 148 }}>
        {label}
      </span>
      {children ?? (
        <div className="flex items-start gap-1 flex-1 min-w-0">
          <span className="text-xs break-all flex-1"
            style={{
              color: accent ?? (mono ? 'var(--color-accent)' : 'var(--color-text-primary)'),
              fontFamily: mono ? 'var(--font-mono)' : undefined,
            }}>
            {value || '—'}
          </span>
          {copyable && value && (
            <button onClick={() => { copyToClipboard(value); toast.success('Copied'); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
              <Copy size={10} style={{ color: 'var(--color-text-muted)' }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: {
  title: string; icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-muted)' }}>
        {Icon && <Icon size={11} />}
        {title}
      </div>
      <div className="rounded-lg px-3 overflow-hidden"
        style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
        {children}
      </div>
    </div>
  );
}

export function GeneralTab({ entry }: GeneralTabProps) {
  const reqHeaders = entry.rawEntry.request.headers || [];

  // ── enrichment ──────────────────────────────────────────────────────────
  const uaHeader = reqHeaders.find((h: any) => h.name.toLowerCase() === 'user-agent')?.value || '';
  const ua     = useMemo(() => uaHeader ? parseUA(uaHeader) : null, [uaHeader]);
  const domain = useMemo(() => parseDomainFrontend(entry.domain || ''), [entry.domain]);
  const mimeI  = useMemo(() => parseMimeFrontend(entry.mimeType || ''), [entry.mimeType]);
  const status = useMemo(() => getHttpStatus(entry.status), [entry.status]);
  const ip     = useMemo(() => analyzeIpFrontend(entry.remoteIp || ''), [entry.remoteIp]);

  const queryParams = entry.rawEntry.request.queryString || [];

  return (
    <div className="p-3 overflow-auto h-full">

      {/* ── Status ───────────────────────────────────────────────────────── */}
      <Section title="HTTP Status">
        <Row label="Status Code">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black" style={{ color: status.color, fontFamily: 'var(--font-mono)' }}>
              {status.emoji} {status.label}
            </span>
            {status.isCacheable && (
              <span className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: 10 }}>
                cacheable
              </span>
            )}
          </div>
        </Row>
        <Row label="Description" value={status.description} />
        <Row label="Category" value={status.category} />
      </Section>

      {/* ── URL ──────────────────────────────────────────────────────────── */}
      <Section title="Request URL">
        <Row label="Full URL"    value={entry.url}       mono copyable />
        <Row label="Method"      value={entry.method}    mono />
        <Row label="Protocol"    value={entry.protocol}  mono />
        <Row label="Scheme"      value={entry.scheme}    />
        <Row label="Host"        value={entry.host}      mono copyable />
        <Row label="Path"        value={entry.path}      mono />
        <Row label="Query"       value={entry.queryString} mono copyable />
        <Row label="Fragment"    value={entry.fragment}  mono />
        <Row label="HTTP Version" value={entry.httpVersion} mono />
      </Section>

      {/* ── Domain Analysis ──────────────────────────────────────────────── */}
      <Section title="Domain Analysis" icon={Globe}>
        <Row label="Hostname"       value={domain.hostname} mono />
        <Row label="Registered Domain" value={domain.domain} mono copyable />
        <Row label="Subdomain"      value={domain.subdomain  || '(none)'} mono />
        <Row label="TLD"            value={domain.tld        || '—'} mono />
        <Row label="Domain Base"    value={domain.domainBase || '—'} mono />
        <Row label="Type">
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {domain.badge} {domain.isIp ? 'IP Address' : domain.isPrivate ? 'Private Domain' : 'Public Domain'}
          </span>
        </Row>
      </Section>

      {/* ── MIME Type ────────────────────────────────────────────────────── */}
      <Section title="MIME / Content Type">
        <Row label="MIME Type">
          <span className="text-xs font-medium" style={{ color: mimeI.color, fontFamily: 'var(--font-mono)' }}>
            {mimeI.emoji} {mimeI.type || '—'}
          </span>
        </Row>
        <Row label="Label"      value={mimeI.label} />
        <Row label="Category"   value={mimeI.category} />
        <Row label="Subtype"    value={mimeI.subtype} />
        <Row label="Extension"  value={mimeI.extension ? `.${mimeI.extension}` : '—'} mono />
        <Row label="Text Content"  value={mimeI.isText      ? 'Yes' : 'No'} />
        <Row label="Compressible"  value={mimeI.isCompressible ? 'Yes — should be gzip/br encoded' : 'No'} />
        <Row label="Binary"        value={mimeI.isBinary    ? 'Yes' : 'No'} />
      </Section>

      {/* ── Network / IP ─────────────────────────────────────────────────── */}
      <Section title="Network">
        <Row label="Remote Address">
          <span className="text-xs font-medium" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
            {ip.badge} {ip.normalized || entry.remoteIp || '—'}
          </span>
        </Row>
        <Row label="Remote Port"   value={String(entry.remotePort || '—')} mono />
        <Row label="IP Version"    value={ip.version ? `IPv${ip.version}` : '—'} />
        <Row label="IP Type">
          <span className="text-xs" style={{ color: ip.isPublic ? '#10b981' : ip.isLoopback ? '#f59e0b' : '#94a3b8' }}>
            {ip.tooltip}
          </span>
        </Row>
        {ip.reverseDns && <Row label="Reverse DNS" value={ip.reverseDns} mono />}
        <Row label="Connection ID"   value={entry.connectionId || '—'} mono />
        <Row label="TLS Version"     value={entry.tlsVersion   || '—'} mono />
        <Row label="Cipher Suite"    value={entry.cipherSuite  || '—'} mono />
        <Row label="ALPN Protocol"   value={entry.alpnProtocol || '—'} mono />
        <Row label="Server IP"       value={entry.rawEntry.serverIPAddress || '—'} mono />
      </Section>

      {/* ── User-Agent ───────────────────────────────────────────────────── */}
      {ua && uaHeader && (
        <Section title="User-Agent" icon={Monitor}>
          <Row label="Raw UA" value={uaHeader} mono copyable />
          <Row label="Browser">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {ua.browser.name} {ua.browser.version}
              {ua.browser.major && <span style={{ color: 'var(--color-text-muted)' }}> (v{ua.browser.major})</span>}
            </span>
          </Row>
          <Row label="Engine"   value={`${ua.engine.name} ${ua.engine.version}`} />
          <Row label="OS"       value={`${ua.os.name} ${ua.os.version}`} />
          <Row label="Device">
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {ua.emoji} {ua.isBot ? 'Bot/Crawler' : ua.isMobile ? 'Mobile' : ua.isTablet ? 'Tablet' : 'Desktop'}
              {ua.device.vendor && ` · ${ua.device.vendor} ${ua.device.model}`}
            </span>
          </Row>
          {ua.cpu.architecture && <Row label="CPU Architecture" value={ua.cpu.architecture} />}
        </Section>
      )}

      {/* ── Timing ───────────────────────────────────────────────────────── */}
      <Section title="Timing">
        <Row label="Started"   value={formatDate(entry.rawEntry.startedDateTime)} />
        <Row label="Relative"  value={`+${formatDurationDayjs(entry.startTime * 1000)} from page start`} />
        <Row label="Duration"  value={formatDurationDayjs(entry.duration)} mono />
        <Row label="TTFB"      value={formatDurationDayjs(entry.ttfb)} mono />
        <Row label="End Time"  value={`+${formatDurationDayjs(entry.endTime * 1000)}`} />
        <Row label="DNS"       value={formatDurationDayjs(entry.dnsTime)} />
        <Row label="TCP"       value={formatDurationDayjs(entry.tcpTime)} />
        <Row label="TLS/SSL"   value={formatDurationDayjs(entry.sslTime)} />
        <Row label="Send"      value={formatDurationDayjs(entry.sendTime)} />
        <Row label="Wait"      value={formatDurationDayjs(entry.waitTime)} />
        <Row label="Receive"   value={formatDurationDayjs(entry.receiveTime)} />
      </Section>

      {/* ── Size ─────────────────────────────────────────────────────────── */}
      <Section title="Size">
        <Row label="Transferred"   value={formatBytes(entry.transferredSize)} mono />
        <Row label="Decoded"       value={formatBytes(entry.decodedSize)} mono />
        <Row label="Compression"
          value={entry.compressionRatio > 0 ? `${entry.compressionRatio.toFixed(1)}% saved` : 'Not compressed'}
          accent={entry.compressionRatio > 20 ? '#10b981' : undefined} />
        <Row label="Request Size"  value={formatBytes(entry.requestSize)} />
        <Row label="Response Size" value={formatBytes(entry.responseSize)} />
        <Row label="Headers Size"  value={formatBytes(entry.headersSize)} />
        <Row label="Body Size"     value={formatBytes(entry.bodySize)} />
      </Section>

      {/* ── Cache ────────────────────────────────────────────────────────── */}
      <Section title="Cache">
        <Row label="Cache Status" value={entry.cacheStatus || 'none'}
          accent={entry.cacheHit ? '#8b5cf6' : undefined} />
        <Row label="Memory Cache"       value={entry.memoryCache ? '✓ Yes' : 'No'} />
        <Row label="Disk Cache"         value={entry.diskCache   ? '✓ Yes' : 'No'} />
        <Row label="Service Worker"     value={entry.serviceWorkerCache ? '✓ Yes' : 'No'} />
        <Row label="ETag"               value={entry.etag}         mono copyable />
        <Row label="Last-Modified"      value={entry.lastModified ? formatDate(entry.lastModified) : '—'} />
        <Row label="Expires"            value={entry.expires ? certExpiryLabel(entry.expires).label : '—'} />
      </Section>

      {/* ── Query Parameters ─────────────────────────────────────────────── */}
      {queryParams.length > 0 && (
        <Section title={`Query Parameters (${queryParams.length})`}>
          {queryParams.map((p: any, i: number) => {
            let decoded = p.value;
            try { decoded = decodeURIComponent(p.value); } catch {}
            return (
              <Row key={i} label={p.name} mono copyable value={decoded !== p.value ? decoded : p.value} />
            );
          })}
        </Section>
      )}

      {/* ── Initiator ────────────────────────────────────────────────────── */}
      {entry.rawEntry._initiator && (
        <Section title="Initiator">
          <Row label="Type"          value={entry.rawEntry._initiator.type} />
          {entry.rawEntry._initiator.url && (
            <Row label="URL" value={entry.rawEntry._initiator.url as string} mono copyable />
          )}
        </Section>
      )}
    </div>
  );
}
