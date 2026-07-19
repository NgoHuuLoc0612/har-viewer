import { Injectable } from '@nestjs/common';

export type PiiSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type PiiContext = 'header' | 'cookie' | 'request-body' | 'response-body' | 'url' | 'query' | 'form-data' | 'multipart';
export type PiiCategory =
  | 'email' | 'phone' | 'credit-card' | 'identity'
  | 'authentication' | 'crypto' | 'secret' | 'cloud'
  | 'database' | 'cookie' | 'pii';

export interface PiiMatch {
  id: string;
  category: PiiCategory;
  type: string;
  subtype: string;
  severity: PiiSeverity;
  value: string;
  maskedValue: string;
  entropy: number;
  length: number;
  context: PiiContext;
  location: string;
  entryIndex: number;
  entryUrl: string;
  occurrences: number;
  description: string;
  recommendation: string;
  regex?: string;
}

export interface PiiScanResult {
  totalMatches: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  byCategory: Record<string, number>;
  matches: PiiMatch[];
  scannedAt: string;
  entriesScanned: number;
  bytesScanned: number;
}

interface PiiRule {
  category: PiiCategory;
  type: string;
  subtype: string;
  severity: PiiSeverity;
  pattern: RegExp;
  /** Hard validate the matched string (e.g. Luhn, entropy) */
  validate?: (match: string, fullText: string, matchIndex: number) => boolean;
  /** Require at least one keyword within ±N chars of the match */
  requireKeywords?: string[];
  keywordWindow?: number;
  /** Only run this rule in these contexts */
  onlyContexts?: PiiContext[];
  /** Skip this rule if the response MIME type is binary */
  skipBinaryBody?: boolean;
  description: string;
  recommendation: string;
}

// ─── Binary MIME detection ────────────────────────────────────────────────────
const BINARY_MIME_PREFIXES = [
  'image/', 'video/', 'audio/', 'font/',
  'application/octet-stream', 'application/wasm',
  'application/zip', 'application/gzip', 'application/x-7z',
  'application/x-bzip', 'application/x-rar', 'application/x-tar',
  'application/vnd.ms-', 'application/vnd.openxmlformats',
  'application/vnd.android', 'application/vnd.apple',
];

function isBinaryMime(mime: string): boolean {
  if (!mime) return false;
  const m = mime.split(';')[0].trim().toLowerCase();
  return BINARY_MIME_PREFIXES.some(p => m.startsWith(p));
}

/** Is the text likely base64-encoded binary (e.g. inline image data)? */
function looksLikeBinaryBase64(text: string): boolean {
  if (text.length < 100) return false;
  // High ratio of base64 chars with very few spaces/newlines
  const b64Chars = (text.match(/[A-Za-z0-9+/=]/g) || []).length;
  const ratio = b64Chars / text.length;
  const spacesAndNewlines = (text.match(/[\s\n]/g) || []).length;
  return ratio > 0.97 && spacesAndNewlines < text.length * 0.01;
}

// ─── Keyword context helper ───────────────────────────────────────────────────
function hasKeywordNear(text: string, index: number, keywords: string[], window = 300): boolean {
  const start = Math.max(0, index - window);
  const end = Math.min(text.length, index + window);
  const slice = text.slice(start, end).toLowerCase();
  return keywords.some(kw => slice.includes(kw.toLowerCase()));
}

// ─── Common false positive patterns to skip ───────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_HASH_RE = /^[0-9a-f]+$/i;  // all lowercase hex = likely hash
const CSS_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+/;

@Injectable()
export class PiiScannerService {
  private rules: PiiRule[] = this.buildRules();

  private buildRules(): PiiRule[] {
    return [

      // ── EMAIL ──────────────────────────────────────────────────────────────
      {
        category: 'email', type: 'Email', subtype: 'Personal',
        severity: 'medium',
        pattern: /\b[a-zA-Z0-9._%+\-]{1,64}@(?:gmail|yahoo|hotmail|outlook|live|icloud|protonmail|pm)\.[a-z]{2,}\b/gi,
        description: 'Personal email address found', recommendation: 'Avoid sending personal emails in requests',
      },
      {
        category: 'email', type: 'Email', subtype: 'General',
        severity: 'low',
        pattern: /\b[a-zA-Z0-9._%+\-]{2,64}@[a-zA-Z0-9.\-]{2,255}\.[a-zA-Z]{2,10}\b/gi,
        // Exclude obvious false positives: emails that look like file extensions, etc.
        validate: (m) => {
          const [local] = m.split('@');
          return local.length >= 2 && !/^(noreply|no-reply|donotreply|notifications?|mailer-daemon|postmaster|abuse|support|info|hello|contact|admin)$/i.test(local);
        },
        description: 'Email address found in request/response', recommendation: 'Ensure emails are necessary and protected',
      },
      {
        category: 'email', type: 'Email', subtype: 'Disposable',
        severity: 'low',
        pattern: /\b[a-zA-Z0-9._%+\-]+@(?:mailinator|guerrillamail|tempmail|throwam|yopmail|sharklasers|guerrillamailblock)\.[a-z]{2,}\b/gi,
        description: 'Disposable email detected', recommendation: 'Consider blocking disposable email providers',
      },

      // ── PHONE ──────────────────────────────────────────────────────────────
      {
        category: 'phone', type: 'Phone', subtype: 'US',
        severity: 'medium',
        // Must have area code starting with 2-9 (no 0xx, 1xx), proper spacing
        pattern: /(?<!\d)(?:\+1[\s\-.]?)?\(?([2-9][0-9]{2})\)?[\s\-.]?([2-9][0-9]{2})[\s\-.]?([0-9]{4})(?!\d)/g,
        validate: (m) => {
          const digits = m.replace(/\D/g, '');
          if (digits.length < 10 || digits.length > 11) return false;

          // Extract 10-digit portion (skip leading 1 for +1 country code)
          const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
          const areaCode = parseInt(ten.slice(0, 3), 10);
          const exchange  = parseInt(ten.slice(3, 6), 10);

          // NANP rules: area code and exchange cannot start with 0 or 1
          if (Math.floor(areaCode / 100) < 2) return false;
          if (Math.floor(exchange  / 100) < 2) return false;

          // Exclude N11 service codes as area codes (211, 311, 411, 511, 611, 711, 811, 911)
          if (areaCode % 100 === 11) return false;

          // Exclude obviously fake: all same digit (555-555-5555), sequential (123-456-7890)
          if (/^(\d)\1{9}$/.test(ten)) return false;
          if (ten === '1234567890' || ten === '0123456789') return false;

          // 555-0100 to 555-0199 are fictional (Hollywood numbers)
          if (ten.slice(3,6) === '555' && parseInt(ten.slice(6),10) >= 100 && parseInt(ten.slice(6),10) <= 199) return false;

          // Area code 447 does not exist in NANP
          // Rough filter: exclude area codes not in common valid ranges
          // Valid NPA starts 200-999 excluding N11, 0XX, 1XX
          // Extra: exclude area codes known to be unassigned (keep list short — just obvious ones)
          const INVALID_AREA_CODES = new Set([
            311, 411, 511, 611, 711, 811, 911, // N11 service codes
            447, // unassigned
          ]);
          if (INVALID_AREA_CODES.has(areaCode)) return false;

          return true;
        },
        description: 'US phone number found', recommendation: 'Mask phone numbers in logs and requests',
      },
      {
        category: 'phone', type: 'Phone', subtype: 'VN',
        severity: 'medium',
        pattern: /(?<!\d)(?:\+84|0084|0)(?:3[2-9]|5[689]|7[06-9]|8[0-9]|9[0-9])[0-9]{7}(?!\d)/g,
        description: 'Vietnamese phone number found', recommendation: 'Mask phone numbers in transit',
      },

      // ── CREDIT CARD ────────────────────────────────────────────────────────
      {
        category: 'credit-card', type: 'Credit Card', subtype: 'Visa',
        severity: 'critical',
        pattern: /(?<!\d)4[0-9]{12}(?:[0-9]{3})?(?!\d)/g,
        validate: (m) => this.luhnCheck(m),
        description: 'Visa card number detected — PCI DSS violation risk', recommendation: 'CRITICAL: Never transmit raw card numbers. Use tokenization.',
      },
      {
        category: 'credit-card', type: 'Credit Card', subtype: 'MasterCard',
        severity: 'critical',
        pattern: /(?<!\d)(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}(?!\d)/g,
        validate: (m) => this.luhnCheck(m),
        description: 'MasterCard number detected', recommendation: 'CRITICAL: Tokenize card data immediately',
      },
      {
        category: 'credit-card', type: 'Credit Card', subtype: 'AMEX',
        severity: 'critical',
        pattern: /(?<!\d)3[47][0-9]{13}(?!\d)/g,
        validate: (m) => this.luhnCheck(m),
        description: 'American Express card detected', recommendation: 'CRITICAL: Use payment vault',
      },
      {
        category: 'credit-card', type: 'Credit Card', subtype: 'CVV',
        severity: 'critical',
        pattern: /\b(?:cvv2?|cvc2?|security[\s_\-]?code|card[\s_\-]?verification)["']?\s*[:=]\s*["']?(\d{3,4})\b/gi,
        description: 'Card CVV/CVC code detected — severe PCI violation', recommendation: 'CRITICAL: CVV must never be stored or transmitted in plaintext',
      },

      // ── IDENTITY ───────────────────────────────────────────────────────────
      {
        category: 'identity', type: 'Identity', subtype: 'SSN',
        severity: 'critical',
        // Must have dashes — bare digits alone are too risky for false positives
        pattern: /(?<!\d)(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?!\d)/g,
        description: 'US Social Security Number detected', recommendation: 'CRITICAL: SSN must be encrypted at rest and in transit',
      },
      {
        category: 'identity', type: 'Identity', subtype: 'Passport',
        severity: 'high',
        // Require keyword nearby to avoid matching IDs in general
        pattern: /\b[A-Z]{1,2}[0-9]{7,9}\b/g,
        requireKeywords: ['passport', 'travel', 'document', 'visa', 'mrz', 'nationality', 'born'],
        keywordWindow: 500,
        description: 'Potential passport number detected', recommendation: 'Encrypt passport numbers and limit access',
      },
      {
        category: 'identity', type: 'Identity', subtype: 'VN Citizen ID',
        severity: 'high',
        pattern: /(?<!\d)(?:0[1-9]|[1-8][0-9]|9[0-6])[0-9]{10}(?!\d)/g,
        requireKeywords: ['cmnd', 'cccd', 'citizen', 'chứng minh', 'identity', 'id_number', 'id_card', 'national_id'],
        keywordWindow: 400,
        description: 'Vietnamese Citizen ID (CCCD) detected', recommendation: 'Protect according to Vietnamese Personal Data Protection Decree 13/2023',
      },

      // ── AUTHENTICATION — Specific well-known formats (high confidence) ─────
      {
        category: 'authentication', type: 'Token', subtype: 'JWT',
        severity: 'high',
        pattern: /eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g,
        description: 'JWT token found in request', recommendation: 'Ensure JWT is transmitted only over HTTPS, implement short expiry',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Bearer',
        severity: 'high',
        // Only in headers — bearer tokens in response bodies are often example tokens
        pattern: /\bBearer\s+([a-zA-Z0-9\-._~+\/]+=*)/g,
        onlyContexts: ['header', 'cookie', 'request-body'],
        description: 'Bearer token detected', recommendation: 'Verify token scope is minimal; rotate regularly',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'AWS Access Key',
        severity: 'critical',
        // Very specific prefix (AKIA, ASIA, etc.) — high confidence
        pattern: /\b(AKIA|ASIA|AROA|AIDA|ANPA|ANVA|AIPA)[A-Z0-9]{16}\b/g,
        description: 'AWS Access Key ID detected', recommendation: 'CRITICAL: Rotate key immediately, review IAM permissions, check CloudTrail',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'AWS Secret Key',
        severity: 'critical',
        // Require keyword nearby — without context, any 40-char string matches
        pattern: /[A-Za-z0-9\/+=]{40}/g,
        validate: (m) => {
          // Must have mixed case + digits + special chars typical of AWS secrets
          return /[A-Z]/.test(m) && /[a-z]/.test(m) && /[0-9]/.test(m)
            && /[\/+=]/.test(m) && this.calculateEntropy(m) > 5.0;
        },
        requireKeywords: [
          'aws_secret', 'secretaccesskey', 'aws_session_token',
          'secret_access_key', 'SecretAccessKey', 'AWS_SECRET',
        ],
        keywordWindow: 400,
        onlyContexts: ['header', 'request-body', 'response-body'],
        description: 'Potential AWS Secret Access Key', recommendation: 'CRITICAL: Rotate AWS credentials immediately',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'GitHub Token',
        severity: 'critical',
        // Very specific prefix — high confidence
        pattern: /\b(ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,255}\b/g,
        description: 'GitHub Personal Access Token detected', recommendation: 'CRITICAL: Revoke token immediately at github.com/settings/tokens',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'OpenAI Key',
        severity: 'critical',
        pattern: /\bsk-(?:proj-)?[A-Za-z0-9\-_]{20,}(?:T3BlbkFJ[A-Za-z0-9]{20,})?\b/g,
        description: 'OpenAI API key detected', recommendation: 'CRITICAL: Revoke at platform.openai.com, rotate immediately',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Stripe Secret',
        severity: 'critical',
        pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{24,}\b/g,
        description: 'Stripe secret key detected', recommendation: 'CRITICAL: Rotate at dashboard.stripe.com immediately',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Stripe Publishable',
        severity: 'medium',
        pattern: /\bpk_(?:live|test)_[A-Za-z0-9]{24,}\b/g,
        description: 'Stripe publishable key found', recommendation: 'Publishable keys are public but confirm only used for client-side',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Slack Token',
        severity: 'critical',
        pattern: /\bxox[baopr]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24}\b/g,
        description: 'Slack API token detected', recommendation: 'CRITICAL: Revoke at api.slack.com/apps',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Discord Token',
        severity: 'critical',
        pattern: /\b[MNO][a-zA-Z0-9_\-]{23}\.[a-zA-Z0-9_\-]{6}\.[a-zA-Z0-9_\-]{27,38}\b/g,
        description: 'Discord bot token detected', recommendation: 'CRITICAL: Regenerate token in Discord Developer Portal',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Groq API Key',
        severity: 'critical',
        pattern: /\bgsk_[A-Za-z0-9_]{48,}\b/g,
        description: 'Groq API key detected', recommendation: 'CRITICAL: Revoke at console.groq.com',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Anthropic Key',
        severity: 'critical',
        pattern: /\bsk-ant-(?:api03-)?[A-Za-z0-9\-_]{40,}\b/g,
        description: 'Anthropic API key detected', recommendation: 'CRITICAL: Revoke at console.anthropic.com',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Private Key PEM',
        severity: 'critical',
        pattern: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
        description: 'Private key in PEM format detected', recommendation: 'CRITICAL: Private keys must never be transmitted. Rotate all certificates.',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'Generic API Key',
        severity: 'medium',
        // Must have the keyword right next to it
        pattern: /\b(?:api[_\-.]?key|apikey|api_secret|api_token|x-api-key)\s*["']?\s*[:=]\s*["']?([a-zA-Z0-9\-_]{20,64})["']?/gi,
        description: 'Generic API key pattern detected', recommendation: 'Review and rotate if sensitive',
      },
      {
        category: 'authentication', type: 'Token', subtype: 'OAuth Token',
        severity: 'high',
        pattern: /\b(?:access_token|refresh_token|oauth_token)\s*["']?\s*[:=]\s*["']?([a-zA-Z0-9\-_.~+\/]{20,})/gi,
        onlyContexts: ['request-body', 'response-body', 'query', 'form-data'],
        description: 'OAuth token detected', recommendation: 'Ensure tokens use HTTPS-only transmission with short TTL',
      },

      // ── CRYPTO ─────────────────────────────────────────────────────────────
      {
        category: 'crypto', type: 'Crypto', subtype: 'Bitcoin Address',
        severity: 'high',
        pattern: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b|\bbc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{39,59}\b/g,
        requireKeywords: ['bitcoin', 'btc', 'wallet', 'crypto', 'satoshi', 'payment', 'address', 'receive'],
        keywordWindow: 600,
        description: 'Bitcoin address detected', recommendation: 'Ensure cryptocurrency addresses are intentionally shared',
      },
      {
        category: 'crypto', type: 'Crypto', subtype: 'Ethereum Address',
        severity: 'high',
        pattern: /\b0x[a-fA-F0-9]{40}\b/g,
        requireKeywords: ['ethereum', 'eth', 'wallet', 'web3', 'contract', 'token', 'defi', 'nft', 'address'],
        keywordWindow: 600,
        description: 'Ethereum wallet address detected', recommendation: 'Review context — wallet addresses in requests may indicate payment flow',
      },
      {
        category: 'crypto', type: 'Crypto', subtype: 'Private Key (Hex)',
        severity: 'critical',
        pattern: /\b[a-fA-F0-9]{64}\b/g,
        validate: (m) => {
          // Reject if all lowercase (likely SHA256 hash output)
          if (m === m.toLowerCase()) return false;
          // Must have high entropy
          return this.calculateEntropy(m) > 4.8;
        },
        requireKeywords: [
          'private_key', 'privatekey', 'privkey', 'secret_key', 'secretkey',
          'wallet', 'signing_key', 'mnemonic', 'seed',
        ],
        keywordWindow: 400,
        description: 'Potential 256-bit private key (high entropy hex)', recommendation: 'CRITICAL: If this is a private key, rotate all associated accounts immediately',
      },
      {
        category: 'crypto', type: 'Crypto', subtype: 'Mnemonic Phrase',
        severity: 'critical',
        pattern: /\b(?:abandon|ability|able|about|above|absent|absorb|abstract|absurd|abuse|access|accident)(?:\s+[a-z]+){11,23}\b/g,
        description: 'Potential BIP39 mnemonic seed phrase', recommendation: 'CRITICAL: Seed phrases give full wallet access. Treat as private key.',
      },

      // ── CLOUD ──────────────────────────────────────────────────────────────
      {
        category: 'cloud', type: 'Cloud', subtype: 'S3 Bucket URL',
        severity: 'medium',
        pattern: /https?:\/\/[a-zA-Z0-9\-]+\.s3(?:\.[a-z0-9\-]+)?\.amazonaws\.com/gi,
        description: 'AWS S3 bucket URL detected', recommendation: 'Verify bucket is not publicly accessible',
      },
      {
        category: 'cloud', type: 'Cloud', subtype: 'Azure Storage',
        severity: 'medium',
        pattern: /https?:\/\/[a-z0-9]+\.blob\.core\.windows\.net/gi,
        description: 'Azure Blob Storage URL detected', recommendation: 'Verify SAS token is not exposed in URL',
      },
      {
        category: 'cloud', type: 'Cloud', subtype: 'Firebase URL',
        severity: 'medium',
        pattern: /https?:\/\/[a-zA-Z0-9\-]+-default-rtdb\.(?:firebaseio\.com|asia-southeast1\.firebasedatabase\.app)/gi,
        description: 'Firebase Realtime Database URL found', recommendation: 'Ensure Firebase security rules are properly configured',
      },
      {
        category: 'cloud', type: 'Cloud', subtype: 'Cloudflare Token',
        severity: 'critical',
        pattern: /[a-zA-Z0-9_\-]{40}/g,
        validate: (m, fullText, matchIndex) => {
          // Must have good entropy
          const entropy = this.calculateEntropy(m);
          if (entropy < 4.8) return false;
          // Not all-lowercase (SHA hash) or all-uppercase
          if (m === m.toLowerCase() || m === m.toUpperCase()) return false;
          // Must have upper + lower + digits
          if (!/[A-Z]/.test(m) || !/[a-z]/.test(m) || !/[0-9]/.test(m)) return false;

          // ── Denylist: known non-Cloudflare headers that match the pattern ──
          const KNOWN_FALSE_POSITIVE_HEADERS = [
            'x-amz-cf-id',        // AWS CloudFront request ID
            'x-amz-request-id',   // AWS request ID
            'x-amz-id-2',         // AWS extended request ID
            'x-b3-traceid',       // Zipkin trace ID
            'x-request-id',       // Generic request ID
            'x-correlation-id',   // Correlation ID
            'x-trace-id',         // Trace ID
            'cf-ray',             // Cloudflare Ray ID (not an API token)
            'x-vercel-id',        // Vercel deployment ID
            'x-github-delivery',  // GitHub webhook delivery ID
            'etag',               // HTTP ETag
          ];
          const lowerText = fullText.slice(
            Math.max(0, matchIndex - 60), matchIndex
          ).toLowerCase();
          if (KNOWN_FALSE_POSITIVE_HEADERS.some(h => lowerText.includes(h))) return false;

          return true;
        },
        // 'cf-' removed — too broad (matches x-amz-cf-id, cf-ray, etc.)
        requireKeywords: [
          'cloudflare', 'cloudflare-api', 'cloudflare_api',
          'x-auth-user-service-key', 'x-auth-key',
          'cf_token', 'cf_api_key', 'cftoken',
        ],
        keywordWindow: 500,
        onlyContexts: ['header', 'cookie', 'request-body'],
        description: 'Potential Cloudflare API token (high entropy)', recommendation: 'Rotate Cloudflare token if confirmed',
      },
      {
        category: 'cloud', type: 'Cloud', subtype: 'GCP Service Account',
        severity: 'critical',
        pattern: /"type"\s*:\s*"service_account"/g,
        description: 'GCP service account JSON key detected', recommendation: 'CRITICAL: Rotate service account key in Google Cloud Console',
      },
      {
        category: 'cloud', type: 'Cloud', subtype: 'Twilio Key',
        severity: 'critical',
        pattern: /\bSK[a-f0-9]{32}\b/g,
        description: 'Twilio API key detected', recommendation: 'CRITICAL: Revoke at twilio.com/console',
      },
      {
        category: 'cloud', type: 'Cloud', subtype: 'SendGrid Key',
        severity: 'critical',
        pattern: /\bSG\.[a-zA-Z0-9_\-]{22,}\.[a-zA-Z0-9_\-]{22,}\b/g,
        description: 'SendGrid API key detected', recommendation: 'CRITICAL: Revoke at app.sendgrid.com',
      },

      // ── DATABASE ───────────────────────────────────────────────────────────
      {
        category: 'database', type: 'Database URI', subtype: 'MongoDB',
        severity: 'critical',
        pattern: /mongodb(?:\+srv)?:\/\/(?:[^:@\s]+:[^@\s]+@)?[a-zA-Z0-9\-_.]+(?::\d+)?(?:\/[a-zA-Z0-9\-_]+)?(?:\?[^\s"'`])?/gi,
        validate: (m) => m.includes('@') || m.includes('localhost') || m.includes('127.0.0.1'),
        description: 'MongoDB connection string with credentials detected', recommendation: 'CRITICAL: Rotate database credentials immediately',
      },
      {
        category: 'database', type: 'Database URI', subtype: 'PostgreSQL',
        severity: 'critical',
        pattern: /postgres(?:ql)?:\/\/[^:@\s]+:[^@\s]+@[a-zA-Z0-9\-_.]+(?::\d+)?\/[a-zA-Z0-9\-_]+/gi,
        description: 'PostgreSQL connection string with password detected', recommendation: 'CRITICAL: Rotate database password immediately',
      },
      {
        category: 'database', type: 'Database URI', subtype: 'Redis',
        severity: 'critical',
        pattern: /redis(?:s)?:\/\/[^:@\s]+:[^@\s]+@[a-zA-Z0-9\-_.]+(?::\d+)?/gi,
        description: 'Redis connection string with password detected', recommendation: 'CRITICAL: Rotate Redis password immediately',
      },
      {
        category: 'database', type: 'Database URI', subtype: 'MySQL',
        severity: 'critical',
        pattern: /mysql:\/\/[^:@\s]+:[^@\s]+@[a-zA-Z0-9\-_.]+(?::\d+)?\/[a-zA-Z0-9\-_]+/gi,
        description: 'MySQL connection string with credentials detected', recommendation: 'CRITICAL: Rotate database credentials',
      },
    ];
  }

  private luhnCheck(cardNum: string): boolean {
    const digits = cardNum.replace(/\D/g, '');
    let sum = 0, isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);
      if (isEven) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  }

  calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    for (const c of str) freq[c] = (freq[c] || 0) + 1;
    const len = str.length;
    return -Object.values(freq).reduce((s, f) => {
      const p = f / len;
      return s + p * Math.log2(p);
    }, 0);
  }

  private maskValue(value: string, type: string): string {
    if (value.length <= 8) return '***';
    if (type === 'Email') {
      const [local, domain] = value.split('@');
      return `${local.slice(0, 2)}***@${domain}`;
    }
    if (type === 'Credit Card') return `****-****-****-${value.replace(/\D/g, '').slice(-4)}`;
    if (type === 'Phone') return `${value.slice(0, 3)}****${value.slice(-2)}`;
    return `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`;
  }

  async scanHar(harData: any): Promise<PiiScanResult> {
    const matches: PiiMatch[] = [];
    const seen = new Map<string, number>();
    let bytesScanned = 0;
    const entries = harData.entries || harData.log?.entries || [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const url = entry.rawEntry?.request?.url || entry.url || '';

      // Detect response MIME type for binary filtering
      const resMime = entry.rawEntry?.response?.content?.mimeType || '';
      const resBodyRaw = entry.rawEntry?.response?.content?.text || '';

      const targets: { text: string; context: PiiContext; location: string }[] = [];

      // ── URL + query params ───────────────────────────────────────────────
      targets.push({ text: url, context: 'url', location: 'URL' });

      // ── Request headers ──────────────────────────────────────────────────
      for (const h of (entry.rawEntry?.request?.headers || [])) {
        // Skip non-sensitive headers (Accept, Content-Type, etc.)
        const name = (h.name || '').toLowerCase();
        if (/^(accept|content-type|content-length|cache-control|connection|host|origin|referer|pragma|date|transfer-encoding|sec-fetch|dnt|te)$/.test(name)) continue;
        targets.push({ text: `${h.name}: ${h.value}`, context: 'header', location: `Request Header: ${h.name}` });
      }

      // ── Response headers ─────────────────────────────────────────────────
      for (const h of (entry.rawEntry?.response?.headers || [])) {
        const name = (h.name || '').toLowerCase();
        if (/^(content-type|content-length|cache-control|connection|date|transfer-encoding|vary|access-control|x-frame|x-content|strict-transport|x-xss|etag|last-modified|age|server|x-powered-by)$/.test(name)) continue;
        targets.push({ text: `${h.name}: ${h.value}`, context: 'header', location: `Response Header: ${h.name}` });
      }

      // ── Cookies ──────────────────────────────────────────────────────────
      for (const c of (entry.rawEntry?.request?.cookies || [])) {
        targets.push({ text: `${c.name}=${c.value}`, context: 'cookie', location: `Cookie: ${c.name}` });
      }
      for (const c of (entry.rawEntry?.response?.cookies || [])) {
        targets.push({ text: `${c.name}=${c.value}`, context: 'cookie', location: `Set-Cookie: ${c.name}` });
      }

      // ── Request body ─────────────────────────────────────────────────────
      const reqBody = entry.rawEntry?.request?.postData?.text || '';
      if (reqBody) targets.push({ text: reqBody.slice(0, 100_000), context: 'request-body', location: 'Request Body' });

      // ── Response body — skip binary/image/encoded content ────────────────
      if (resBodyRaw && !isBinaryMime(resMime) && !looksLikeBinaryBase64(resBodyRaw)) {
        // Also skip if it's a JS/CSS bundle — too many false positives from minified code
        const isBundle = (resMime.includes('javascript') || resMime.includes('css'))
          && resBodyRaw.length > 50_000;
        if (!isBundle) {
          targets.push({ text: resBodyRaw.slice(0, 100_000), context: 'response-body', location: 'Response Body' });
        }
      }

      // ── Run rules ────────────────────────────────────────────────────────
      for (const { text, context, location } of targets) {
        bytesScanned += text.length;

        for (const rule of this.rules) {
          // Context filter
          if (rule.onlyContexts && !rule.onlyContexts.includes(context)) continue;

          rule.pattern.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = rule.pattern.exec(text)) !== null) {
            const rawVal = m[0];
            if (!rawVal || rawVal.length < 4) continue;

            // Validate function
            if (rule.validate && !rule.validate(rawVal, text, m.index)) continue;

            // Keyword context requirement
            if (rule.requireKeywords?.length) {
              if (!hasKeywordNear(text, m.index, rule.requireKeywords, rule.keywordWindow || 300)) continue;
            }

            // Dedup
            const dedupKey = `${rule.type}:${rule.subtype}:${rawVal}`;
            if (seen.has(dedupKey)) {
              matches[seen.get(dedupKey)!].occurrences++;
              continue;
            }

            const match: PiiMatch = {
              id: `pii-${matches.length}-${Date.now()}`,
              category: rule.category,
              type: rule.type,
              subtype: rule.subtype,
              severity: rule.severity,
              value: rawVal,
              maskedValue: this.maskValue(rawVal, rule.type),
              entropy: parseFloat(this.calculateEntropy(rawVal).toFixed(2)),
              length: rawVal.length,
              context,
              location,
              entryIndex: i,
              entryUrl: url.slice(0, 200),
              occurrences: 1,
              description: rule.description,
              recommendation: rule.recommendation,
              regex: rule.pattern.source,
            };

            seen.set(dedupKey, matches.length);
            matches.push(match);
          }
        }
      }
    }

    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const byCategory: Record<string, number> = {};
    for (const m of matches) {
      bySeverity[m.severity]++;
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    }

    matches.sort((a, b) => {
      const sev = ['critical', 'high', 'medium', 'low', 'info'];
      const sDiff = sev.indexOf(a.severity) - sev.indexOf(b.severity);
      return sDiff !== 0 ? sDiff : b.occurrences - a.occurrences;
    });

    return {
      totalMatches: matches.length,
      ...bySeverity,
      byCategory,
      matches,
      scannedAt: new Date().toISOString(),
      entriesScanned: entries.length,
      bytesScanned,
    };
  }
}
