// Extended HAR parsing utilities for edge cases and browser-specific formats

export function extractOsFromUserAgent(userAgent: string): string {
  if (!userAgent) return 'Unknown';
  if (/Windows NT 10/.test(userAgent)) return 'Windows 10/11';
  if (/Windows NT 6/.test(userAgent)) return 'Windows 7/8';
  if (/Mac OS X/.test(userAgent)) return 'macOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  if (/Android/.test(userAgent)) return 'Android';
  if (/iPhone|iPad/.test(userAgent)) return 'iOS';
  return 'Unknown';
}

export function extractBrowserFromUserAgent(userAgent: string): { name: string; version: string } {
  if (!userAgent) return { name: 'Unknown', version: '' };
  const matchers: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Safari\/([\d.]+)/, 'Safari'],
    [/OPR\/([\d.]+)/, 'Opera'],
  ];
  for (const [re, name] of matchers) {
    const m = userAgent.match(re);
    if (m) return { name, version: m[1].split('.').slice(0, 2).join('.') };
  }
  return { name: 'Unknown', version: '' };
}

export function normalizeHttpVersion(version: string): string {
  if (!version) return '';
  const lower = version.toLowerCase();
  if (lower === 'h2' || lower === 'http/2' || lower === 'http/2.0') return 'HTTP/2';
  if (lower === 'h3' || lower === 'http/3' || lower === 'http/3.0') return 'HTTP/3';
  if (lower === 'http/1.1') return 'HTTP/1.1';
  if (lower === 'http/1.0') return 'HTTP/1.0';
  if (lower === 'quic') return 'QUIC';
  return version.toUpperCase();
}

export function detectResourceTypeFromHeaders(
  mimeType: string,
  url: string,
  method: string,
  status: number,
  requestHeaders: { name: string; value: string }[],
  responseHeaders: { name: string; value: string }[]
): string {
  const mime = (mimeType || '').toLowerCase().split(';')[0].trim();
  const urlLower = url.toLowerCase();

  // Document
  if (mime.includes('text/html') || mime.includes('application/xhtml')) return 'document';
  // Stylesheet
  if (mime.includes('text/css') || urlLower.match(/\.css(\?|$)/)) return 'stylesheet';
  // Script
  if (mime.includes('javascript') || mime.includes('ecmascript') || urlLower.match(/\.m?js(\?|$)/)) return 'script';
  // Images
  if (mime.startsWith('image/') || urlLower.match(/\.(png|jpg|jpeg|gif|webp|svg|avif|ico)(\?|$)/)) return 'image';
  // Fonts
  if (mime.startsWith('font/') || mime.includes('woff') || urlLower.match(/\.(woff2?|ttf|otf|eot)(\?|$)/)) return 'font';
  // Media
  if (mime.startsWith('video/') || mime.startsWith('audio/') || urlLower.match(/\.(mp4|webm|mp3|ogg|wav)(\?|$)/)) return 'media';
  // WebSocket
  const upgradeHeader = requestHeaders.find(h => h.name.toLowerCase() === 'upgrade');
  if (upgradeHeader?.value.toLowerCase() === 'websocket') return 'websocket';
  // Manifest
  if (mime.includes('manifest') || urlLower.includes('manifest')) return 'manifest';
  // WASM
  if (mime.includes('wasm') || urlLower.endsWith('.wasm')) return 'wasm';
  // XHR/Fetch
  const xReqWith = requestHeaders.find(h => h.name.toLowerCase() === 'x-requested-with');
  if (xReqWith) return 'xhr';
  if (mime.includes('json') || mime.includes('xml')) return 'fetch';
  // Preflight
  if (method === 'OPTIONS') return 'preflight';
  return 'other';
}

export function safeParseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

export function estimateTlsFromHeaders(responseHeaders: { name: string; value: string }[]): {
  version: string; cipher: string;
} {
  // Some proxies/CDNs expose TLS info in headers
  const headerMap = new Map(responseHeaders.map(h => [h.name.toLowerCase(), h.value]));

  const tlsVer = headerMap.get('x-tls-version') || '';

  const cipher = headerMap.get('x-tls-cipher-suite')
    || headerMap.get('x-ssl-cipher')
    || '';

  return { version: tlsVer, cipher };
}

export function groupEntriesByPage(entries: any[], pages: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const page of pages) map.set(page.id, []);
  map.set('__no_page__', []);
  for (const entry of entries) {
    const key = entry.pageref || '__no_page__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return map;
}

export function detectHarFormat(har: any): 'chrome' | 'firefox' | 'safari' | 'fiddler' | 'charles' | 'generic' {
  const creator = har?.log?.creator?.name?.toLowerCase() || '';
  if (creator.includes('chrome') || creator.includes('devtools')) return 'chrome';
  if (creator.includes('firefox') || creator.includes('mozilla')) return 'firefox';
  if (creator.includes('safari') || creator.includes('webkit')) return 'safari';
  if (creator.includes('fiddler')) return 'fiddler';
  if (creator.includes('charles')) return 'charles';
  return 'generic';
}
