import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  HarFile, HarEntry, ProcessedEntry, HarAnalysis,
  DashboardData, StatisticsData, DomainData,
  SecurityData, PerformanceData, HarFileInfo,
  RequestSummary, TransferSummary, TimingSummary, ResourceSummary,
} from '../shared-types';

// ─── Browser Detection Helpers ───────────────────────────────────────────────

/** Known creator tool → browser name mappings */
// ─── Creator tool → browser/tool name ───────────────────────────────────────
// Matched case-insensitively via substring. More specific entries should come
// before more generic ones (e.g. 'firefox devtools' before 'firefox').
const CREATOR_TO_BROWSER: Array<[string, string]> = [
  // ── Browsers (devtools / export) ─────────────────────────────────────────
  ['webinspector',          'Safari'],       // macOS/iOS Safari Web Inspector
  ['safari',                'Safari'],
  ['firefox developer',     'Firefox'],
  ['firefox devtools',      'Firefox'],
  ['firefox',               'Firefox'],
  ['chrome devtools',       'Chrome'],
  ['chromium',              'Chromium'],
  ['chrome',                'Chrome'],
  ['microsoft edge',        'Edge'],
  ['msedge',                'Edge'],
  ['edge',                  'Edge'],
  ['opera devtools',        'Opera'],
  ['opera',                 'Opera'],
  ['opr',                   'Opera'],
  ['brave',                 'Brave'],
  ['vivaldi',               'Vivaldi'],
  ['samsung internet',      'Samsung Internet'],
  ['samsungbrowser',        'Samsung Internet'],
  ['uc browser',            'UC Browser'],
  ['ucbrowser',             'UC Browser'],
  ['yandex',                'Yandex Browser'],
  ['tor browser',           'Tor Browser'],
  ['waterfox',              'Waterfox'],
  ['pale moon',             'Pale Moon'],
  ['seamonkey',             'SeaMonkey'],
  ['maxthon',               'Maxthon'],
  ['puffin',                'Puffin'],
  ['duckduckgo',            'DuckDuckGo Browser'],
  ['kiwi',                  'Kiwi Browser'],
  ['focus',                 'Firefox Focus'],
  ['ie',                    'Internet Explorer'],
  ['internet explorer',     'Internet Explorer'],
  ['trident',               'Internet Explorer'],
  // ── Proxy / Capture tools ─────────────────────────────────────────────────
  ['fiddler everywhere',    'Fiddler Everywhere'],
  ['fiddler classic',       'Fiddler Classic'],
  ['fiddler',               'Fiddler'],
  ['charles',               'Charles Proxy'],
  ['proxyman',              'Proxyman'],
  ['mitmproxy',             'mitmproxy'],
  ['mitm',                  'mitmproxy'],
  ['burp suite',            'Burp Suite'],
  ['burpsuite',             'Burp Suite'],
  ['owasp zap',             'OWASP ZAP'],
  ['zap',                   'OWASP ZAP'],
  ['httptoolkit',           'HTTP Toolkit'],
  ['http toolkit',          'HTTP Toolkit'],
  ['wireshark',             'Wireshark'],
  ['tcpdump',               'tcpdump'],
  ['netsparker',            'Netsparker'],
  ['acunetix',              'Acunetix'],
  ['nikto',                 'Nikto'],
  ['reqable',               'Reqable'],
  ['proxifier',             'Proxifier'],
  ['saml tracer',           'SAML Tracer'],
  ['modheader',             'ModHeader'],
  // ── API clients ───────────────────────────────────────────────────────────
  ['postman',               'Postman'],
  ['insomnia',              'Insomnia'],
  ['bruno',                 'Bruno'],
  ['hoppscotch',            'Hoppscotch'],
  ['httpie',                'HTTPie'],
  ['thunder client',        'Thunder Client'],
  ['rapidapi',              'RapidAPI'],
  ['paw',                   'Paw / RapidAPI'],
  ['rested',                'Rested'],
  ['restler',               'RESTler'],
  ['rest client',           'REST Client'],
  ['talend api tester',     'Talend API Tester'],
  ['swagger',               'Swagger UI'],
  ['redoc',                 'Redoc'],
  // ── CLI / Code HTTP clients ───────────────────────────────────────────────
  ['curl',                  'cURL'],
  ['wget',                  'wget'],
  ['httpx',                 'httpx'],
  ['axios',                 'axios (Node.js)'],
  ['got',                   'Got (Node.js)'],
  ['node-fetch',            'node-fetch'],
  ['undici',                'undici (Node.js)'],
  ['superagent',            'SuperAgent'],
  ['needle',                'Needle (Node.js)'],
  ['python-requests',       'Python Requests'],
  ['python-httpx',          'Python httpx'],
  ['aiohttp',               'Python aiohttp'],
  ['urllib',                'Python urllib'],
  ['java-http-client',      'Java HttpClient'],
  ['okhttp',                'OkHttp (Java/Android)'],
  ['retrofit',              'Retrofit (Java)'],
  ['apache-httpclient',     'Apache HttpClient'],
  ['spring webclient',      'Spring WebClient'],
  ['resttemplate',          'Spring RestTemplate'],
  ['guzzle',                'Guzzle (PHP)'],
  ['httpclient',            'HttpClient (.NET)'],
  ['faraday',               'Faraday (Ruby)'],
  ['httparty',              'HTTParty (Ruby)'],
  ['ruby',                  'Ruby Net::HTTP'],
  ['go-http-client',        'Go net/http'],
  ['dart',                  'Dart http'],
  ['rust-reqwest',          'Rust reqwest'],
  ['swift-alamofire',       'Alamofire (Swift)'],
  // ── Automation / Testing ──────────────────────────────────────────────────
  ['puppeteer',             'Puppeteer'],
  ['playwright',            'Playwright'],
  ['selenium',              'Selenium'],
  ['cypress',               'Cypress'],
  ['webdriver',             'WebDriver'],
  ['k6',                    'k6'],
  ['jmeter',                'JMeter'],
  ['gatling',               'Gatling'],
  ['locust',                'Locust'],
  ['scrapy',                'Scrapy'],
  ['beautifulsoup',         'BeautifulSoup'],
  ['mechanize',             'Mechanize'],
  // ── Monitoring / Synthetic ────────────────────────────────────────────────
  ['pingdom',               'Pingdom'],
  ['datadog',               'Datadog Synthetics'],
  ['new relic',             'New Relic Synthetics'],
  ['dynatrace',             'Dynatrace Synthetic'],
  ['catchpoint',            'Catchpoint'],
  ['webpagetest',           'WebPageTest'],
  ['lighthouse',            'Lighthouse'],
  // ── HAR exporters / specific browser extensions ───────────────────────────
  ['har export trigger',    'HAR Export Trigger'],
  ['devtools for chrome',   'Chrome DevTools'],
  ['network panel',         'Browser DevTools'],
  ['developer tools',       'Browser DevTools'],
];

// ─── False / filler brand names in sec-ch-ua to ignore ───────────────────────
const CH_UA_FAKE_BRANDS = /Not.{0,4}A.{0,4}Brand|Not.{0,4}Brand|Chromium/i;

// ─── Parse sec-ch-ua / sec-ch-ua-full-version-list ────────────────────────────
// Format: "Google Chrome";v="128", "Not;A=Brand";v="99", "Chromium";v="128"
function parseClientHints(log: any): { name: string; version: string } | null {
  const entries: any[] = log.entries || [];
  for (const entry of entries.slice(0, 10)) {
    // HAR may store these in request.headers or (Firefox) response.requestHeaders
    const headerSets = [
      entry?.request?.headers,
      entry?.response?.requestHeaders,
    ].filter(Boolean);

    for (const headers of headerSets) {
      // Prefer full-version-list for accurate version
      const fullList = headers.find((h: any) =>
        h.name?.toLowerCase() === 'sec-ch-ua-full-version-list'
      )?.value;
      const basic = headers.find((h: any) =>
        h.name?.toLowerCase() === 'sec-ch-ua'
      )?.value;

      const raw = fullList || basic;
      if (!raw) continue;

      // Parse tokens: "Brand";v="version"
      const tokens: Array<{ brand: string; version: string }> = [];
      const re = /"([^"]+)"\s*;\s*v="([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) !== null) {
        if (!CH_UA_FAKE_BRANDS.test(m[1])) {
          tokens.push({ brand: m[1], version: m[2] });
        }
      }

      // Priority: real product brands over Chromium
      const BRAND_MAP: Record<string, string> = {
        'google chrome':      'Chrome',
        'microsoft edge':     'Edge',
        'brave':              'Brave',
        'opera':              'Opera',
        'vivaldi':            'Vivaldi',
        'samsung internet':   'Samsung Internet',
        'yandex browser':     'Yandex Browser',
        'duckduckgo':         'DuckDuckGo Browser',
        'whale':              'Naver Whale',
        'arc':                'Arc',
        'thorium':            'Thorium',
        'ungoogled-chromium': 'Ungoogled Chromium',
      };

      for (const { brand, version } of tokens) {
        const mapped = BRAND_MAP[brand.toLowerCase()];
        if (mapped) return { name: mapped, version: version.split('.')[0] };
      }
      // Fallback: first non-fake brand
      if (tokens.length > 0) {
        return { name: tokens[0].brand, version: tokens[0].version.split('.')[0] };
      }
    }
  }
  return null;
}

// ─── User-Agent lookup ────────────────────────────────────────────────────────
// Checks both request.headers and response.requestHeaders (Firefox HAR quirk)
function firstUserAgent(log: any): string {
  const entries: any[] = log.entries || [];
  for (const entry of entries.slice(0, 10)) {
    const headerSets = [
      entry?.request?.headers,
      entry?.response?.requestHeaders,
    ].filter(Boolean);
    for (const headers of headerSets) {
      const ua = headers.find((h: any) => h.name?.toLowerCase() === 'user-agent')?.value;
      if (ua && ua.trim()) return ua.trim();
    }
  }
  return '';
}

// ─── UA string → { name, version } ──────────────────────────────────────────
// Each entry: [test fn, name, version regex]
type UaRule = [(ua: string) => boolean, string, RegExp | null];

const UA_RULES: UaRule[] = [
  // ── Chromium-based: check specific markers BEFORE generic Chrome ──────────
  [ua => /Edg\//.test(ua),                                        'Edge',             /Edg\/([\.\d]+)/],
  [ua => /OPR\//.test(ua),                                        'Opera',            /OPR\/([\.\d]+)/],
  [ua => /Brave\//.test(ua) || /Brave/.test(ua),                  'Brave',            /Chrome\/([\.\d]+)/],
  [ua => /Vivaldi\//.test(ua),                                     'Vivaldi',          /Vivaldi\/([\.\d]+)/],
  [ua => /YaBrowser\//.test(ua),                                   'Yandex Browser',   /YaBrowser\/([\.\d]+)/],
  [ua => /SamsungBrowser\//.test(ua),                              'Samsung Internet', /SamsungBrowser\/([\.\d]+)/],
  [ua => /UCBrowser\//.test(ua),                                   'UC Browser',       /UCBrowser\/([\.\d]+)/],
  [ua => /DuckDuckGo\//.test(ua),                                  'DuckDuckGo',       /DuckDuckGo\/([\.\d]+)/],
  [ua => /Whale\//.test(ua),                                       'Naver Whale',      /Whale\/([\.\d]+)/],
  [ua => /FxiOS\//.test(ua),                                       'Firefox (iOS)',     /FxiOS\/([\.\d]+)/],
  [ua => /CriOS\//.test(ua),                                       'Chrome (iOS)',      /CriOS\/([\.\d]+)/],
  [ua => /EdgiOS\//.test(ua),                                      'Edge (iOS)',        /EdgiOS\/([\.\d]+)/],
  // Chrome: must NOT be any of the above derivatives
  [ua => /Chrome\//.test(ua) && !/Edg\/|OPR\/|Brave|Vivaldi\/|YaBrowser\/|SamsungBrowser\/|UCBrowser\/|DuckDuckGo\/|Whale\/|CriOS\//.test(ua),
                                                                    'Chrome',           /Chrome\/([\.\d]+)/],
  // Gecko-based
  [ua => /Firefox\//.test(ua) && !/Seamonkey\//.test(ua),        'Firefox',          /Firefox\/([\.\d]+)/],
  [ua => /Seamonkey\//.test(ua),                                   'SeaMonkey',        /Seamonkey\/([\.\d]+)/],
  [ua => /Waterfox\//.test(ua),                                    'Waterfox',         /Waterfox\/([\.\d]+)/],
  [ua => /PaleMoon\//.test(ua),                                    'Pale Moon',        /PaleMoon\/([\.\d]+)/],
  // Safari: must NOT contain Chrome (Chrome UA always includes Safari/)
  [ua => /Safari\//.test(ua) && !/Chrome\/|Chromium\//.test(ua), 'Safari',          /Version\/([\.\d]+)/],
  // Legacy
  [ua => /Trident\/|MSIE /.test(ua),                               'Internet Explorer', /(?:MSIE |rv:)([\d.]+)/],
  // Automation
  [ua => /HeadlessChrome\//.test(ua),                              'Headless Chrome',  /HeadlessChrome\/([\.\d]+)/],
  [ua => /PhantomJS\//.test(ua),                                   'PhantomJS',        /PhantomJS\/([\.\d]+)/],
  [ua => /Electron\//.test(ua),                                    'Electron',         /Electron\/([\.\d]+)/],
];

function parseUserAgent(ua: string): { name: string; version: string } | null {
  if (!ua) return null;
  for (const [test, name, versionRe] of UA_RULES) {
    if (test(ua)) {
      let version = '';
      if (versionRe) {
        const m = ua.match(versionRe);
        if (m?.[1]) {
          const parts = m[1].split('.');
          version = parts.slice(0, 2).join('.');
        }
      }
      return { name, version };
    }
  }
  return null;
}

// ─── Creator name → browser/tool ─────────────────────────────────────────────
function detectFromCreator(log: any): { name: string; version: string } | null {
  const creator = (log.creator?.name || '').toLowerCase().trim();
  const cVer   = (log.creator?.version || '').trim();
  if (!creator) return null;

  for (const [key, value] of CREATOR_TO_BROWSER) {
    if (creator.includes(key)) {
      // Don't use creator version for browser-family creators (it's engine version, not browser version)
      const isBrowserCreator = ['safari', 'webinspector', 'chrome', 'firefox', 'edge'].some(b => key.includes(b));
      return { name: value, version: isBrowserCreator ? '' : cVer };
    }
  }
  return null;
}

// ─── Main detection: log.browser → UA → Client Hints → creator → Unknown ─────
function detectBrowserName(log: any): string {
  // 1. log.browser.name (set by the HAR exporter explicitly)
  const bName = log.browser?.name?.trim();
  if (bName && !/^unknown$/i.test(bName) && bName !== '') return bName;

  // 2. User-Agent (most reliable for desktop browsers)
  const ua = firstUserAgent(log);
  const uaResult = parseUserAgent(ua);
  if (uaResult) return uaResult.name;

  // 3. Client Hints sec-ch-ua (more accurate than UA for Chromium-based)
  const chResult = parseClientHints(log);
  if (chResult) return chResult.name;

  // 4. creator field → tool/browser name
  const creatorResult = detectFromCreator(log);
  if (creatorResult) return creatorResult.name;

  return 'Unknown';
}

function detectBrowserVersion(log: any): string {
  // 1. log.browser.version
  const bVer = log.browser?.version?.trim();
  if (bVer && !/^unknown$/i.test(bVer) && bVer !== '') return bVer;

  // 2. User-Agent version
  const ua = firstUserAgent(log);
  const uaResult = parseUserAgent(ua);
  if (uaResult?.version) return uaResult.version;

  // 3. Client Hints version (major only, but very accurate)
  const chResult = parseClientHints(log);
  if (chResult?.version) return chResult.version;

  // 4. creator version — only if it doesn't look like a WebKit/engine version
  const creatorResult = detectFromCreator(log);
  if (creatorResult?.version) {
    // WebKit versions look like "537.36", "605.1.15" — skip for browsers
    const v = creatorResult.version;
    if (!/^\d{3}\.\d+/.test(v)) return v.split('.')[0]; // major only
  }

  return '';
}

@Injectable()
export class HarParserService {
  parseHarFile(content: string): HarFile {
    try {
      return JSON.parse(content) as HarFile;
    } catch (e) {
      throw new Error('Invalid HAR file: ' + e.message);
    }
  }

  computeHashes(content: string) {
    return {
      md5: crypto.createHash('md5').update(content).digest('hex'),
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
    };
  }

  extractFileInfo(har: HarFile, fileName: string, fileSize: number, hashes: { md5: string; sha256: string }): HarFileInfo {
    const log = har.log;
    const urls = new Set(log.entries.map(e => e.request.url));
    const firstEntry = log.entries[0];
    const lastEntry = log.entries[log.entries.length - 1];

    return {
      fileName,
      filePath: '',
      fileSize,
      md5Hash: hashes.md5,
      sha256Hash: hashes.sha256,
      harVersion: log.version || '1.2',
      creatorName: log.creator?.name || 'Unknown',
      creatorVersion: log.creator?.version || 'Unknown',
      browserName: detectBrowserName(log),
      browserVersion: detectBrowserVersion(log),
      generatedTimestamp: firstEntry?.startedDateTime || '',
      exportTimestamp: lastEntry?.startedDateTime || '',
      pageCount: log.pages?.length || 0,
      entryCount: log.entries.length,
      requestCount: log.entries.length,
      uniqueUrlCount: urls.size,
    };
  }

  processEntries(entries: HarEntry[]): ProcessedEntry[] {
    let firstStart = Infinity;
    const startTimes = entries.map(e => new Date(e.startedDateTime).getTime());
    firstStart = Math.min(...startTimes);

    return entries.map((entry, index) => {
      const url = entry.request.url;
      const parsed = this.parseUrl(url);
      const timings = entry.timings;
      const startMs = new Date(entry.startedDateTime).getTime();
      const relativeStart = (startMs - firstStart) / 1000;

      const blocked = Math.max(0, timings.blocked || 0);
      const dns = Math.max(0, timings.dns || 0);
      const connect = Math.max(0, timings.connect || 0);
      const ssl = Math.max(0, timings.ssl || 0);
      const send = Math.max(0, timings.send || 0);
      const wait = Math.max(0, timings.wait || 0);
      const receive = Math.max(0, timings.receive || 0);
      const queue = Math.max(0, timings._queued || 0);

      const ttfb = blocked + dns + connect + ssl + send + wait;

      // Extract TLS info from response headers
      const responseHeaders = entry.response.headers || [];
      const tlsHeader = responseHeaders.find(h => h.name.toLowerCase() === 'x-tls-version');
      const cipherHeader = responseHeaders.find(h => h.name.toLowerCase() === 'x-cipher-suite');

      // Cache detection
      const cacheControl = responseHeaders.find(h => h.name.toLowerCase() === 'cache-control')?.value || '';
      const etag = responseHeaders.find(h => h.name.toLowerCase() === 'etag')?.value || '';
      const lastModified = responseHeaders.find(h => h.name.toLowerCase() === 'last-modified')?.value || '';
      const expires = responseHeaders.find(h => h.name.toLowerCase() === 'expires')?.value || '';

      const fromMemory = entry._fromMemoryCache || entry._fromCache === 'memory';
      const fromDisk = entry._fromDiskCache || entry._fromCache === 'disk';
      const fromSW = entry._fromServiceWorker || false;

      let cacheStatus = 'none';
      if (fromMemory) cacheStatus = 'memory';
      else if (fromDisk) cacheStatus = 'disk';
      else if (fromSW) cacheStatus = 'service-worker';
      else if (entry.response.status === 304) cacheStatus = '304';

      const decodedSize = entry.response.content.size || 0;
      const transferredSize = entry._transferSize || entry.response._transferSize || entry.response.bodySize || 0;
      const compressionRatio = decodedSize > 0 && transferredSize > 0
        ? ((decodedSize - transferredSize) / decodedSize) * 100
        : 0;

      const serverIp = entry.serverIPAddress || '';
      const ipPort = serverIp.includes(':') ? serverIp.split(':') : [serverIp, '443'];

      return {
        index,
        id: `entry-${index}`,
        method: entry.request.method,
        url,
        fullUrl: url,
        domain: parsed.domain,
        host: parsed.host,
        path: parsed.path,
        queryString: parsed.search,
        fragment: parsed.hash,
        status: entry.response.status,
        statusText: entry.response.statusText,
        protocol: parsed.protocol.replace(':', ''),
        scheme: parsed.protocol.replace(':', ''),
        resourceType: entry._resourceType || this.guessResourceType(entry),
        mimeType: entry.response.content.mimeType?.split(';')[0] || '',
        remoteIp: ipPort[0],
        remotePort: parseInt(ipPort[1] || (parsed.protocol === 'https:' ? '443' : '80'), 10),
        connectionId: entry.connection || '',
        httpVersion: entry.request.httpVersion || '',
        tlsVersion: tlsHeader?.value || '',
        cipherSuite: cipherHeader?.value || '',
        alpnProtocol: '',
        requestSize: Math.max(0, entry.request.headersSize + entry.request.bodySize),
        responseSize: Math.max(0, entry.response.headersSize + entry.response.bodySize),
        headersSize: Math.max(0, entry.request.headersSize + entry.response.headersSize),
        bodySize: Math.max(0, entry.request.bodySize + entry.response.bodySize),
        transferredSize,
        decodedSize,
        compressionRatio,
        startTime: relativeStart,
        endTime: relativeStart + entry.time / 1000,
        duration: entry.time,
        queueTime: queue,
        blockedTime: blocked,
        proxyTime: Math.max(0, timings._proxy || 0),
        dnsTime: dns,
        tcpTime: connect,
        sslTime: ssl,
        sendTime: send,
        waitTime: wait,
        receiveTime: receive,
        downloadTime: receive,
        ttfb,
        cacheStatus,
        memoryCache: fromMemory,
        diskCache: fromDisk,
        serviceWorkerCache: fromSW,
        cacheHit: fromMemory || fromDisk || fromSW || entry.response.status === 304,
        cacheMiss: !fromMemory && !fromDisk && !fromSW && entry.response.status !== 304,
        etag,
        lastModified,
        expires,
        rawEntry: entry,
      } as ProcessedEntry;
    });
  }

  private parseUrl(url: string) {
    try {
      const u = new URL(url);
      return {
        protocol: u.protocol,
        host: u.host,
        domain: u.hostname,
        path: u.pathname,
        search: u.search.replace(/^\?/, ''),
        hash: u.hash.replace(/^#/, ''),
      };
    } catch {
      return { protocol: 'http:', host: '', domain: '', path: url, search: '', hash: '' };
    }
  }

  private guessResourceType(entry: HarEntry): string {
    const mime = entry.response.content.mimeType?.toLowerCase() || '';
    const url = entry.request.url.toLowerCase();
    const method = entry.request.method.toUpperCase();

    if (mime.includes('html')) return 'document';
    if (mime.includes('css')) return 'stylesheet';
    if (mime.includes('javascript') || mime.includes('ecmascript')) return 'script';
    if (mime.includes('image/')) return 'image';
    if (mime.includes('font/') || url.match(/\.(woff2?|ttf|otf|eot)/)) return 'font';
    if (mime.includes('video/') || mime.includes('audio/')) return 'media';
    if (mime.includes('json') || mime.includes('xml')) {
      if (method === 'GET' && url.includes('/api/')) return 'fetch';
      return 'xhr';
    }
    if (url.endsWith('.wasm')) return 'wasm';
    if (url.includes('ws://') || url.includes('wss://')) return 'websocket';
    if (url.includes('manifest')) return 'manifest';
    return 'other';
  }

  computeDashboard(entries: ProcessedEntry[], harFile: HarFile): DashboardData {
    const requestSummary = this.computeRequestSummary(entries);
    const transferSummary = this.computeTransferSummary(entries);
    const timingSummary = this.computeTimingSummary(entries, harFile);
    const resourceSummary = this.computeResourceSummary(entries);

    return { requestSummary, transferSummary, timingSummary, resourceSummary };
  }

  private computeRequestSummary(entries: ProcessedEntry[]): RequestSummary {
    return {
      total: entries.length,
      successful: entries.filter(e => e.status >= 200 && e.status < 300).length,
      failed: entries.filter(e => e.status === 0 || e.status >= 500).length,
      redirect: entries.filter(e => e.status >= 300 && e.status < 400).length,
      clientError: entries.filter(e => e.status >= 400 && e.status < 500).length,
      serverError: entries.filter(e => e.status >= 500 && e.status < 600).length,
      cancelled: entries.filter(e => e.status === 0).length,
      cached: entries.filter(e => e.cacheHit).length,
      serviceWorker: entries.filter(e => e.serviceWorkerCache).length,
    };
  }

  private computeTransferSummary(entries: ProcessedEntry[]): TransferSummary {
    const totalTransferred = entries.reduce((s, e) => s + e.transferredSize, 0);
    const totalDecoded = entries.reduce((s, e) => s + e.decodedSize, 0);
    const saved = Math.max(0, totalDecoded - totalTransferred);

    return {
      totalTransferredBytes: totalTransferred,
      totalDecodedBytes: totalDecoded,
      totalRequestHeadersSize: entries.reduce((s, e) => s + (e.rawEntry.request.headersSize || 0), 0),
      totalResponseHeadersSize: entries.reduce((s, e) => s + (e.rawEntry.response.headersSize || 0), 0),
      totalRequestBodySize: entries.reduce((s, e) => s + Math.max(0, e.rawEntry.request.bodySize || 0), 0),
      totalResponseBodySize: entries.reduce((s, e) => s + Math.max(0, e.rawEntry.response.bodySize || 0), 0),
      compressionSavedBytes: saved,
      compressionPercentage: totalDecoded > 0 ? (saved / totalDecoded) * 100 : 0,
    };
  }

  private computeTimingSummary(entries: ProcessedEntry[], harFile: HarFile): TimingSummary {
    const durations = entries.map(e => e.duration).filter(d => d > 0).sort((a, b) => a - b);
    const ttfbs = entries.map(e => e.ttfb).filter(t => t > 0).sort((a, b) => a - b);

    const pct = (arr: number[], p: number) => {
      if (!arr.length) return 0;
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    const firstEntry = harFile.log.entries[0];
    const lastEntry = harFile.log.entries[harFile.log.entries.length - 1];
    const totalTime = firstEntry && lastEntry
      ? (new Date(lastEntry.startedDateTime).getTime() - new Date(firstEntry.startedDateTime).getTime()) + (lastEntry.time || 0)
      : 0;

    return {
      totalLoadingTime: totalTime,
      avgDuration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minDuration: durations[0] || 0,
      maxDuration: durations[durations.length - 1] || 0,
      medianDuration: pct(durations, 50),
      p50: pct(durations, 50),
      p75: pct(durations, 75),
      p90: pct(durations, 90),
      p95: pct(durations, 95),
      p99: pct(durations, 99),
      avgTtfb: ttfbs.length ? ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length : 0,
      minTtfb: ttfbs[0] || 0,
      maxTtfb: ttfbs[ttfbs.length - 1] || 0,
    };
  }

  private computeResourceSummary(entries: ProcessedEntry[]): ResourceSummary {
    const domains = new Set(entries.map(e => e.domain));
    const ips = new Set(entries.map(e => e.remoteIp).filter(Boolean));
    const mimes = new Set(entries.map(e => e.mimeType).filter(Boolean));
    const methods = new Set(entries.map(e => e.method));
    const protocols = new Set(entries.map(e => e.httpVersion).filter(Boolean));
    const allCookies = entries.flatMap(e => [...(e.rawEntry.request.cookies || []), ...(e.rawEntry.response.cookies || [])]);
    const redirects = entries.filter(e => e.status >= 300 && e.status < 400);

    return {
      totalDomains: domains.size,
      totalIpAddresses: ips.size,
      totalMimeTypes: mimes.size,
      totalHttpMethods: methods.size,
      totalProtocols: protocols.size,
      totalCookies: allCookies.length,
      totalRedirects: redirects.length,
    };
  }

  computeStatistics(entries: ProcessedEntry[]): StatisticsData {
    const count = (arr: string[]) => arr.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      methods: count(entries.map(e => e.method)),
      statusCodes: count(entries.map(e => String(e.status))),
      protocols: count(entries.map(e => e.httpVersion).filter(Boolean)),
      resourceTypes: count(entries.map(e => e.resourceType)),
      mimeTypes: count(entries.map(e => e.mimeType || 'unknown').filter(Boolean)),
    };
  }

  computeDomainData(entries: ProcessedEntry[]): DomainData[] {
    const domainMap = new Map<string, ProcessedEntry[]>();
    for (const entry of entries) {
      const d = entry.domain || 'unknown';
      if (!domainMap.has(d)) domainMap.set(d, []);
      domainMap.get(d)!.push(entry);
    }

    return Array.from(domainMap.entries()).map(([domain, domEntries]) => {
      const sizes = domEntries.map(e => e.transferredSize);
      const latencies = domEntries.map(e => e.duration).filter(d => d > 0);
      const ttfbs = domEntries.map(e => e.ttfb).filter(t => t > 0);

      const protocols: Record<string, number> = {};
      const mimeTypes: Record<string, number> = {};

      for (const e of domEntries) {
        if (e.httpVersion) protocols[e.httpVersion] = (protocols[e.httpVersion] || 0) + 1;
        if (e.mimeType) mimeTypes[e.mimeType] = (mimeTypes[e.mimeType] || 0) + 1;
      }

      return {
        domain,
        requestCount: domEntries.length,
        successCount: domEntries.filter(e => e.status >= 200 && e.status < 300).length,
        errorCount: domEntries.filter(e => e.status >= 400).length,
        totalSize: sizes.reduce((a, b) => a + b, 0),
        avgLatency: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        avgTtfb: ttfbs.length ? ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length : 0,
        slowestRequest: latencies.length ? Math.max(...latencies) : 0,
        largestResource: sizes.length ? Math.max(...sizes) : 0,
        protocols,
        mimeTypes,
      };
    }).sort((a, b) => b.requestCount - a.requestCount);
  }

  computeSecurityData(entries: ProcessedEntry[]): SecurityData {
    const httpsEntries = entries.filter(e => e.scheme === 'https' || e.protocol === 'https');
    const httpsPercentage = entries.length > 0 ? (httpsEntries.length / entries.length) * 100 : 0;

    const tlsVersions: Record<string, number> = {};
    const cipherSuites: Record<string, number> = {};

    for (const e of entries) {
      if (e.tlsVersion) tlsVersions[e.tlsVersion] = (tlsVersions[e.tlsVersion] || 0) + 1;
      if (e.cipherSuite) cipherSuites[e.cipherSuite] = (cipherSuites[e.cipherSuite] || 0) + 1;
    }

    const allResponseHeaders = entries.flatMap(e => e.rawEntry.response.headers || []);
    const hasHsts = allResponseHeaders.some(h => h.name.toLowerCase() === 'strict-transport-security');
    const hasCsp = allResponseHeaders.some(h => h.name.toLowerCase() === 'content-security-policy');

    const mixedContent = entries.filter(e => {
      const isHtml = e.mimeType?.includes('html');
      return !isHtml && e.scheme === 'http';
    }).length;

    const cookieIssues = [];
    for (const entry of entries) {
      const cookies = [...(entry.rawEntry.response.cookies || [])];
      for (const cookie of cookies) {
        const issues = [];
        if (!cookie.secure) issues.push('missing-secure');
        if (!cookie.httpOnly) issues.push('missing-httponly');
        if (!cookie.sameSite) issues.push('missing-samesite');
        if (issues.length > 0) {
          cookieIssues.push({ name: cookie.name, domain: cookie.domain || entry.domain, issues });
        }
      }
    }

    return {
      httpsPercentage,
      tlsVersions,
      cipherSuites,
      hstsEnabled: hasHsts,
      cspEnabled: hasCsp,
      mixedContent,
      insecureRequests: entries.filter(e => e.scheme === 'http').length,
      cookieSecurityIssues: cookieIssues,
    };
  }

  computePerformanceData(entries: ProcessedEntry[]): PerformanceData {
    const SLOW_THRESHOLD = 3000;
    const LARGE_THRESHOLD = 1024 * 1024; // 1MB
    const HIGH_TTFB = 600;

    const slowRequests = entries
      .filter(e => e.duration > SLOW_THRESHOLD)
      .map(e => ({ url: e.url, duration: e.duration, ttfb: e.ttfb }))
      .sort((a, b) => b.duration - a.duration);

    const largeResources = entries
      .filter(e => e.transferredSize > LARGE_THRESHOLD)
      .map(e => ({ url: e.url, size: e.transferredSize, mimeType: e.mimeType }))
      .sort((a, b) => b.size - a.size);

    const urlMap = new Map<string, number>();
    for (const e of entries) {
      const key = `${e.method}:${e.url}`;
      urlMap.set(key, (urlMap.get(key) || 0) + 1);
    }
    const duplicateRequests = Array.from(urlMap.entries())
      .filter(([, count]) => count > 1)
      .map(([url]) => url);

    const missingCompression = entries
      .filter(e => {
        const contentEncoding = (e.rawEntry.response.headers || [])
          .find(h => h.name.toLowerCase() === 'content-encoding');
        const isCompressible = ['text/', 'application/json', 'application/javascript']
          .some(t => e.mimeType?.startsWith(t));
        return isCompressible && !contentEncoding && e.decodedSize > 1024;
      })
      .map(e => e.url);

    const missingCacheHeaders = entries
      .filter(e => {
        const cacheControl = (e.rawEntry.response.headers || [])
          .find(h => h.name.toLowerCase() === 'cache-control');
        const isCacheable = e.mimeType && (
          e.mimeType.includes('image/') ||
          e.mimeType.includes('javascript') ||
          e.mimeType.includes('css') ||
          e.mimeType.includes('font/')
        );
        return isCacheable && !cacheControl;
      })
      .map(e => e.url);

    const highTtfb = entries
      .filter(e => e.ttfb > HIGH_TTFB)
      .map(e => e.url);

    const blockingResources = entries
      .filter(e => (e.resourceType === 'script' || e.resourceType === 'stylesheet') && e.startTime < 0.5)
      .map(e => e.url);

    // Detect redirect chains
    const redirectUrls = entries
      .filter(e => e.status >= 300 && e.status < 400)
      .map(e => e.url);

    return {
      slowRequests,
      largeResources,
      missingCompression,
      missingCacheHeaders,
      duplicateRequests,
      longRedirectChains: redirectUrls,
      highTtfb,
      blockingResources,
    };
  }

  fullAnalysis(har: HarFile, fileName: string, fileSize: number, content: string): HarAnalysis {
    const hashes = this.computeHashes(content);
    const fileInfo = this.extractFileInfo(har, fileName, fileSize, hashes);
    const processedEntries = this.processEntries(har.log.entries);
    const dashboard = this.computeDashboard(processedEntries, har);
    const statistics = this.computeStatistics(processedEntries);
    const domains = this.computeDomainData(processedEntries);
    const security = this.computeSecurityData(processedEntries);
    const performance = this.computePerformanceData(processedEntries);

    return { fileInfo, dashboard, entries: processedEntries, statistics, domains, security, performance };
  }
}


// ─── Import enrichment at top-level (lazy to avoid circular) ──────────────
// (These are referenced as async helpers in enrichEntry calls)
import * as UAParserMod from 'ua-parser-js';
import { parse as parseTld } from 'tldts';
import * as mimeMod from 'mime-types';
import { getReasonPhrase } from 'http-status-codes';
import * as ipaddr from 'ipaddr.js';

export function enrichEntryMetadata(entry: any): Record<string, any> {
  const headers: { name: string; value: string }[] =
    entry.rawEntry?.request?.headers || [];
  const uaStr = headers.find((h: any) =>
    h.name.toLowerCase() === 'user-agent')?.value || '';

  // UA
  let uaInfo: any = {};
  if (uaStr) {
    try {
      const p = new (UAParserMod as any).UAParser(uaStr);
      const r = p.getResult();
      uaInfo = {
        browserName:    r.browser?.name    || '',
        browserVersion: r.browser?.version || '',
        osName:         r.os?.name         || '',
        osVersion:      r.os?.version      || '',
        deviceType:     r.device?.type     || 'desktop',
        isBot: /bot|crawl|spider/i.test(uaStr),
      };
    } catch {}
  }

  // Domain
  let domainInfo: any = {};
  try {
    const r = parseTld(entry.domain || '', { allowPrivateDomains: true });
    domainInfo = {
      registeredDomain: r.domain,
      subdomain:        r.subdomain,
      tld:              r.publicSuffix,
      isIp:             r.isIp,
      isPrivate:        r.isPrivate,
    };
  } catch {}

  // MIME
  const mimeRaw = entry.mimeType || '';
  const mimeExt = mimeMod.extension(mimeRaw.split(';')[0].trim()) || '';
  const mimeInfo = { extension: mimeExt, type: mimeRaw };

  // HTTP Status
  let statusReason = '';
  try { statusReason = getReasonPhrase(entry.status); } catch {}

  // IP
  let ipInfo: any = {};
  try {
    if (entry.remoteIp) {
      const parsed = ipaddr.parse(entry.remoteIp);
      ipInfo = {
        version:   parsed.kind() === 'ipv4' ? 4 : 6,
        range:     parsed.range(),
        isPrivate: ['private', 'loopback', 'linkLocal'].includes(parsed.range()),
        normalized: parsed.toString(),
      };
    }
  } catch {}

  return { uaInfo, domainInfo, mimeInfo, statusReason, ipInfo };
}
