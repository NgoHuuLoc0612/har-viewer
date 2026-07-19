import { Injectable, Logger } from '@nestjs/common';
import * as tls from 'tls';
import * as crypto from 'crypto';
import * as net from 'net';

export interface CertExtension {
  id: string; name: string; critical: boolean; value: string; parsed?: any;
}
export interface CertInfo {
  subject: Record<string, string>; subjectCN: string; subjectAltNames: string[];
  issuer: Record<string, string>; issuerCN: string; serialNumber: string;
  version: number; signatureAlgorithm: string; publicKeyAlgorithm: string;
  keySize: number; curve: string; fingerprintSHA1: string; fingerprintSHA256: string;
  validFrom: string; validUntil: string; lifetimeDays: number; remainingDays: number;
  isSelfSigned: boolean; isExpired: boolean; isExpiringSoon: boolean;
  extensions: CertExtension[]; pemEncoded: string; raw: string;
}
export interface TlsInfo {
  protocol: string; cipher: string; cipherBits: number; forwardSecrecy: boolean;
  alpn: string; serverName: string; sessionReused: boolean;
  authorized: boolean; authorizationError: string;
}
export interface CertificateChainResult {
  host: string; port: number; tlsInfo: TlsInfo; chain: CertInfo[];
  securityAnalysis: SecurityAnalysis; exportData: ExportData;
  fetchedAt: string; error?: string;
}
export interface SecurityAnalysis {
  keyStrength: { label: string; ok: boolean; detail: string };
  hashAlgorithm: { label: string; ok: boolean; detail: string };
  validity: { label: string; ok: boolean; detail: string };
  hostname: { label: string; ok: boolean; detail: string };
  chain: { label: string; ok: boolean; detail: string };
  revocation: { label: string; ok: boolean; detail: string };
  ct: { label: string; ok: boolean; detail: string };
  tls: { label: string; ok: boolean; detail: string };
  overallScore: number; grade: string;
}
export interface ExportData { pem: string; json: string; opensslText: string; }

// ─── Known CAs that always embed SCTs by policy ───────────────────────────────
const ALWAYS_EMBED_SCT_CAS = [
  'digicert', "let's encrypt", 'sectigo', 'comodo', 'globalsign',
  'entrust', 'amazon', 'google trust services', 'microsoft',
  'godaddy', 'geotrust', 'rapidssl', 'thawte', 'ssl.com',
  'buypass', 'trustwave', 'comodoca', 'identrust',
];

// SCT OID 1.3.6.1.4.1.11129.2.4.2 content bytes in hex
const SCT_OID_CONTENT_HEX = '2b06010401d679020402';

// ─── Known non-Cloudflare response headers (don't flag as Cloudflare token) ──
const AWS_CDN_HEADERS = [
  'x-amz-cf-id', 'x-amz-request-id', 'x-amz-id-2',
  'x-b3-traceid', 'x-request-id', 'x-correlation-id',
  'x-trace-id', 'cf-ray', 'x-vercel-id', 'x-github-delivery', 'etag',
];

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);
  private cache = new Map<string, { data: CertificateChainResult; ts: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  // TLS option sets tried in order — many CDNs require ALPN before returning certs
  private readonly TLS_OPTION_SETS = [
    {
      ALPNProtocols: ['h2', 'http/1.1'],
      minVersion: 'TLSv1.2' as const,
      ciphers: [
        'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES256-GCM-SHA384',
      ].join(':'),
    },
    { ALPNProtocols: ['http/1.1'], minVersion: 'TLSv1.2' as const },
    { minVersion: 'TLSv1.2' as const },
    { minVersion: 'TLSv1' as const },
  ];

  async fetchCertificateChain(host: string, port = 443): Promise<CertificateChainResult> {
    const key = `${host}:${port}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) return cached.data;
    const result = await this.tryFetch(host, port, 0);
    this.cache.set(key, { data: result, ts: Date.now() });
    return result;
  }

  private tryFetch(host: string, port: number, attempt: number): Promise<CertificateChainResult> {
    const opts = this.TLS_OPTION_SETS[attempt];

    return new Promise((resolve) => {
      let settled = false;
      const done = (r: CertificateChainResult) => {
        if (settled) return; settled = true; clearTimeout(timer); resolve(r);
      };

      const timer = setTimeout(() => {
        sock?.destroy();
        done(this.errorResult(host, port, 'Connection timeout after 10s'));
      }, 10_000);

      let sock: tls.TLSSocket;
      try {
        sock = tls.connect(
          { host, port, servername: host, rejectUnauthorized: false,
            checkServerIdentity: () => undefined, ...opts },
          async () => {
            try {
              const cert = sock.getPeerCertificate(true);

              // Empty cert — retry with next TLS options (CDN ALPN requirement)
              if (!cert || !cert.raw) {
                sock.destroy();
                if (attempt + 1 < this.TLS_OPTION_SETS.length) {
                  this.logger.debug(`${host}: attempt ${attempt + 1} got empty cert, retrying`);
                  settled = true; clearTimeout(timer);
                  resolve(await this.tryFetch(host, port, attempt + 1));
                } else {
                  done(this.errorResult(host, port,
                    'Server did not present a certificate. It may require a browser ' +
                    'connection or does not support TLS on this port.'));
                }
                return;
              }

              const protocol  = sock.getProtocol() || '';
              const cipher    = sock.getCipher();
              const alpn      = (sock as any).alpnProtocol || '';
              const tlsInfo: TlsInfo = {
                protocol, cipher: cipher?.name || '',
                cipherBits: (cipher as any)?.bits || 0,
                forwardSecrecy: this.hasForwardSecrecy(cipher?.name || ''),
                alpn, serverName: host,
                sessionReused: sock.isSessionReused(),
                authorized: sock.authorized,
                authorizationError: (sock as any).authorizationError?.message || '',
              };

              const chain = this.extractChain(cert);

              // Retry if still 0 certs
              if (chain.length === 0 && attempt + 1 < this.TLS_OPTION_SETS.length) {
                sock.destroy();
                settled = true; clearTimeout(timer);
                resolve(await this.tryFetch(host, port, attempt + 1));
                return;
              }

              const securityAnalysis = this.analyzeSecurityAll(chain, tlsInfo, host);
              const leaf = chain[0];
              const exportData: ExportData = {
                pem: leaf?.pemEncoded || '',
                json: JSON.stringify(chain, null, 2),
                opensslText: leaf ? this.toOpensslText(leaf) : '',
              };

              sock.destroy();
              done({ host, port, tlsInfo, chain, securityAnalysis, exportData,
                fetchedAt: new Date().toISOString() });
            } catch (e) {
              sock.destroy();
              done(this.errorResult(host, port, e.message));
            }
          }
        );
        sock.on('error', (e) => done(this.errorResult(host, port, e.message)));
      } catch (e) {
        done(this.errorResult(host, port, e.message));
      }
    });
  }

  private extractChain(cert: tls.DetailedPeerCertificate): CertInfo[] {
    const chain: CertInfo[] = [];
    const seen = new Set<string>();
    let current: tls.DetailedPeerCertificate | null = cert;

    while (current && chain.length < 10) {
      if (!current.raw && !current.fingerprint256 && !current.fingerprint) break;
      const fp = current.fingerprint256 || current.fingerprint || '';
      if (fp && seen.has(fp)) break;
      if (fp) seen.add(fp);
      chain.push(this.parseCert(current));
      if (current.issuerCertificate && current.issuerCertificate !== current) {
        current = current.issuerCertificate;
      } else break;
    }
    return chain;
  }

  private parseCert(c: tls.DetailedPeerCertificate): CertInfo {
    const subject = c.subject as any || {};
    const issuer  = c.issuer  as any || {};

    const validFrom  = c.valid_from  ? new Date(c.valid_from).toISOString()  : '';
    const validUntil = c.valid_to ? new Date(c.valid_to).toISOString() : '';
    const now        = Date.now();
    const msLeft     = validUntil ? new Date(validUntil).getTime() - now : 0;
    const msTotal    = (validFrom && validUntil)
      ? new Date(validUntil).getTime() - new Date(validFrom).getTime() : 0;
    const remainingDays = Math.ceil(msLeft / 86_400_000);
    const lifetimeDays  = Math.ceil(msTotal / 86_400_000);

    const isSelfSigned = (subject.CN || '') === (issuer.CN || '')
      && (subject.O || '') === (issuer.O || '')
      && (subject.C || '') === (issuer.C || '');

    // Public key info
    let publicKeyAlgorithm = 'RSA', keySize = 0, curve = '';
    if ((c as any).pubkey) {
      try {
        const k = crypto.createPublicKey({ key: (c as any).pubkey, format: 'der', type: 'spki' });
        const kd = k.export({ format: 'jwk' }) as any;
        if (kd.kty === 'EC') {
          publicKeyAlgorithm = 'ECDSA';
          curve = kd.crv || '';
          keySize = curve === 'P-256' ? 256 : curve === 'P-384' ? 384 : curve === 'P-521' ? 521 : 256;
        } else {
          keySize = k.asymmetricKeyDetails?.modulusLength || 0;
        }
      } catch { keySize = (c as any).bits || 0; }
    } else {
      keySize = (c as any).bits || 0;
    }

    const rawBuf: Buffer | undefined = (c as any).raw;
    const rawHex = rawBuf ? rawBuf.toString('hex') : '';
    let pemEncoded = '';
    if (rawBuf) {
      const b64 = rawBuf.toString('base64');
      const lines = b64.match(/.{1,64}/g) || [];
      pemEncoded = '-----BEGIN CERTIFICATE-----\n' + lines.join('\n') + '\n-----END CERTIFICATE-----';
    }

    // SANs
    const subjectAltNames: string[] = [];
    if (c.subjectaltname) {
      for (const part of c.subjectaltname.split(',')) {
        const t = part.trim();
        if (t.startsWith('DNS:'))  subjectAltNames.push(t.slice(4));
        else if (t.startsWith('IP:')) subjectAltNames.push(t.slice(3));
        else subjectAltNames.push(t);
      }
    }

    // Extensions
    const exts: CertExtension[] = [];

    if (c.subjectaltname) {
      exts.push({ id: '2.5.29.17', name: 'Subject Alternative Names', critical: false,
        value: subjectAltNames.join('\n') });
    }
    if ((c as any).keyUsage) {
      exts.push({ id: '2.5.29.15', name: 'Key Usage', critical: true,
        value: Array.isArray((c as any).keyUsage) ? (c as any).keyUsage.join(', ') : String((c as any).keyUsage) });
    }
    if ((c as any).extendedKeyUsage) {
      exts.push({ id: '2.5.29.37', name: 'Extended Key Usage', critical: false,
        value: Array.isArray((c as any).extendedKeyUsage) ? (c as any).extendedKeyUsage.join(', ') : String((c as any).extendedKeyUsage) });
    }
    if ((c as any).basicConstraints !== undefined) {
      exts.push({ id: '2.5.29.19', name: 'Basic Constraints', critical: true,
        value: String((c as any).basicConstraints) });
    }
    if ((c as any).infoAccess) {
      const ia = (c as any).infoAccess;
      exts.push({ id: '1.3.6.1.5.5.7.1.1', name: 'Authority Information Access', critical: false,
        value: typeof ia === 'object'
          ? Object.entries(ia).map(([k, v]) => k + ': ' + v).join('\n')
          : String(ia) });
    }
    if ((c as any).crlDistributionPoints) {
      exts.push({ id: '2.5.29.31', name: 'CRL Distribution Points', critical: false,
        value: Array.isArray((c as any).crlDistributionPoints)
          ? (c as any).crlDistributionPoints.join('\n') : String((c as any).crlDistributionPoints) });
    }

    // SCT detection — 3 layers
    const sctInRaw     = rawHex.includes(SCT_OID_CONTENT_HEX);
    const sctViaFields = !!(((c as any).signedCertificateTimestampList) || ((c as any).ct_precert_scts));
    const issuerO      = (issuer.O || '').toLowerCase();
    const sctByIssuer  = ALWAYS_EMBED_SCT_CAS.some(ca => issuerO.includes(ca));

    if (sctInRaw || sctViaFields) {
      exts.push({ id: '1.3.6.1.4.1.11129.2.4.2', name: 'Signed Certificate Timestamps',
        critical: false, value: 'SCT extension confirmed in certificate (CT logged)' });
    } else if (sctByIssuer) {
      exts.push({ id: '1.3.6.1.4.1.11129.2.4.2', name: 'Signed Certificate Timestamps',
        critical: false, value: 'SCT likely present — major CA always embeds SCTs (unverifiable via TLS API)' });
    }

    return {
      subject, subjectCN: subject.CN || '',
      subjectAltNames, issuer, issuerCN: issuer.CN || '',
      serialNumber: c.serialNumber || '',
      version: (c as any).version || 3,
      signatureAlgorithm: (c as any).signatureAlgorithm || '',
      publicKeyAlgorithm, keySize, curve,
      fingerprintSHA1:   c.fingerprint?.replace(/:/g, '') || '',
      fingerprintSHA256: c.fingerprint256?.replace(/:/g, '') || '',
      validFrom, validUntil, lifetimeDays, remainingDays,
      isSelfSigned,
      isExpired:      msLeft < 0,
      isExpiringSoon: msLeft > 0 && remainingDays <= 30,
      extensions: exts,
      pemEncoded,
      raw: this.safeStringify(c),
    };
  }

  private analyzeSecurityAll(chain: CertInfo[], tls: TlsInfo, hostname: string): SecurityAnalysis {
    const leaf = chain[0];
    if (!leaf) return this.emptyAnalysis();

    // Key strength
    let keyOk = false, keyLabel = '', keyDetail = '';
    if (leaf.publicKeyAlgorithm === 'ECDSA') {
      keyOk    = leaf.keySize >= 256;
      keyLabel = 'ECDSA ' + (leaf.curve || leaf.keySize);
      keyDetail = keyOk ? leaf.curve + ' — strong elliptic curve' : 'Weak curve detected';
    } else {
      keyOk    = leaf.keySize >= 2048;
      keyLabel = 'RSA ' + leaf.keySize;
      keyDetail = leaf.keySize >= 4096 ? 'RSA 4096 — excellent'
        : leaf.keySize >= 2048 ? 'RSA 2048 — acceptable, consider 4096'
        : 'RSA < 2048 — WEAK, must upgrade immediately';
    }

    // Hash
    const sigAlgo = leaf.signatureAlgorithm?.toLowerCase() || '';
    const hashOk  = !sigAlgo.includes('sha1') && !sigAlgo.includes('md5');
    const hashAlgo = sigAlgo.includes('sha512') ? 'SHA-512' : sigAlgo.includes('sha384') ? 'SHA-384'
      : sigAlgo.includes('sha256') ? 'SHA-256' : sigAlgo.includes('sha1') ? 'SHA-1' : sigAlgo;

    // Validity
    let validLabel = '', validOk = true, validDetail = '';
    if (leaf.isExpired) {
      validLabel = 'Expired'; validOk = false;
      validDetail = 'Expired ' + Math.abs(leaf.remainingDays) + ' days ago';
    } else if (leaf.isExpiringSoon) {
      validLabel = 'Expiring Soon'; validOk = false;
      validDetail = 'Expires in ' + leaf.remainingDays + ' days';
    } else if (leaf.lifetimeDays > 398) {
      validLabel = '398 Days Exceeded'; validOk = false;
      validDetail = 'Lifetime ' + leaf.lifetimeDays + 'd exceeds 398-day browser limit';
    } else {
      validLabel = 'Valid (' + leaf.remainingDays + 'd remaining)'; validOk = true;
      validDetail = 'Valid until ' + new Date(leaf.validUntil).toLocaleDateString();
    }

    // Hostname
    const matchesSAN = leaf.subjectAltNames.some(san => {
      if (san.startsWith('*.')) return hostname.endsWith(san.slice(1));
      return san === hostname;
    });
    const hostnameOk = matchesSAN || leaf.subjectCN === hostname;

    // Chain
    const chainOk    = chain.length >= 2 && !leaf.isSelfSigned;
    const chainLabel = leaf.isSelfSigned ? 'Self-Signed'
      : chain.length < 2 ? 'Missing Intermediate'
      : 'Valid (' + chain.length + ' certs)';

    // TLS
    const tlsOk    = tls.protocol?.includes('TLSv1.2') || tls.protocol?.includes('TLSv1.3');
    const tlsLabel = tls.protocol || 'Unknown';
    const tlsDetail = tls.forwardSecrecy
      ? tls.protocol + ' with Forward Secrecy (' + tls.cipher + ')'
      : tls.protocol + ' — ' + tls.cipher;

    // SCT
    const sctExt       = leaf.extensions.find(e => e.name.includes('Timestamp'));
    const hasSCT       = !!sctExt;
    const sctConfirmed = hasSCT && !sctExt.value.includes('likely');
    const sctInferred  = hasSCT && sctExt.value.includes('likely');
    const ctLabel      = sctConfirmed ? 'SCT Present'
      : sctInferred  ? 'SCT Present (inferred)'
      : 'SCT Unverifiable';
    const ctDetail     = sctConfirmed
      ? 'Certificate Transparency log entry confirmed in raw cert'
      : sctInferred
      ? 'SCT likely present — issued by CT-compliant CA (unverifiable via Node.js TLS API)'
      : 'SCT status unknown — cannot read from TLS session (not a browser-visible error)';

    // Revocation
    const hasOCSP = leaf.extensions.some(e => e.name.includes('Authority Information') && e.value.includes('OCSP'));
    const hasCRL  = leaf.extensions.some(e => e.name.includes('CRL'));
    const revLabel = hasOCSP ? 'OCSP Available' : hasCRL ? 'CRL Available' : 'No Revocation Info';

    // Score — don't penalise SCT we can't confirm (API limitation)
    const scores = [keyOk, hashOk, validOk, hostnameOk, chainOk, tlsOk, hasSCT, hasOCSP || hasCRL]
      .filter(Boolean).length;
    const overallScore = Math.round((scores / 8) * 100);
    const grade = overallScore >= 90 ? 'A+' : overallScore >= 80 ? 'A' : overallScore >= 70 ? 'B'
      : overallScore >= 60 ? 'C' : overallScore >= 50 ? 'D' : 'F';

    return {
      keyStrength:   { label: keyLabel,  ok: keyOk,        detail: keyDetail },
      hashAlgorithm: { label: hashAlgo,  ok: hashOk,       detail: hashOk ? 'Strong hash algorithm' : 'SHA-1/MD5 deprecated' },
      validity:      { label: validLabel, ok: validOk,     detail: validDetail },
      hostname:      { label: hostnameOk ? 'SAN Match: ' + hostname : 'Mismatch: ' + hostname,
                       ok: hostnameOk, detail: hostnameOk ? 'Hostname matches certificate SAN' : 'Hostname does NOT match any SAN' },
      chain:         { label: chainLabel, ok: chainOk,     detail: chainOk ? 'Complete chain with ' + chain.length + ' certificates' : 'Incomplete chain' },
      revocation:    { label: revLabel,   ok: hasOCSP,     detail: hasOCSP ? 'OCSP endpoint present' : 'No OCSP — revocation checking unavailable' },
      ct:            { label: ctLabel,    ok: hasSCT,      detail: ctDetail },
      tls:           { label: tlsLabel,   ok: tlsOk,       detail: tlsDetail },
      overallScore, grade,
    };
  }

  private toOpensslText(cert: CertInfo): string {
    const lines = [
      'Certificate:',
      '  Data:',
      '    Version: ' + cert.version + ' (0x' + (cert.version - 1).toString(16) + ')',
      '    Serial Number: ' + cert.serialNumber,
      '  Signature Algorithm: ' + cert.signatureAlgorithm,
      '  Issuer: CN=' + cert.issuerCN + ', O=' + (cert.issuer.O || '') + ', C=' + (cert.issuer.C || ''),
      '  Validity',
      '    Not Before: ' + new Date(cert.validFrom).toUTCString(),
      '    Not After : ' + new Date(cert.validUntil).toUTCString(),
      '  Subject: CN=' + cert.subjectCN + ', O=' + (cert.subject.O || '') + ', C=' + (cert.subject.C || ''),
      '  Subject Public Key Info:',
      '    Public Key Algorithm: ' + cert.publicKeyAlgorithm,
      '      ' + (cert.publicKeyAlgorithm === 'ECDSA' ? 'Curve: ' + cert.curve : 'Key Size: ' + cert.keySize + ' bit'),
      '  X509v3 Extensions:',
      ...cert.extensions.map(e => '    ' + e.name + (e.critical ? ' (critical)' : '') + ':\n      ' + e.value),
      '  Fingerprint SHA-256: ' + (cert.fingerprintSHA256.match(/.{2}/g) || []).join(':'),
      '  Fingerprint SHA-1:   ' + (cert.fingerprintSHA1.match(/.{2}/g) || []).join(':'),
    ];
    return lines.join('\n');
  }

  private safeStringify(obj: any, maxLength = 3000): string {
    const seen = new WeakSet();
    try {
      return JSON.stringify(obj, (key, value) => {
        if (key === 'issuerCertificate') return '[issuerCertificate: see chain]';
        if ((key === 'raw' || key === 'pubkey') && Buffer.isBuffer(value))
          return '[Buffer ' + value.length + ' bytes]';
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      }, 2).slice(0, maxLength);
    } catch { return '{}'; }
  }

  private emptyAnalysis(): SecurityAnalysis {
    const na = { label: 'N/A', ok: false, detail: 'No certificate data' };
    return {
      keyStrength: na, hashAlgorithm: na, validity: na,
      hostname: { ...na, label: 'Mismatch' },
      chain: na, revocation: na, ct: na, tls: na,
      overallScore: 0, grade: 'F',
    };
  }

  private errorResult(host: string, port: number, error: string): CertificateChainResult {
    return {
      host, port,
      tlsInfo: { protocol: '', cipher: '', cipherBits: 0, forwardSecrecy: false,
        alpn: '', serverName: host, sessionReused: false, authorized: false, authorizationError: error },
      chain: [], securityAnalysis: this.emptyAnalysis(),
      exportData: { pem: '', json: '', opensslText: '' },
      fetchedAt: new Date().toISOString(), error,
    };
  }

  private hasForwardSecrecy(cipher: string): boolean {
    return /ECDHE|DHE|ECDH/i.test(cipher);
  }
}
