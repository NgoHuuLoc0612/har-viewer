'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock, ChevronDown, ChevronRight,
  Copy, Download, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2,
  XCircle, Clock, Key, Server, Globe, Hash, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { HarAnalysis } from '@har-viewer/shared';
import { copyToClipboard, downloadFile } from '@/lib/utils';

interface CertificateInspectorProps { analysis: HarAnalysis; }

const GRADE_COLOR: Record<string, string> = {
  'A+': '#10b981', 'A': '#10b981', 'B': '#22c55e',
  'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444',
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
        color: ok ? '#10b981' : '#ef4444',
        border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
      }}>
      {ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

function SecRow({ label, value, ok, detail }: { label: string; value: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg mb-1.5"
      style={{
        background: ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
        border: `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
      }}>
      <div className="mt-0.5 flex-shrink-0">
        {ok ? <CheckCircle2 size={14} style={{ color: '#10b981' }} />
          : <XCircle size={14} style={{ color: '#ef4444' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
          <span className="text-xs font-bold flex-shrink-0"
            style={{ color: ok ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>{value}</span>
        </div>
        {detail && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{detail}</p>}
      </div>
    </div>
  );
}

function CertCard({ cert, index, isLeaf }: { cert: any; index: number; isLeaf: boolean }) {
  const [expanded, setExpanded] = useState(isLeaf);
  const [extsOpen, setExtsOpen] = useState(false);

  const remaining = cert.remainingDays;
  const remainColor = remaining < 0 ? '#ef4444' : remaining < 30 ? '#f59e0b' : remaining < 90 ? '#f97316' : '#10b981';

  return (
    <div className="rounded-xl overflow-hidden mb-3"
      style={{
        background: 'var(--color-surface-1)',
        border: `1px solid ${isLeaf ? 'var(--color-accent)' : 'var(--color-border)'}`,
      }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        style={{ background: isLeaf ? 'var(--color-accent-bg)' : 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}
        onClick={() => setExpanded(!expanded)}>
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: isLeaf ? 'var(--color-accent)' : 'var(--color-surface-3)', color: isLeaf ? '#000' : 'var(--color-text-secondary)' }}>
          {index === 0 ? '🍃' : index === 1 ? '🔗' : '🌳'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {cert.subjectCN || 'Unknown CN'}
            {isLeaf && <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--color-accent)', color: '#000' }}>Leaf</span>}
            {cert.isSelfSigned && <span className="ml-2 text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>Self-Signed</span>}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Issued by: {cert.issuerCN}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold" style={{ color: remainColor }}>
            {remaining < 0 ? `Expired ${Math.abs(remaining)}d ago` : `${remaining}d left`}
          </span>
          {expanded ? <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
            : <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="p-4 grid grid-cols-2 gap-4">
              {/* Left: Subject & Identity */}
              <div className="space-y-3">
                <FieldGroup title="Subject">
                  <Field label="CN" value={cert.subjectCN} mono copy />
                  {cert.subject.O && <Field label="O" value={cert.subject.O} />}
                  {cert.subject.OU && <Field label="OU" value={cert.subject.OU} />}
                  {cert.subject.C && <Field label="C" value={cert.subject.C} />}
                  {cert.subject.L && <Field label="L" value={cert.subject.L} />}
                  {cert.subject.ST && <Field label="ST" value={cert.subject.ST} />}
                </FieldGroup>

                {cert.subjectAltNames?.length > 0 && (
                  <FieldGroup title={`SAN (${cert.subjectAltNames.length})`}>
                    <div className="flex flex-wrap gap-1">
                      {cert.subjectAltNames.slice(0, 12).map((san: string) => (
                        <span key={san} className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--color-surface-3)', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                          {san}
                        </span>
                      ))}
                      {cert.subjectAltNames.length > 12 && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          +{cert.subjectAltNames.length - 12} more
                        </span>
                      )}
                    </div>
                  </FieldGroup>
                )}

                <FieldGroup title="Issuer">
                  <Field label="CN" value={cert.issuerCN} mono />
                  {cert.issuer.O && <Field label="O" value={cert.issuer.O} />}
                  {cert.issuer.C && <Field label="C" value={cert.issuer.C} />}
                </FieldGroup>
              </div>

              {/* Right: Technical Details */}
              <div className="space-y-3">
                <FieldGroup title="Identity">
                  <Field label="Serial" value={cert.serialNumber} mono copy />
                  <Field label="Version" value={`v${cert.version}`} />
                  <Field label="Self-Signed" value={cert.isSelfSigned ? 'Yes' : 'No'} />
                </FieldGroup>

                <FieldGroup title="Cryptography">
                  <Field label="Sig Algorithm" value={cert.signatureAlgorithm} mono />
                  <Field label="Key Algorithm" value={cert.publicKeyAlgorithm} />
                  <Field label="Key Size" value={cert.keySize ? `${cert.keySize} bits` : '—'} />
                  {cert.curve && <Field label="Curve" value={cert.curve} mono />}
                </FieldGroup>

                <FieldGroup title="Validity">
                  <Field label="Not Before" value={new Date(cert.validFrom).toLocaleDateString()} />
                  <Field label="Not After" value={new Date(cert.validUntil).toLocaleDateString()} />
                  <Field label="Lifetime" value={`${cert.lifetimeDays} days`} />
                  <Field label="Remaining" value={remaining < 0 ? 'EXPIRED' : `${remaining} days`}
                    valueColor={remainColor} />
                </FieldGroup>

                <FieldGroup title="Fingerprints">
                  <Field label="SHA-1" value={cert.fingerprintSHA1.match(/.{2}/g)?.join(':').slice(0, 29) + '...' || ''} mono copy
                    fullValue={cert.fingerprintSHA1} />
                  <Field label="SHA-256" value={cert.fingerprintSHA256.slice(0, 24) + '...' || ''} mono copy
                    fullValue={cert.fingerprintSHA256} />
                </FieldGroup>
              </div>
            </div>

            {/* Extensions */}
            {cert.extensions?.length > 0 && (
              <div className="px-4 pb-4">
                <button onClick={() => setExtsOpen(!extsOpen)}
                  className="flex items-center gap-2 text-xs font-semibold mb-2"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {extsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Extensions ({cert.extensions.length})
                </button>
                {extsOpen && (
                  <div className="space-y-1.5">
                    {cert.extensions.map((ext: any, i: number) => (
                      <div key={i} className="px-3 py-2 rounded-lg"
                        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {ext.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {ext.critical && (
                              <span className="text-xs px-1 py-0.5 rounded"
                                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 9 }}>
                                CRITICAL
                              </span>
                            )}
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {ext.id}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs break-all" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {ext.value.slice(0, 200)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PEM Export */}
            {cert.pemEncoded && (
              <div className="px-4 pb-4 flex gap-2">
                <button onClick={() => { copyToClipboard(cert.pemEncoded); toast.success('PEM copied'); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <Copy size={12} /> Copy PEM
                </button>
                <button onClick={() => downloadFile(cert.pemEncoded, `${cert.subjectCN.replace(/\*/g, 'wildcard')}.pem`, 'application/x-pem-file')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <Download size={12} /> Download PEM
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--color-text-muted)' }}>{title}</div>
      <div className="space-y-1 px-2 py-2 rounded-lg"
        style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, mono, copy: canCopy, valueColor, fullValue }: {
  label: string; value: string; mono?: boolean; copy?: boolean;
  valueColor?: string; fullValue?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 py-0.5 group">
      <span className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{label}:</span>
      <span className="text-xs break-all flex-1" title={fullValue || value}
        style={{ color: valueColor || (mono ? 'var(--color-accent)' : 'var(--color-text-secondary)'), fontFamily: mono ? 'var(--font-mono)' : undefined }}>
        {value || '—'}
      </span>
      {canCopy && value && (
        <button onClick={() => { copyToClipboard(fullValue || value); toast.success('Copied'); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Copy size={10} style={{ color: 'var(--color-text-muted)' }} />
        </button>
      )}
    </div>
  );
}

export function CertificateInspector({ analysis }: CertificateInspectorProps) {
  const [host, setHost] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [exportTab, setExportTab] = useState<'pem' | 'json' | 'openssl'>('pem');

  // Extract unique HTTPS domains from HAR
  const httpsDomains = Array.from(new Set(
    analysis.entries
      .filter(e => e.scheme === 'https' || e.protocol === 'https')
      .map(e => e.domain)
      .filter(Boolean)
  )).sort();

  const inspect = useCallback(async () => {
    if (!host) { toast.error('Select or enter a host'); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/certificate/inspect?host=${encodeURIComponent(host)}&port=443`);
      const data = await res.json();
      setResult(data);
      if (data.error) toast.error('Failed: ' + data.error);
      else toast.success(`Certificate chain fetched (${data.chain?.length || 0} certs)`);
    } catch (e: any) {
      toast.error('Request failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [host]);

  const tlsInfo = result?.tlsInfo;
  const sec = result?.securityAnalysis;
  const grade = sec?.grade || '—';

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-0)' }}>
        <Globe size={14} style={{ color: 'var(--color-accent)' }} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Certificate Inspector
        </span>
        <div className="ml-4 flex items-center gap-2 flex-1">
          <select value={host} onChange={e => setHost(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg outline-none flex-1 max-w-xs"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
            <option value="">Select domain from HAR…</option>
            {httpsDomains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>or</span>
          <input value={host} onChange={e => setHost(e.target.value)}
            placeholder="Type any hostname…"
            className="text-xs px-2 py-1.5 rounded-lg outline-none w-52"
            onKeyDown={e => e.key === 'Enter' && inspect()}
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }} />
          <button onClick={inspect} disabled={loading || !host}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}>
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Shield size={12} />}
            {loading ? 'Fetching…' : 'Inspect'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4"
            style={{ color: 'var(--color-text-muted)' }}>
            <Lock size={48} style={{ opacity: 0.15 }} />
            <div className="text-center">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Certificate Chain Inspector
              </p>
              <p className="text-xs">Select a domain from your HAR file or type any hostname to inspect its TLS certificate chain</p>
            </div>
            {httpsDomains.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {httpsDomains.slice(0, 8).map(d => (
                  <button key={d} onClick={() => { setHost(d); }}
                    className="text-xs px-2.5 py-1 rounded-full transition-colors"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-accent)' }}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-5">
            {result.error && (
              <div className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertTriangle style={{ color: '#ef4444' }} size={18} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Connection Failed</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{result.error}</p>
                </div>
              </div>
            )}

            {/* Grade + TLS Overview */}
            {sec && (
              <div className="rounded-xl p-5"
                style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-start gap-6">
                  {/* Grade ring */}
                  <div className="text-center flex-shrink-0">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black"
                      style={{ background: `${GRADE_COLOR[grade] || '#ef4444'}18`, border: `2px solid ${GRADE_COLOR[grade] || '#ef4444'}`, color: GRADE_COLOR[grade] || '#ef4444' }}>
                      {grade}
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>Security Grade</p>
                    <p className="text-xs font-bold" style={{ color: GRADE_COLOR[grade], fontFamily: 'var(--font-mono)' }}>
                      {sec.overallScore}/100
                    </p>
                  </div>

                  {/* Security Analysis Grid */}
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <SecRow label="Key Strength" value={sec.keyStrength.label} ok={sec.keyStrength.ok} detail={sec.keyStrength.detail} />
                    <SecRow label="Hash Algorithm" value={sec.hashAlgorithm.label} ok={sec.hashAlgorithm.ok} detail={sec.hashAlgorithm.detail} />
                    <SecRow label="Validity" value={sec.validity.label} ok={sec.validity.ok} detail={sec.validity.detail} />
                    <SecRow label="Hostname" value={sec.hostname.ok ? '✓ Match' : '✗ Mismatch'} ok={sec.hostname.ok} detail={sec.hostname.detail} />
                    <SecRow label="Chain" value={sec.chain.label} ok={sec.chain.ok} detail={sec.chain.detail} />
                    <SecRow label="Revocation" value={sec.revocation.label} ok={sec.revocation.ok} detail={sec.revocation.detail} />
                    <SecRow label="CT Logs" value={sec.ct.label} ok={sec.ct.ok} detail={sec.ct.detail} />
                    <SecRow label="TLS" value={sec.tls.label} ok={sec.tls.ok} detail={sec.tls.detail} />
                  </div>
                </div>
              </div>
            )}

            {/* TLS Connection Details */}
            {tlsInfo && (
              <div className="rounded-xl p-4"
                style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  TLS Connection
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Protocol', value: tlsInfo.protocol || '—', ok: tlsInfo.protocol?.includes('1.2') || tlsInfo.protocol?.includes('1.3') },
                    { label: 'Cipher Suite', value: tlsInfo.cipher || '—', ok: true },
                    { label: 'Forward Secrecy', value: tlsInfo.forwardSecrecy ? 'Yes ✓' : 'No ✗', ok: tlsInfo.forwardSecrecy },
                    { label: 'ALPN', value: tlsInfo.alpn || 'none', ok: !!tlsInfo.alpn },
                    { label: 'HTTP/2', value: tlsInfo.alpn === 'h2' ? 'Yes' : 'No', ok: tlsInfo.alpn === 'h2' },
                    { label: 'Authorized', value: tlsInfo.authorized ? 'Yes' : 'No', ok: tlsInfo.authorized },
                    { label: 'Session Reused', value: tlsInfo.sessionReused ? 'Yes' : 'No', ok: tlsInfo.sessionReused },
                    { label: 'Cipher Bits', value: tlsInfo.cipherBits ? `${tlsInfo.cipherBits} bit` : '—', ok: (tlsInfo.cipherBits || 0) >= 128 },
                  ].map(({ label, value, ok }) => (
                    <div key={label} className="rounded-lg p-3"
                      style={{ background: 'var(--color-surface-2)', border: `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                      <div className="text-xs font-bold"
                        style={{ color: ok ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certificate Chain */}
            {result.chain?.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                  style={{ color: 'var(--color-text-muted)' }}>
                  <Link2 size={12} />
                  Certificate Chain ({result.chain.length} certificates)
                </div>
                {result.chain.map((cert: any, i: number) => (
                  <CertCard key={i} cert={cert} index={i} isLeaf={i === 0} />
                ))}
              </div>
            )}

            {/* Export */}
            {result.exportData && (
              <div className="rounded-xl overflow-hidden"
                style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-1 px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <Download size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider ml-1" style={{ color: 'var(--color-text-muted)' }}>Export</span>
                  <div className="flex items-center gap-1 ml-4">
                    {(['pem', 'json', 'openssl'] as const).map(f => (
                      <button key={f} onClick={() => setExportTab(f)}
                        className="text-xs px-2.5 py-1 rounded capitalize"
                        style={{
                          background: exportTab === f ? 'var(--color-accent-bg)' : 'transparent',
                          border: `1px solid ${exportTab === f ? 'var(--color-accent)' : 'transparent'}`,
                          color: exportTab === f ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        }}>
                        {f === 'openssl' ? 'OpenSSL Text' : f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => {
                    const content = exportTab === 'pem' ? result.exportData.pem
                      : exportTab === 'json' ? result.exportData.json
                      : result.exportData.opensslText;
                    const ext = exportTab === 'json' ? 'json' : exportTab === 'pem' ? 'pem' : 'txt';
                    downloadFile(content, `${host}-cert.${ext}`, exportTab === 'json' ? 'application/json' : 'text/plain');
                    toast.success('Downloaded');
                  }} className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded"
                    style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    <Download size={11} /> Download
                  </button>
                </div>
                <pre className="p-4 text-xs overflow-auto max-h-48"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {exportTab === 'pem' ? result.exportData.pem
                    : exportTab === 'json' ? result.exportData.json
                    : result.exportData.opensslText}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
