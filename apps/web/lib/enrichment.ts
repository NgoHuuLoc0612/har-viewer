import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { UAParser } from 'ua-parser-js';
import { parse as parseTld } from 'tldts';
import mime from 'mime-types';
import { getReasonPhrase } from 'http-status-codes';
import * as ipaddr from 'ipaddr.js';

dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

// ─── dayjs Date Utilities ─────────────────────────────────────────────────

export const day = dayjs;

export function formatDate(date: string | Date | number, format = 'MMM DD, YYYY HH:mm:ss'): string {
  if (!date) return '—';
  return dayjs(date).format(format);
}

export function formatDateShort(date: string | Date | number): string {
  return dayjs(date).format('MMM DD HH:mm');
}

export function formatDateISO(date: string | Date | number): string {
  return dayjs(date).toISOString();
}

export function formatRelative(date: string | Date | number): string {
  return dayjs(date).fromNow();
}

export function formatDurationDayjs(ms: number): string {
  if (!ms || ms <= 0) return '0 ms';
  if (ms < 1) return `${(ms * 1000).toFixed(0)} μs`;
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  return dayjs.duration(ms).format('m[m] s[s]');
}

export function certExpiryLabel(isoDate: string): { label: string; color: string; daysLeft: number } {
  const now = dayjs();
  const expiry = dayjs(isoDate);
  const daysLeft = expiry.diff(now, 'day');

  if (daysLeft < 0)   return { label: `Expired ${Math.abs(daysLeft)}d ago`, color: '#ef4444', daysLeft };
  if (daysLeft <= 7)  return { label: `Expires in ${daysLeft}d ⚠️`, color: '#ef4444', daysLeft };
  if (daysLeft <= 30) return { label: `Expires in ${daysLeft}d`, color: '#f59e0b', daysLeft };
  if (daysLeft <= 90) return { label: `${daysLeft}d remaining`, color: '#f97316', daysLeft };
  return { label: `${daysLeft}d remaining`, color: '#10b981', daysLeft };
}

export function timeAgo(iso: string): string {
  return dayjs(iso).fromNow();
}

// ─── User-Agent Parsing ───────────────────────────────────────────────────

export interface ParsedUA {
  browser: { name: string; version: string; major: string };
  engine:  { name: string; version: string };
  os:      { name: string; version: string };
  device:  { vendor: string; model: string; type: string };
  cpu:     { architecture: string };
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isBot: boolean;
  emoji: string;
  summary: string;
}

export function parseUA(uaString: string): ParsedUA {
  if (!uaString) return emptyUA();
  const p = new UAParser(uaString);
  const r = p.getResult();
  const deviceType = r.device?.type || '';
  const isMobile  = deviceType === 'mobile';
  const isTablet  = deviceType === 'tablet';
  const isDesktop = !deviceType || deviceType === 'desktop';
  const isBot = /bot|crawl|spider|slurp|bingbot|googlebot/i.test(uaString);

  const emoji = isBot ? '🤖' : isMobile ? '📱' : isTablet ? '📟' : '🖥️';
  const summary = [r.browser?.name, r.browser?.major ? `v${r.browser.major}` : '', '·',
    r.os?.name, r.os?.version].filter(Boolean).join(' ');

  return {
    browser: { name: r.browser?.name || '', version: r.browser?.version || '', major: r.browser?.major || '' },
    engine:  { name: r.engine?.name  || '', version: r.engine?.version  || '' },
    os:      { name: r.os?.name      || '', version: r.os?.version      || '' },
    device:  { vendor: r.device?.vendor || '', model: r.device?.model || '', type: deviceType },
    cpu:     { architecture: r.cpu?.architecture || '' },
    isMobile, isTablet, isDesktop, isBot, emoji, summary,
  };
}

function emptyUA(): ParsedUA {
  return { browser: { name: '', version: '', major: '' }, engine: { name: '', version: '' },
    os: { name: '', version: '' }, device: { vendor: '', model: '', type: '' },
    cpu: { architecture: '' }, isMobile: false, isTablet: false, isDesktop: true,
    isBot: false, emoji: '🖥️', summary: 'Unknown' };
}

// ─── Domain / TLD Parsing ─────────────────────────────────────────────────

export interface DomainInfo {
  hostname:   string;
  domain:     string;
  subdomain:  string;
  tld:        string;
  isIp:       boolean;
  isPrivate:  boolean;
  domainBase: string;  // e.g. "google" from "www.google.com"
  badge:      string;  // emoji badge for domain type
}

export function parseDomainFrontend(hostname: string): DomainInfo {
  if (!hostname) return emptyDomain('');
  try {
    const r = parseTld(hostname, { allowPrivateDomains: true });
    const badge = r.isIp ? '🔢' : r.isPrivate ? '🔒' : '🌐';
    return {
      hostname,
      domain:     r.domain             || hostname,
      subdomain:  r.subdomain           || '',
      tld:        r.publicSuffix        || '',
      isIp:       r.isIp               || false,
      isPrivate:  r.isPrivate           || false,
      domainBase: r.domainWithoutSuffix || '',
      badge,
    };
  } catch { return emptyDomain(hostname); }
}

function emptyDomain(hostname: string): DomainInfo {
  return { hostname, domain: hostname, subdomain: '', tld: '', isIp: false, isPrivate: false, domainBase: hostname, badge: '🌐' };
}

// ─── MIME Type Utilities ──────────────────────────────────────────────────

export interface MimeInfo {
  type:        string;
  category:    string;
  subtype:     string;
  extension:   string;
  isText:      boolean;
  isImage:     boolean;
  isVideo:     boolean;
  isAudio:     boolean;
  isFont:      boolean;
  isJson:      boolean;
  isXml:       boolean;
  isHtml:      boolean;
  isScript:    boolean;
  isStyle:     boolean;
  isWasm:      boolean;
  isBinary:    boolean;
  isCompressible: boolean;
  emoji:       string;
  label:       string;
  color:       string;
}

const MIME_COLORS: Record<string, string> = {
  text:        '#06b6d4',
  image:       '#ec4899',
  video:       '#ef4444',
  audio:       '#f97316',
  font:        '#8b5cf6',
  application: '#3b82f6',
};

const MIME_EMOJIS: Record<string, string> = {
  'text/html': '📄', 'text/css': '🎨', 'application/javascript': '⚡',
  'application/json': '{ }', 'image/svg+xml': '🎭', 'image/': '🖼️',
  'video/': '🎬', 'audio/': '🎵', 'font/': '🔤', 'application/wasm': '⚙️',
  'application/pdf': '📕',
};

export function parseMimeFrontend(mimeRaw: string): MimeInfo {
  if (!mimeRaw) return emptyMime();
  const type     = mimeRaw.split(';')[0].trim().toLowerCase();
  const [category = '', subtype = ''] = type.split('/');
  const ext      = (mime.extension(type) as string | false) || '';
  const isText   = category === 'text';
  const isImage  = category === 'image';
  const isVideo  = category === 'video';
  const isAudio  = category === 'audio';
  const isFont   = category === 'font' || type.includes('font');
  const isJson   = type.includes('json');
  const isXml    = type.includes('xml');
  const isHtml   = type === 'text/html' || type === 'application/xhtml+xml';
  const isScript = type.includes('javascript') || type.includes('ecmascript');
  const isStyle  = type === 'text/css';
  const isWasm   = type === 'application/wasm';
  const isCompressible = [
    'text/', 'application/json', 'application/javascript', 'application/ecmascript',
    'application/xml', 'image/svg', 'application/yaml', 'application/x-yaml',
    'application/atom+xml', 'application/rss+xml', 'application/xhtml+xml',
    'application/ld+json', 'application/graphql',
  ].some(t => type.startsWith(t));
  const isBinary = !isText && !isJson && !isXml && !isHtml && !isScript && !isStyle && !isWasm;

  const emoji = Object.entries(MIME_EMOJIS).find(([k]) => type.startsWith(k) || type === k)?.[1]
    || (isImage ? '🖼️' : isVideo ? '🎬' : isAudio ? '🎵' : isFont ? '🔤' : '📦');

  const LABELS: Record<string, string> = {
    'text/html': 'HTML', 'text/css': 'CSS', 'application/javascript': 'JavaScript',
    'application/json': 'JSON', 'text/xml': 'XML', 'application/xml': 'XML',
    'image/svg+xml': 'SVG', 'application/wasm': 'WebAssembly',
    'application/octet-stream': 'Binary', 'application/pdf': 'PDF',
  };

  return {
    type, category, subtype, extension: ext,
    isText, isImage, isVideo, isAudio, isFont, isJson, isXml,
    isHtml, isScript, isStyle, isWasm, isBinary, isCompressible,
    emoji, label: LABELS[type] || (ext ? ext.toUpperCase() : type),
    color: MIME_COLORS[category] || '#64748b',
  };
}

function emptyMime(): MimeInfo {
  return { type: '', category: '', subtype: '', extension: '', isText: false, isImage: false,
    isVideo: false, isAudio: false, isFont: false, isJson: false, isXml: false, isHtml: false,
    isScript: false, isStyle: false, isWasm: false, isBinary: false, isCompressible: false,
    emoji: '📦', label: 'Unknown', color: '#64748b' };
}

// ─── HTTP Status Codes ────────────────────────────────────────────────────

export interface StatusInfo {
  code:        number;
  reason:      string;
  category:    '1xx' | '2xx' | '3xx' | '4xx' | '5xx' | 'unknown';
  label:       string;
  description: string;
  color:       string;
  emoji:       string;
  isSuccess:   boolean;
  isRedirect:  boolean;
  isClientError: boolean;
  isServerError: boolean;
  isCacheable: boolean;
}

const STATUS_DESC: Record<number, string> = {
  // 1xx Informational
  100: 'Continue — server received request headers; client should proceed to send body.',
  101: 'Switching Protocols — server is switching to the protocol specified in the Upgrade header.',
  102: 'Processing — server has received and is processing the request, no response available yet.',
  103: 'Early Hints — return some response headers before final HTTP message.',
  // 2xx Successful
  200: 'OK — request succeeded. Response depends on the HTTP method used.',
  201: 'Created — request fulfilled and a new resource has been created.',
  202: 'Accepted — request received but not yet acted upon; non-committal.',
  203: 'Non-Authoritative Information — returned metadata from a local or third-party copy, not the origin server.',
  204: 'No Content — request succeeded; no content to send in response body.',
  205: 'Reset Content — request succeeded; client should reset the document view.',
  206: 'Partial Content — server is delivering only part of the resource (range request).',
  207: 'Multi-Status — response body contains multiple status codes for multiple operations.',
  208: 'Already Reported — DAV binding members already enumerated in a preceding part of this response.',
  226: 'IM Used — server fulfilled GET and response is a representation of result of instance-manipulations.',
  // 3xx Redirection
  300: 'Multiple Choices — request has more than one possible response; user should choose one.',
  301: 'Moved Permanently — resource permanently moved to a new URL given by the Location header.',
  302: 'Found — resource temporarily under a different URL (previously "Moved Temporarily").',
  303: 'See Other — redirect the client to another URL using a GET request.',
  304: 'Not Modified — resource not modified since last request; use the cached version.',
  305: 'Use Proxy — requested resource must be accessed through the proxy in the Location header.',
  306: 'Switch Proxy — subsequent requests should use the specified proxy (no longer used).',
  307: 'Temporary Redirect — resource temporarily at a different URL; method must not change.',
  308: 'Permanent Redirect — resource permanently at a new URL; method and body must not change.',
  // 4xx Client Error
  400: 'Bad Request — server cannot process due to client error (malformed syntax, invalid parameters).',
  401: 'Unauthorized — authentication is required and has failed or has not been provided.',
  402: 'Payment Required — reserved for future use; some APIs use it for quota exhaustion.',
  403: 'Forbidden — server understood the request but refuses to authorize it.',
  404: 'Not Found — resource could not be found on the server.',
  405: 'Method Not Allowed — request method is not allowed for the requested resource.',
  406: 'Not Acceptable — server cannot produce a response matching the list of acceptable values.',
  407: 'Proxy Authentication Required — client must authenticate itself with the proxy.',
  408: 'Request Timeout — server timed out waiting for the request.',
  409: 'Conflict — request could not be completed due to a conflict with the current resource state.',
  410: 'Gone — resource is no longer available and will not be available again.',
  411: 'Length Required — server rejected request because Content-Length header field is not defined.',
  412: 'Precondition Failed — client has indicated preconditions that the server does not meet.',
  413: 'Payload Too Large — request entity is larger than limits defined by the server.',
  414: 'URI Too Long — URI requested by the client is longer than the server is willing to interpret.',
  415: 'Unsupported Media Type — media format of the requested data is not supported by the server.',
  416: 'Range Not Satisfiable — range specified in the Range header field cannot be fulfilled.',
  417: 'Expectation Failed — expectation in the Expect request-header field could not be met.',
  418: "I'm a Teapot — server refuses to brew coffee; this is a reference to Hyper Text Coffee Pot Control Protocol.",
  421: 'Misdirected Request — request was directed at a server that is not able to produce a response.',
  422: 'Unprocessable Entity — request was well-formed but unable to be followed due to semantic errors.',
  423: 'Locked — resource being accessed is locked.',
  424: 'Failed Dependency — request failed because a previous request failed.',
  425: 'Too Early — server is unwilling to risk processing a request that might be replayed.',
  426: 'Upgrade Required — server refuses to perform request using the current protocol.',
  428: 'Precondition Required — origin server requires the request to be conditional.',
  429: 'Too Many Requests — user has sent too many requests in a given amount of time (rate limiting).',
  431: 'Request Header Fields Too Large — server is unwilling to process the request because headers are too large.',
  451: 'Unavailable For Legal Reasons — resource cannot be provided for legal reasons (e.g. government censorship).',
  // 5xx Server Error
  500: 'Internal Server Error — server encountered an unexpected condition preventing it from fulfilling the request.',
  501: 'Not Implemented — server does not support the functionality required to fulfill the request.',
  502: 'Bad Gateway — server acting as gateway received an invalid response from an upstream server.',
  503: 'Service Unavailable — server is currently unable to handle the request (overloaded or down for maintenance).',
  504: 'Gateway Timeout — server acting as gateway did not receive a timely response from an upstream server.',
  505: 'HTTP Version Not Supported — HTTP protocol version used in the request is not supported by the server.',
  506: 'Variant Also Negotiates — server has an internal configuration error with content negotiation.',
  507: 'Insufficient Storage — server is unable to store the representation needed to complete the request.',
  508: 'Loop Detected — server detected an infinite loop while processing a request.',
  510: 'Not Extended — further extensions to the request are required for the server to fulfill it.',
  511: 'Network Authentication Required — client needs to authenticate to gain network access.',
};

const STATUS_COLORS: Record<string, string> = {
  '1xx': '#94a3b8', '2xx': '#10b981', '3xx': '#f59e0b', '4xx': '#ef4444', '5xx': '#dc2626',
};
const STATUS_EMOJIS: Record<string, string> = {
  '1xx': 'ℹ️', '2xx': '✅', '3xx': '↩️', '4xx': '⚠️', '5xx': '🔥',
};
const CACHEABLE = new Set([200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501]);

export function getHttpStatus(code: number): StatusInfo {
  let reason = '';
  try { reason = getReasonPhrase(code); } catch { reason = code === 0 ? 'Cancelled' : 'Unknown'; }
  const cat = code === 0 ? 'unknown' as const
    : code < 200 ? '1xx' as const : code < 300 ? '2xx' as const
    : code < 400 ? '3xx' as const : code < 500 ? '4xx' as const : '5xx' as const;

  return {
    code, reason, category: cat,
    label: code === 0 ? 'Cancelled' : `${code} ${reason}`,
    description: STATUS_DESC[code] || reason,
    color: STATUS_COLORS[cat] || '#94a3b8',
    emoji: STATUS_EMOJIS[cat] || '❓',
    isSuccess:     code >= 200 && code < 300,
    isRedirect:    code >= 300 && code < 400,
    isClientError: code >= 400 && code < 500,
    isServerError: code >= 500,
    isCacheable:   CACHEABLE.has(code),
  };
}

// ─── IP Address Analysis ──────────────────────────────────────────────────

export interface IpInfo {
  raw:       string;
  version:   4 | 6 | null;
  kind:      string;
  isPrivate: boolean;
  isLoopback: boolean;
  isPublic:  boolean;
  isIPv4:    boolean;
  isIPv6:    boolean;
  normalized: string;
  reverseDns: string;
  badge:     string;
  tooltip:   string;
}

export function analyzeIpFrontend(raw: string): IpInfo {
  const empty: IpInfo = { raw, version: null, kind: 'unknown', isPrivate: false,
    isLoopback: false, isPublic: false, isIPv4: false, isIPv6: false,
    normalized: raw, reverseDns: '', badge: '🌐', tooltip: raw };
  if (!raw) return empty;

  const host = raw.includes(']:') ? raw.slice(1, raw.indexOf(']:'))  // [::1]:80
    : raw.startsWith('[') ? raw.slice(1, -1)
    : raw.includes(':') && raw.split(':').length === 2 ? raw.split(':')[0]
    : raw;

  try {
    const parsed = ipaddr.parse(host);
    const isIPv4 = parsed.kind() === 'ipv4';
    const isIPv6 = parsed.kind() === 'ipv6';
    const range  = parsed.range();
    const norm   = parsed.toString();

    let kind = 'public', badge = '🌐', tooltip = `Public IP (${norm})`;
    if (range === 'loopback')  { kind = 'loopback';   badge = '🔄'; tooltip = `Loopback (${norm})`; }
    else if (range === 'private')  { kind = 'private';   badge = '🔒'; tooltip = `Private network (${norm})`; }
    else if (range === 'multicast') { kind = 'multicast'; badge = '📡'; tooltip = `Multicast (${norm})`; }
    else if (range === 'linkLocal') { kind = 'link-local'; badge = '🔗'; tooltip = `Link-local (${norm})`; }

    let reverseDns = '';
    if (isIPv4) reverseDns = norm.split('.').reverse().join('.') + '.in-addr.arpa';
    if (isIPv6) reverseDns = norm.replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa';

    return {
      raw, version: isIPv4 ? 4 : isIPv6 ? 6 : null,
      kind, isPrivate: kind === 'private' || kind === 'loopback',
      isLoopback: kind === 'loopback', isPublic: kind === 'public',
      isIPv4, isIPv6, normalized: norm, reverseDns, badge, tooltip,
    };
  } catch { return empty; }
}
