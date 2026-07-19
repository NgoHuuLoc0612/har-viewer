import * as UAParser from 'ua-parser-js';
import { parse as parseTld } from 'tldts';
import * as mime from 'mime-types';
import { StatusCodes, getReasonPhrase, getStatusCode } from 'http-status-codes';
import * as ipaddr from 'ipaddr.js';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gunzip  = promisify(zlib.gunzip);
const inflate  = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

// ─── User-Agent Parsing ────────────────────────────────────────────────────

export interface ParsedUA {
  browser: { name: string; version: string; major: string };
  engine:  { name: string; version: string };
  os:      { name: string; version: string };
  device:  { vendor: string; model: string; type: string };
  cpu:     { architecture: string };
  isBot:   boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  raw: string;
}

export function parseUserAgent(ua: string): ParsedUA {
  if (!ua) return emptyUA(ua);
  const p = new (UAParser as any).UAParser(ua);
  const r = p.getResult();
  const deviceType = r.device?.type || '';
  return {
    browser: {
      name:    r.browser?.name    || 'Unknown',
      version: r.browser?.version || '',
      major:   r.browser?.major   || '',
    },
    engine: {
      name:    r.engine?.name    || '',
      version: r.engine?.version || '',
    },
    os: {
      name:    r.os?.name    || '',
      version: r.os?.version || '',
    },
    device: {
      vendor: r.device?.vendor || '',
      model:  r.device?.model  || '',
      type:   deviceType,
    },
    cpu: { architecture: r.cpu?.architecture || '' },
    isBot:     /bot|crawler|spider|slurp|bingbot|googlebot|duckduck/i.test(ua),
    isMobile:  deviceType === 'mobile',
    isTablet:  deviceType === 'tablet',
    isDesktop: !deviceType || deviceType === 'desktop',
    raw: ua,
  };
}

function emptyUA(raw: string): ParsedUA {
  return {
    browser: { name: '', version: '', major: '' },
    engine:  { name: '', version: '' },
    os:      { name: '', version: '' },
    device:  { vendor: '', model: '', type: '' },
    cpu:     { architecture: '' },
    isBot: false, isMobile: false, isTablet: false, isDesktop: true,
    raw,
  };
}

// ─── Domain / TLD Parsing ─────────────────────────────────────────────────

export interface ParsedDomain {
  hostname:           string;
  domain:             string;       // registered domain (e.g. google.com)
  subdomain:          string;       // sub (e.g. www)
  publicSuffix:       string;       // TLD (e.g. com, co.uk)
  isIp:               boolean;
  isPrivate:          boolean;
  isKnownTld:         boolean;
  domainWithoutSuffix: string;      // e.g. "google" from "google.com"
}

export function parseDomain(hostname: string): ParsedDomain {
  if (!hostname) return emptyDomain(hostname);
  try {
    const r = parseTld(hostname, { allowPrivateDomains: true });
    return {
      hostname,
      domain:             r.domain             || hostname,
      subdomain:          r.subdomain           || '',
      publicSuffix:       r.publicSuffix        || '',
      isIp:               r.isIp               || false,
      isPrivate:          r.isPrivate           || false,
      isKnownTld:         !!r.publicSuffix,
      domainWithoutSuffix: r.domainWithoutSuffix || '',
    };
  } catch {
    return emptyDomain(hostname);
  }
}

function emptyDomain(hostname: string): ParsedDomain {
  return { hostname, domain: hostname, subdomain: '', publicSuffix: '', isIp: false, isPrivate: false, isKnownTld: false, domainWithoutSuffix: hostname };
}

// ─── MIME Types ───────────────────────────────────────────────────────────

export interface ParsedMime {
  type:        string;   // e.g. "application/json"
  category:    string;   // "text" | "image" | "audio" | "video" | "application" | "font"
  subtype:     string;   // e.g. "json"
  extension:   string;   // e.g. "json"
  charset:     string;   // e.g. "utf-8"
  isText:      boolean;
  isImage:     boolean;
  isMedia:     boolean;
  isFont:      boolean;
  isJson:      boolean;
  isXml:       boolean;
  isHtml:      boolean;
  isScript:    boolean;
  isStyle:     boolean;
  isCompressible: boolean;
  label:       string;   // human-readable label
}

export function parseMimeType(mimeRaw: string): ParsedMime {
  if (!mimeRaw) return emptyMime();
  const [typeAndSub, ...params] = mimeRaw.split(';');
  const [category, subtype] = typeAndSub.trim().split('/');
  const charset = params.find(p => p.trim().startsWith('charset='))?.split('=')[1]?.trim() || '';
  const type = typeAndSub.trim().toLowerCase();
  const ext = mime.extension(type) || '';

  const isText  = category === 'text';
  const isImage = category === 'image';
  const isFont  = category === 'font' || type.includes('font');
  const isMedia = category === 'audio' || category === 'video';
  const isJson  = subtype?.includes('json') || false;
  const isXml   = subtype?.includes('xml') || false;
  const isHtml  = type === 'text/html' || type === 'application/xhtml+xml';
  const isScript = type.includes('javascript') || type.includes('ecmascript');
  const isStyle  = type === 'text/css';

  const COMPRESSIBLE_TYPES = [
    'text/', 'application/json', 'application/xml',
    'application/javascript', 'application/ecmascript', 'application/xhtml',
    'image/svg', 'application/yaml', 'application/x-yaml',
    'application/atom+xml', 'application/rss+xml', 'application/ld+json',
  ];
  const isCompressible = COMPRESSIBLE_TYPES.some(t => type.startsWith(t));

  const LABELS: Record<string, string> = {
    // Text formats
    'text/html': 'HTML Document',
    'text/css': 'CSS Stylesheet',
    'text/plain': 'Plain Text',
    'text/csv': 'CSV Data',
    'text/markdown': 'Markdown',
    'text/xml': 'XML Data',
    'text/javascript': 'JavaScript',
    'text/calendar': 'iCalendar',
    // Application formats
    'application/javascript': 'JavaScript',
    'application/json': 'JSON Data',
    'application/xml': 'XML Data',
    'application/xhtml+xml': 'XHTML Document',
    'application/pdf': 'PDF Document',
    'application/wasm': 'WebAssembly',
    'application/octet-stream': 'Binary Data',
    'application/zip': 'ZIP Archive',
    'application/gzip': 'GZIP Archive',
    'application/x-7z-compressed': '7-Zip Archive',
    'application/vnd.rar': 'RAR Archive',
    'application/x-tar': 'TAR Archive',
    'application/x-bzip2': 'BZip2 Archive',
    'application/yaml': 'YAML Data',
    'application/graphql': 'GraphQL',
    'application/ld+json': 'JSON-LD Data',
    'application/atom+xml': 'Atom Feed',
    'application/rss+xml': 'RSS Feed',
    'application/soap+xml': 'SOAP XML',
    'application/vnd.api+json': 'JSON:API',
    'application/prql': 'PRQL Query',
    // Microsoft Office
    'application/msword': 'Word Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (DOCX)',
    'application/vnd.ms-excel': 'Excel Spreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet (XLSX)',
    'application/vnd.ms-powerpoint': 'PowerPoint Presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (PPTX)',
    // OpenDocument
    'application/vnd.oasis.opendocument.text': 'ODP Text Document',
    'application/vnd.oasis.opendocument.spreadsheet': 'ODP Spreadsheet',
    'application/vnd.oasis.opendocument.presentation': 'ODP Presentation',
    // Database
    'application/vnd.sqlite3': 'SQLite Database',
    'application/vnd.ms-access': 'Access Database',
    // Image formats
    'image/png': 'PNG Image',
    'image/jpeg': 'JPEG Image',
    'image/gif': 'GIF Image',
    'image/webp': 'WebP Image',
    'image/svg+xml': 'SVG Image',
    'image/avif': 'AVIF Image',
    'image/heic': 'HEIC Image',
    'image/bmp': 'BMP Image',
    'image/tiff': 'TIFF Image',
    'image/vnd.adobe.photoshop': 'Photoshop File',
    'image/x-icon': 'ICO Icon',
    // Font formats
    'font/woff2': 'WOFF2 Font',
    'font/woff': 'WOFF Font',
    'font/otf': 'OTF Font',
    'application/x-font-ttf': 'TTF Font',
    // Audio formats
    'audio/mpeg': 'MP3 Audio',
    'audio/wav': 'WAV Audio',
    'audio/ogg': 'OGG Audio',
    'audio/aac': 'AAC Audio',
    'audio/flac': 'FLAC Audio',
    'audio/webm': 'WebM Audio',
    'audio/opus': 'Opus Audio',
    // Video formats
    'video/mp4': 'MP4 Video',
    'video/webm': 'WebM Video',
    'video/ogg': 'OGG Video',
    'video/quicktime': 'QuickTime Video',
    'video/x-matroska': 'MKV Video',
    'video/x-flv': 'FLV Video',
    'video/mpeg': 'MPEG Video',
  };

  return {
    type, category: category || '', subtype: subtype || '',
    extension: ext, charset, isText, isImage, isMedia, isFont,
    isJson, isXml, isHtml, isScript, isStyle, isCompressible,
    label: LABELS[type] || (ext ? `${ext.toUpperCase()} File` : type),
  };
}

function emptyMime(): ParsedMime {
  return { type: '', category: '', subtype: '', extension: '', charset: '',
    isText: false, isImage: false, isMedia: false, isFont: false,
    isJson: false, isXml: false, isHtml: false, isScript: false, isStyle: false,
    isCompressible: false, label: 'Unknown' };
}

// Get extension from URL if MIME is missing
export function getMimeFromExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    return mime.lookup(ext) || 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
}

// ─── HTTP Status Codes ────────────────────────────────────────────────────

export interface StatusInfo {
  code:        number;
  reason:      string;       // e.g. "Not Found"
  category:    string;       // "1xx" | "2xx" | "3xx" | "4xx" | "5xx"
  label:       string;       // e.g. "404 Not Found"
  description: string;       // long description
  isSuccess:   boolean;
  isRedirect:  boolean;
  isClientError: boolean;
  isServerError: boolean;
  isCacheable: boolean;
  color:       string;
}

const STATUS_DESCRIPTIONS: Record<number, string> = {
  // 1xx Informational
  100: 'Continue — server received request headers; client should proceed to send the request body.',
  101: 'Switching Protocols — server is switching to the protocol specified in the Upgrade header field.',
  102: 'Processing — server has received and is processing the request, but no response is available yet.',
  103: 'Early Hints — used to return some response headers before final HTTP message.',
  // 2xx Successful
  200: 'OK — request has succeeded. The information returned depends on the method used in the request.',
  201: 'Created — request has been fulfilled and a new resource has been created as a result.',
  202: 'Accepted — request has been received but not yet acted upon; it is non-committal.',
  203: 'Non-Authoritative Information — returned metadata is from a local or third-party copy, not the origin server.',
  204: 'No Content — server successfully processed the request and is not returning any content.',
  205: 'Reset Content — server successfully processed the request; client should reset the document view.',
  206: 'Partial Content — server is delivering only part of the resource due to a range header sent by the client.',
  207: 'Multi-Status — response body contains multiple status codes for multiple independent operations.',
  208: 'Already Reported — DAV binding members already enumerated in a preceding part of this multi-status response.',
  226: 'IM Used — server fulfilled a GET request and the response is a representation of instance-manipulations applied.',
  // 3xx Redirection
  300: 'Multiple Choices — request has more than one possible response; user or user agent should choose one.',
  301: 'Moved Permanently — requested resource has been permanently moved to the URL given by the Location header.',
  302: 'Found — requested resource resides temporarily under a different URL (previously "Moved Temporarily").',
  303: 'See Other — server is redirecting to a different resource using a GET request.',
  304: 'Not Modified — resource has not been modified since the version specified by the request headers.',
  305: 'Use Proxy — requested resource must be accessed through the proxy given by the Location field.',
  306: 'Switch Proxy — originally meant subsequent requests should use the specified proxy (no longer used).',
  307: 'Temporary Redirect — requested resource is temporarily under a different URL; method must not change.',
  308: 'Permanent Redirect — requested resource has been permanently moved; method and body must not change.',
  // 4xx Client Error
  400: 'Bad Request — server cannot process the request due to a client error (malformed syntax, invalid request).',
  401: 'Unauthorized — authentication is required and has failed or has not yet been provided.',
  402: 'Payment Required — reserved for future use; some services use it for quota exceeded scenarios.',
  403: 'Forbidden — server understood the request but refuses to authorize it.',
  404: 'Not Found — requested resource could not be found on the server.',
  405: 'Method Not Allowed — method specified in the request is not allowed for the resource.',
  406: 'Not Acceptable — server cannot produce a response matching the list of acceptable values in headers.',
  407: 'Proxy Authentication Required — client must first authenticate itself with the proxy.',
  408: 'Request Timeout — server timed out waiting for the request from the client.',
  409: 'Conflict — request could not be completed due to a conflict with the current state of the resource.',
  410: 'Gone — resource requested is no longer available and will not be available again.',
  411: 'Length Required — server rejected the request because the Content-Length header is not defined.',
  412: 'Precondition Failed — client has indicated preconditions in its headers which the server does not meet.',
  413: 'Payload Too Large — request entity is larger than limits defined by the server.',
  414: 'URI Too Long — URI requested by the client is longer than the server is willing to interpret.',
  415: 'Unsupported Media Type — media format of the requested data is not supported by the server.',
  416: 'Range Not Satisfiable — range specified in the Range header cannot be fulfilled.',
  417: 'Expectation Failed — expectation in the Expect request-header field could not be met by the server.',
  418: "I'm a Teapot — server refuses to brew coffee because it is, permanently, a teapot (RFC 2324).",
  421: 'Misdirected Request — request was directed at a server that is not able to produce a response.',
  422: 'Unprocessable Entity — server understands the content type but was unable to process the contained instructions.',
  423: 'Locked — resource being accessed is locked.',
  424: 'Failed Dependency — request failed because a previous request that it depended on also failed.',
  425: 'Too Early — server is unwilling to risk processing a request that might be replayed.',
  426: 'Upgrade Required — server refuses to perform the request using the current protocol.',
  428: 'Precondition Required — origin server requires the request to be conditional to prevent lost updates.',
  429: 'Too Many Requests — user has sent too many requests in a given amount of time (rate limiting).',
  431: 'Request Header Fields Too Large — server is unwilling to process the request because header fields are too large.',
  451: 'Unavailable For Legal Reasons — resource cannot legally be provided (e.g. due to government censorship).',
  // 5xx Server Error
  500: 'Internal Server Error — server encountered an unexpected condition that prevented it from fulfilling the request.',
  501: 'Not Implemented — server does not support the functionality required to fulfill the request.',
  502: 'Bad Gateway — server, while acting as a gateway, received an invalid response from an upstream server.',
  503: 'Service Unavailable — server is currently unable to handle the request (overloaded or down for maintenance).',
  504: 'Gateway Timeout — server, while acting as a gateway, did not receive a timely response from upstream server.',
  505: 'HTTP Version Not Supported — HTTP version used in the request is not supported by the server.',
  506: 'Variant Also Negotiates — server has an internal configuration error during content negotiation.',
  507: 'Insufficient Storage — server is unable to store the representation needed to complete the request.',
  508: 'Loop Detected — server detected an infinite loop while processing the request.',
  510: 'Not Extended — further extensions to the request are required for the server to fulfill it.',
  511: 'Network Authentication Required — client needs to authenticate to gain network access.',
};

const CACHEABLE_CODES = new Set([200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414, 501]);

const STATUS_COLORS: Record<string, string> = {
  '1xx': '#94a3b8', '2xx': '#10b981', '3xx': '#f59e0b',
  '4xx': '#ef4444', '5xx': '#dc2626',
};

export function getStatusInfo(code: number): StatusInfo {
  const cat = code < 200 ? '1xx' : code < 300 ? '2xx' : code < 400 ? '3xx'
    : code < 500 ? '4xx' : '5xx';
  let reason = '';
  try { reason = getReasonPhrase(code); } catch { reason = 'Unknown'; }

  return {
    code,
    reason,
    category: cat,
    label: `${code} ${reason}`,
    description: STATUS_DESCRIPTIONS[code] || `HTTP ${code} — ${reason}`,
    isSuccess:     code >= 200 && code < 300,
    isRedirect:    code >= 300 && code < 400,
    isClientError: code >= 400 && code < 500,
    isServerError: code >= 500,
    isCacheable:   CACHEABLE_CODES.has(code),
    color:         STATUS_COLORS[cat] || '#94a3b8',
  };
}

// ─── IP Address Analysis ──────────────────────────────────────────────────

export interface IpInfo {
  raw:        string;
  version:    4 | 6 | null;
  kind:       'private' | 'loopback' | 'multicast' | 'public' | 'link-local' | 'broadcast' | 'unknown';
  isPrivate:  boolean;
  isLoopback: boolean;
  isPublic:   boolean;
  isIPv4:     boolean;
  isIPv6:     boolean;
  isIPv4MappedIPv6: boolean;
  normalized: string;
  cidr:       string;
  reverseDns: string;   // PTR record format
}

export function analyzeIp(raw: string): IpInfo {
  const empty: IpInfo = { raw, version: null, kind: 'unknown', isPrivate: false,
    isLoopback: false, isPublic: false, isIPv4: false, isIPv6: false,
    isIPv4MappedIPv6: false, normalized: raw, cidr: '', reverseDns: '' };
  if (!raw) return empty;

  // Strip port if present
  const host = raw.includes(':') && !raw.startsWith('[')
    ? raw.split(':').slice(0, -1).join(':')  // IPv4:port
    : raw.replace(/^\[/, '').replace(/\].*$/, ''); // [IPv6]:port

  try {
    const parsed = ipaddr.parse(host);
    const kind = parsed.kind();
    const isIPv4 = kind === 'ipv4';
    const isIPv6 = kind === 'ipv6';

    let ipKind: IpInfo['kind'] = 'public';
    if (parsed.range() === 'loopback')    ipKind = 'loopback';
    else if (parsed.range() === 'private') ipKind = 'private';
    else if (parsed.range() === 'multicast') ipKind = 'multicast';
    else if (parsed.range() === 'linkLocal') ipKind = 'link-local';
    else if (parsed.range() === 'broadcast') ipKind = 'broadcast';
    else if (parsed.range() === 'unspecified') ipKind = 'unknown';

    const normalized = parsed.toString();
    const isIPv4MappedIPv6 = isIPv6 && (parsed as ipaddr.IPv6).isIPv4MappedAddress();

    // Reverse DNS format
    let reverseDns = '';
    if (isIPv4) {
      reverseDns = normalized.split('.').reverse().join('.') + '.in-addr.arpa';
    } else if (isIPv6) {
      reverseDns = normalized.replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa';
    }

    return {
      raw,
      version:   isIPv4 ? 4 : isIPv6 ? 6 : null,
      kind:      ipKind,
      isPrivate: ipKind === 'private' || ipKind === 'loopback',
      isLoopback: ipKind === 'loopback',
      isPublic:  ipKind === 'public',
      isIPv4, isIPv6,
      isIPv4MappedIPv6,
      normalized,
      cidr: '',
      reverseDns,
    };
  } catch {
    return empty;
  }
}

// ─── Compression / Decompression ─────────────────────────────────────────

export interface DecompressResult {
  data:        Buffer | null;
  text:        string;
  encoding:    string;
  originalSize: number;
  decodedSize: number;
  ratio:       number;
  error?:      string;
}

export async function decompressBody(
  body: Buffer | string,
  encoding: string,
): Promise<DecompressResult> {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'base64');
  const originalSize = buf.length;
  const enc = encoding.toLowerCase().trim();

  try {
    let decoded: Buffer;

    if (enc === 'gzip' || enc === 'x-gzip') {
      decoded = await gunzip(buf);
    } else if (enc === 'deflate') {
      decoded = await inflate(buf);
    } else if (enc === 'br' || enc === 'brotli') {
      decoded = await brotliDecompress(buf);
    } else if (enc === 'zstd') {
      // zstd — try dynamic import
      // zstd: use native addon when available, else pass-through
      try {
        // Try @mongodb-js/zstd or similar if installed at runtime
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const zstdMod = require('@mongodb-js/zstd');
        decoded = await zstdMod.decompress(buf);
      } catch {
        // fallback: return raw buffer
        return { data: buf, text: buf.toString('utf-8'), encoding, originalSize, decodedSize: originalSize, ratio: 0, error: 'zstd native module not installed' };
      }
    } else if (enc === 'identity' || enc === '' || enc === 'none') {
      decoded = buf;
    } else {
      decoded = buf;
    }

    const text = decoded.toString('utf-8');
    const decodedSize = decoded.length;
    const ratio = originalSize > 0 ? ((originalSize - decodedSize) / originalSize) * 100 : 0;

    return { data: decoded, text, encoding, originalSize, decodedSize, ratio };
  } catch (e: any) {
    return { data: null, text: '', encoding, originalSize, decodedSize: 0, ratio: 0, error: e.message };
  }
}

// ─── HAR Entry Enrichment ─────────────────────────────────────────────────

export interface EnrichedEntry {
  ua:      ParsedUA | null;
  domain:  ParsedDomain;
  mime:    ParsedMime;
  status:  StatusInfo;
  srcIp:   IpInfo;
  dstIp:   IpInfo;
}

export function enrichEntry(entry: any): EnrichedEntry {
  const headers: { name: string; value: string }[] = entry.rawEntry?.request?.headers || [];
  const uaHeader = headers.find((h: any) => h.name.toLowerCase() === 'user-agent');

  return {
    ua:     uaHeader ? parseUserAgent(uaHeader.value) : null,
    domain: parseDomain(entry.domain || ''),
    mime:   parseMimeType(entry.mimeType || entry.rawEntry?.response?.content?.mimeType || ''),
    status: getStatusInfo(entry.status || 0),
    srcIp:  analyzeIp(''),      // client IP not in HAR
    dstIp:  analyzeIp(entry.remoteIp || ''),
  };
}
