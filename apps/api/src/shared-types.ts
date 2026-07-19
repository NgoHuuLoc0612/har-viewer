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
