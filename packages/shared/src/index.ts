// HAR Format Types
export interface HarFile {
  log: HarLog;
}

export interface HarLog {
  version: string;
  creator: HarCreator;
  browser?: HarBrowser;
  pages?: HarPage[];
  entries: HarEntry[];
  comment?: string;
}

export interface HarCreator {
  name: string;
  version: string;
  comment?: string;
}

export interface HarBrowser {
  name: string;
  version: string;
  comment?: string;
}

export interface HarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HarPageTimings;
  comment?: string;
}

export interface HarPageTimings {
  onContentLoad?: number;
  onLoad?: number;
  comment?: string;
}

export interface HarEntry {
  pageref?: string;
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: HarCache;
  timings: HarTimings;
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
  _priority?: string;
  _resourceType?: string;
  _initiator?: HarInitiator;
  _fromCache?: string;
  _fromDiskCache?: boolean;
  _fromMemoryCache?: boolean;
  _fromServiceWorker?: boolean;
  _transferSize?: number;
  _error?: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  queryString: HarQueryParam[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
  comment?: string;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HarCookie[];
  headers: HarHeader[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
  comment?: string;
  _transferSize?: number;
}

export interface HarHeader {
  name: string;
  value: string;
  comment?: string;
}

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  comment?: string;
}

export interface HarQueryParam {
  name: string;
  value: string;
  comment?: string;
}

export interface HarPostData {
  mimeType: string;
  params?: HarParam[];
  text?: string;
  comment?: string;
}

export interface HarParam {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
  comment?: string;
}

export interface HarContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
  comment?: string;
}

export interface HarCache {
  beforeRequest?: HarCacheEntry;
  afterRequest?: HarCacheEntry;
  comment?: string;
}

export interface HarCacheEntry {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
  comment?: string;
}

export interface HarTimings {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
  comment?: string;
  _queued?: number;
  _blocked?: number;
  _proxy?: number;
}

export interface HarInitiator {
  type: string;
  url?: string;
  lineNumber?: number;
  stack?: unknown;
}

// Analysis Types
export interface HarAnalysis {
  fileInfo: HarFileInfo;
  dashboard: DashboardData;
  entries: ProcessedEntry[];
  statistics: StatisticsData;
  domains: DomainData[];
  security: SecurityData;
  performance: PerformanceData;
}

export interface HarFileInfo {
  fileName: string;
  filePath: string;
  fileSize: number;
  md5Hash: string;
  sha256Hash: string;
  harVersion: string;
  creatorName: string;
  creatorVersion: string;
  browserName: string;
  browserVersion: string;
  generatedTimestamp: string;
  exportTimestamp: string;
  pageCount: number;
  entryCount: number;
  requestCount: number;
  uniqueUrlCount: number;
}

export interface DashboardData {
  requestSummary: RequestSummary;
  transferSummary: TransferSummary;
  timingSummary: TimingSummary;
  resourceSummary: ResourceSummary;
}

export interface RequestSummary {
  total: number;
  successful: number;
  failed: number;
  redirect: number;
  clientError: number;
  serverError: number;
  cancelled: number;
  cached: number;
  serviceWorker: number;
}

export interface TransferSummary {
  totalTransferredBytes: number;
  totalDecodedBytes: number;
  totalRequestHeadersSize: number;
  totalResponseHeadersSize: number;
  totalRequestBodySize: number;
  totalResponseBodySize: number;
  compressionSavedBytes: number;
  compressionPercentage: number;
}

export interface TimingSummary {
  totalLoadingTime: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  medianDuration: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  avgTtfb: number;
  minTtfb: number;
  maxTtfb: number;
}

export interface ResourceSummary {
  totalDomains: number;
  totalIpAddresses: number;
  totalMimeTypes: number;
  totalHttpMethods: number;
  totalProtocols: number;
  totalCookies: number;
  totalRedirects: number;
}

export interface ProcessedEntry {
  index: number;
  id: string;
  // Basic
  method: string;
  url: string;
  fullUrl: string;
  domain: string;
  host: string;
  path: string;
  queryString: string;
  fragment: string;
  status: number;
  statusText: string;
  protocol: string;
  scheme: string;
  resourceType: string;
  mimeType: string;
  // Network
  remoteIp: string;
  remotePort: number;
  connectionId: string;
  httpVersion: string;
  tlsVersion: string;
  cipherSuite: string;
  alpnProtocol: string;
  // Size
  requestSize: number;
  responseSize: number;
  headersSize: number;
  bodySize: number;
  transferredSize: number;
  decodedSize: number;
  compressionRatio: number;
  // Timing
  startTime: number;
  endTime: number;
  duration: number;
  queueTime: number;
  blockedTime: number;
  proxyTime: number;
  dnsTime: number;
  tcpTime: number;
  sslTime: number;
  sendTime: number;
  waitTime: number;
  receiveTime: number;
  downloadTime: number;
  ttfb: number;
  // Cache
  cacheStatus: string;
  memoryCache: boolean;
  diskCache: boolean;
  serviceWorkerCache: boolean;
  cacheHit: boolean;
  cacheMiss: boolean;
  etag: string;
  lastModified: string;
  expires: string;
  // Raw
  rawEntry: HarEntry;
}

export interface StatisticsData {
  methods: Record<string, number>;
  statusCodes: Record<string, number>;
  protocols: Record<string, number>;
  resourceTypes: Record<string, number>;
  mimeTypes: Record<string, number>;
}

export interface DomainData {
  domain: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalSize: number;
  avgLatency: number;
  avgTtfb: number;
  slowestRequest: number;
  largestResource: number;
  protocols: Record<string, number>;
  mimeTypes: Record<string, number>;
}

export interface SecurityData {
  httpsPercentage: number;
  tlsVersions: Record<string, number>;
  cipherSuites: Record<string, number>;
  hstsEnabled: boolean;
  cspEnabled: boolean;
  mixedContent: number;
  insecureRequests: number;
  cookieSecurityIssues: CookieSecurityIssue[];
}

export interface CookieSecurityIssue {
  name: string;
  domain: string;
  issues: string[];
}

export interface PerformanceData {
  slowRequests: SlowRequest[];
  largeResources: LargeResource[];
  missingCompression: string[];
  missingCacheHeaders: string[];
  duplicateRequests: string[];
  longRedirectChains: string[];
  highTtfb: string[];
  blockingResources: string[];
}

export interface SlowRequest {
  url: string;
  duration: number;
  ttfb: number;
}

export interface LargeResource {
  url: string;
  size: number;
  mimeType: string;
}

// API Types
export interface UploadResponse {
  id: string;
  fileName: string;
  status: 'processing' | 'complete' | 'error';
}

export interface AnalysisStatus {
  id: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: number;
  error?: string;
}

export interface ComparisonResult {
  added: ProcessedEntry[];
  removed: ProcessedEntry[];
  modified: ComparedEntry[];
  timingDifferences: TimingDiff[];
  sizeDifferences: SizeDiff[];
}

export interface ComparedEntry {
  url: string;
  a: ProcessedEntry;
  b: ProcessedEntry;
  headerDiffs: HeaderDiff[];
  cookieDiffs: CookieDiff[];
  bodyChanged: boolean;
  timingDiff: number;
  sizeDiff: number;
}

export interface HeaderDiff {
  name: string;
  aValue?: string;
  bValue?: string;
  type: 'added' | 'removed' | 'modified';
}

export interface CookieDiff {
  name: string;
  aValue?: string;
  bValue?: string;
  type: 'added' | 'removed' | 'modified';
}

export interface TimingDiff {
  url: string;
  aDuration: number;
  bDuration: number;
  diff: number;
  percentChange: number;
}

export interface SizeDiff {
  url: string;
  aSize: number;
  bSize: number;
  diff: number;
  percentChange: number;
}

export type ExportFormat = 'json' | 'csv' | 'markdown' | 'pdf' | 'html';

export interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  active: boolean;
  context_window: number;
}

// ─── HTTP Status Code Definitions ─────────────────────────────────────────

export type HttpStatusCategory = '1xx' | '2xx' | '3xx' | '4xx' | '5xx' | 'unknown';

export interface HttpStatusDef {
  code: number;
  reason: string;
  category: HttpStatusCategory;
  description: string;
  isCacheable: boolean;
}

/** All standard HTTP status codes per RFC 7231, RFC 2518, RFC 4918, RFC 6585, etc. */
export const HTTP_STATUS_CODES: Record<number, Omit<HttpStatusDef, 'code'>> = {
  // 1xx Informational
  100: { reason: 'Continue',             category: '1xx', isCacheable: false, description: 'Server received request headers; client should proceed to send body.' },
  101: { reason: 'Switching Protocols',  category: '1xx', isCacheable: false, description: 'Server is switching to the protocol specified in the Upgrade header.' },
  102: { reason: 'Processing',           category: '1xx', isCacheable: false, description: 'Server has received and is processing the request; no response available yet (WebDAV).' },
  103: { reason: 'Early Hints',          category: '1xx', isCacheable: false, description: 'Return some response headers before final HTTP message.' },
  // 2xx Successful
  200: { reason: 'OK',                   category: '2xx', isCacheable: true,  description: 'Request has succeeded.' },
  201: { reason: 'Created',              category: '2xx', isCacheable: false, description: 'Request fulfilled and a new resource has been created.' },
  202: { reason: 'Accepted',             category: '2xx', isCacheable: false, description: 'Request received but not yet acted upon.' },
  203: { reason: 'Non-Authoritative Information', category: '2xx', isCacheable: true, description: 'Returned metadata from a local or third-party copy, not the origin server.' },
  204: { reason: 'No Content',           category: '2xx', isCacheable: true,  description: 'Server successfully processed request and is not returning any content.' },
  205: { reason: 'Reset Content',        category: '2xx', isCacheable: false, description: 'Server successfully processed request; client should reset the document view.' },
  206: { reason: 'Partial Content',      category: '2xx', isCacheable: true,  description: 'Server is delivering only part of the resource (range request).' },
  207: { reason: 'Multi-Status',         category: '2xx', isCacheable: false, description: 'Response body contains multiple status codes for multiple operations (WebDAV).' },
  208: { reason: 'Already Reported',     category: '2xx', isCacheable: false, description: 'DAV binding members already enumerated in a preceding part of this response.' },
  226: { reason: 'IM Used',              category: '2xx', isCacheable: true,  description: 'Server fulfilled GET; response is result of instance-manipulations applied.' },
  // 3xx Redirection
  300: { reason: 'Multiple Choices',     category: '3xx', isCacheable: true,  description: 'Request has more than one possible response; user or agent should choose one.' },
  301: { reason: 'Moved Permanently',    category: '3xx', isCacheable: true,  description: 'Resource permanently moved to a new URL given by the Location header.' },
  302: { reason: 'Found',                category: '3xx', isCacheable: false, description: 'Resource temporarily under a different URL (previously "Moved Temporarily").' },
  303: { reason: 'See Other',            category: '3xx', isCacheable: false, description: 'Server is redirecting to a different resource via a GET request.' },
  304: { reason: 'Not Modified',         category: '3xx', isCacheable: false, description: 'Resource not modified since last request; use the cached version.' },
  305: { reason: 'Use Proxy',            category: '3xx', isCacheable: false, description: 'Resource must be accessed through the proxy given by the Location field.' },
  306: { reason: 'Switch Proxy',         category: '3xx', isCacheable: false, description: 'Subsequent requests should use the specified proxy (deprecated, no longer used).' },
  307: { reason: 'Temporary Redirect',   category: '3xx', isCacheable: false, description: 'Resource temporarily at a different URL; method must not change.' },
  308: { reason: 'Permanent Redirect',   category: '3xx', isCacheable: true,  description: 'Resource permanently moved to a new URL; method and body must not change.' },
  // 4xx Client Error
  400: { reason: 'Bad Request',          category: '4xx', isCacheable: false, description: 'Server cannot process due to client error (malformed syntax, invalid parameters).' },
  401: { reason: 'Unauthorized',         category: '4xx', isCacheable: false, description: 'Authentication is required and has failed or has not been provided.' },
  402: { reason: 'Payment Required',     category: '4xx', isCacheable: false, description: 'Reserved for future use; some APIs use it for quota exceeded scenarios.' },
  403: { reason: 'Forbidden',            category: '4xx', isCacheable: false, description: 'Server understood the request but refuses to authorize it.' },
  404: { reason: 'Not Found',            category: '4xx', isCacheable: true,  description: 'Resource could not be found on the server.' },
  405: { reason: 'Method Not Allowed',   category: '4xx', isCacheable: true,  description: 'Method specified in the request is not allowed for the resource.' },
  406: { reason: 'Not Acceptable',       category: '4xx', isCacheable: false, description: 'Server cannot produce a response matching the list of acceptable values.' },
  407: { reason: 'Proxy Authentication Required', category: '4xx', isCacheable: false, description: 'Client must first authenticate itself with the proxy.' },
  408: { reason: 'Request Timeout',      category: '4xx', isCacheable: false, description: 'Server timed out waiting for the request from the client.' },
  409: { reason: 'Conflict',             category: '4xx', isCacheable: false, description: 'Request could not be completed due to a conflict with the current resource state.' },
  410: { reason: 'Gone',                 category: '4xx', isCacheable: true,  description: 'Resource is no longer available and will not be available again.' },
  411: { reason: 'Length Required',      category: '4xx', isCacheable: false, description: 'Server rejected the request because the Content-Length header is not defined.' },
  412: { reason: 'Precondition Failed',  category: '4xx', isCacheable: false, description: 'Client has indicated preconditions which the server does not meet.' },
  413: { reason: 'Payload Too Large',    category: '4xx', isCacheable: false, description: 'Request entity is larger than limits defined by the server.' },
  414: { reason: 'URI Too Long',         category: '4xx', isCacheable: true,  description: 'URI requested by the client is longer than the server is willing to interpret.' },
  415: { reason: 'Unsupported Media Type', category: '4xx', isCacheable: false, description: 'Media format of the requested data is not supported by the server.' },
  416: { reason: 'Range Not Satisfiable', category: '4xx', isCacheable: false, description: 'Range specified in the Range header field cannot be fulfilled.' },
  417: { reason: 'Expectation Failed',   category: '4xx', isCacheable: false, description: 'Expectation in the Expect request-header field could not be met.' },
  418: { reason: "I'm a Teapot",         category: '4xx', isCacheable: false, description: "Server refuses to brew coffee; it is permanently a teapot (RFC 2324)." },
  421: { reason: 'Misdirected Request',  category: '4xx', isCacheable: false, description: 'Request was directed at a server that is not able to produce a response.' },
  422: { reason: 'Unprocessable Entity', category: '4xx', isCacheable: false, description: 'Server understands the content type but was unable to process the contained instructions.' },
  423: { reason: 'Locked',               category: '4xx', isCacheable: false, description: 'Resource being accessed is locked (WebDAV).' },
  424: { reason: 'Failed Dependency',    category: '4xx', isCacheable: false, description: 'Request failed because a previous request it depended on also failed (WebDAV).' },
  425: { reason: 'Too Early',            category: '4xx', isCacheable: false, description: 'Server is unwilling to risk processing a request that might be replayed.' },
  426: { reason: 'Upgrade Required',     category: '4xx', isCacheable: false, description: 'Server refuses to perform the request using the current protocol.' },
  428: { reason: 'Precondition Required', category: '4xx', isCacheable: false, description: 'Origin server requires the request to be conditional to prevent lost updates.' },
  429: { reason: 'Too Many Requests',    category: '4xx', isCacheable: false, description: 'User has sent too many requests in a given amount of time (rate limiting).' },
  431: { reason: 'Request Header Fields Too Large', category: '4xx', isCacheable: false, description: 'Server is unwilling to process the request because header fields are too large.' },
  451: { reason: 'Unavailable For Legal Reasons', category: '4xx', isCacheable: false, description: 'Resource cannot legally be provided (e.g. due to government censorship).' },
  // 5xx Server Error
  500: { reason: 'Internal Server Error', category: '5xx', isCacheable: false, description: 'Server encountered an unexpected condition preventing it from fulfilling the request.' },
  501: { reason: 'Not Implemented',      category: '5xx', isCacheable: true,  description: 'Server does not support the functionality required to fulfill the request.' },
  502: { reason: 'Bad Gateway',          category: '5xx', isCacheable: false, description: 'Server acting as gateway received an invalid response from an upstream server.' },
  503: { reason: 'Service Unavailable',  category: '5xx', isCacheable: false, description: 'Server is currently unable to handle the request (overloaded or down for maintenance).' },
  504: { reason: 'Gateway Timeout',      category: '5xx', isCacheable: false, description: 'Server acting as gateway did not receive a timely response from upstream server.' },
  505: { reason: 'HTTP Version Not Supported', category: '5xx', isCacheable: false, description: 'HTTP version used in the request is not supported by the server.' },
  506: { reason: 'Variant Also Negotiates', category: '5xx', isCacheable: false, description: 'Server has an internal configuration error during content negotiation.' },
  507: { reason: 'Insufficient Storage', category: '5xx', isCacheable: false, description: 'Server is unable to store the representation needed to complete the request (WebDAV).' },
  508: { reason: 'Loop Detected',        category: '5xx', isCacheable: false, description: 'Server detected an infinite loop while processing the request (WebDAV).' },
  510: { reason: 'Not Extended',         category: '5xx', isCacheable: false, description: 'Further extensions to the request are required for the server to fulfill it.' },
  511: { reason: 'Network Authentication Required', category: '5xx', isCacheable: false, description: 'Client needs to authenticate to gain network access.' },
};

/** Helper: get HTTP status info by code */
export function getHttpStatusDef(code: number): HttpStatusDef {
  const def = HTTP_STATUS_CODES[code];
  if (def) return { code, ...def };
  const cat: HttpStatusCategory = code < 200 ? '1xx' : code < 300 ? '2xx' : code < 400 ? '3xx' : code < 500 ? '4xx' : '5xx';
  return { code, reason: 'Unknown', category: cat, isCacheable: false, description: `HTTP ${code}` };
}

// ─── MIME Type Constants ───────────────────────────────────────────────────

/** Common MIME type categories for filtering/display */
export const MIME_CATEGORIES = {
  text:        ['text/html', 'text/css', 'text/plain', 'text/csv', 'text/xml', 'text/markdown', 'text/javascript', 'text/calendar', 'text/vcard'],
  script:      ['application/javascript', 'application/ecmascript', 'application/x-javascript', 'text/javascript'],
  data:        ['application/json', 'application/xml', 'application/ld+json', 'application/yaml', 'application/x-yaml', 'text/csv', 'application/prql'],
  image:       ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif', 'image/bmp', 'image/tiff', 'image/heic', 'image/x-icon'],
  font:        ['font/woff2', 'font/woff', 'font/otf', 'application/x-font-ttf', 'application/x-font-otf'],
  audio:       ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/webm', 'audio/opus', 'audio/midi', 'audio/mp4'],
  video:       ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska', 'video/mpeg', 'video/x-flv', 'video/mp2t'],
  document:    ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.oasis.opendocument.text'],
  spreadsheet: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.oasis.opendocument.spreadsheet'],
  archive:     ['application/zip', 'application/gzip', 'application/x-7z-compressed', 'application/vnd.rar', 'application/x-tar', 'application/x-bzip2'],
  binary:      ['application/octet-stream', 'application/wasm'],
} as const;
