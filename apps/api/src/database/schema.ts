import { pgTable, serial, text, integer, bigint, real, boolean, timestamp, jsonb, varchar, index } from 'drizzle-orm/pg-core';

export const harFiles = pgTable('har_files', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().unique(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path'),
  fileSize: bigint('file_size', { mode: 'number' }),
  md5Hash: varchar('md5_hash', { length: 32 }),
  sha256Hash: varchar('sha256_hash', { length: 64 }),
  harVersion: varchar('har_version', { length: 20 }),
  creatorName: text('creator_name'),
  creatorVersion: text('creator_version'),
  browserName: text('browser_name'),
  browserVersion: text('browser_version'),
  generatedTimestamp: text('generated_timestamp'),
  exportTimestamp: text('export_timestamp'),
  pageCount: integer('page_count').default(0),
  entryCount: integer('entry_count').default(0),
  requestCount: integer('request_count').default(0),
  uniqueUrlCount: integer('unique_url_count').default(0),
  status: varchar('status', { length: 20 }).default('pending'), // pending, processing, complete, error
  errorMessage: text('error_message'),
  rawData: jsonb('raw_data'),
  analysisData: jsonb('analysis_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uuidIdx: index('har_files_uuid_idx').on(table.uuid),
  statusIdx: index('har_files_status_idx').on(table.status),
}));

export const harEntries = pgTable('har_entries', {
  id: serial('id').primaryKey(),
  harFileId: integer('har_file_id').notNull(),
  entryIndex: integer('entry_index').notNull(),
  uuid: varchar('uuid', { length: 36 }).notNull(),
  // Basic
  method: varchar('method', { length: 20 }),
  url: text('url'),
  fullUrl: text('full_url'),
  domain: text('domain'),
  host: text('host'),
  path: text('path'),
  queryString: text('query_string'),
  fragment: text('fragment'),
  status: integer('status'),
  statusText: text('status_text'),
  protocol: varchar('protocol', { length: 20 }),
  scheme: varchar('scheme', { length: 20 }),
  resourceType: varchar('resource_type', { length: 50 }),
  mimeType: text('mime_type'),
  // Network
  remoteIp: text('remote_ip'),
  remotePort: integer('remote_port'),
  connectionId: text('connection_id'),
  httpVersion: varchar('http_version', { length: 20 }),
  tlsVersion: varchar('tls_version', { length: 20 }),
  cipherSuite: text('cipher_suite'),
  alpnProtocol: text('alpn_protocol'),
  // Size
  requestSize: integer('request_size').default(0),
  responseSize: integer('response_size').default(0),
  headersSize: integer('headers_size').default(0),
  bodySize: integer('body_size').default(0),
  transferredSize: integer('transferred_size').default(0),
  decodedSize: integer('decoded_size').default(0),
  compressionRatio: real('compression_ratio').default(0),
  // Timing
  startTime: real('start_time').default(0),
  endTime: real('end_time').default(0),
  duration: real('duration').default(0),
  queueTime: real('queue_time').default(0),
  blockedTime: real('blocked_time').default(0),
  proxyTime: real('proxy_time').default(0),
  dnsTime: real('dns_time').default(0),
  tcpTime: real('tcp_time').default(0),
  sslTime: real('ssl_time').default(0),
  sendTime: real('send_time').default(0),
  waitTime: real('wait_time').default(0),
  receiveTime: real('receive_time').default(0),
  downloadTime: real('download_time').default(0),
  ttfb: real('ttfb').default(0),
  // Cache
  cacheStatus: varchar('cache_status', { length: 50 }),
  memoryCache: boolean('memory_cache').default(false),
  diskCache: boolean('disk_cache').default(false),
  serviceWorkerCache: boolean('service_worker_cache').default(false),
  cacheHit: boolean('cache_hit').default(false),
  cacheMiss: boolean('cache_miss').default(false),
  etag: text('etag'),
  lastModified: text('last_modified'),
  expires: text('expires'),
  // Raw
  rawEntry: jsonb('raw_entry'),
  requestHeaders: jsonb('request_headers'),
  responseHeaders: jsonb('response_headers'),
  requestCookies: jsonb('request_cookies'),
  responseCookies: jsonb('response_cookies'),
  requestBody: jsonb('request_body'),
  responseBody: text('response_body'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  harFileIdIdx: index('har_entries_file_id_idx').on(table.harFileId),
  urlIdx: index('har_entries_url_idx').on(table.url),
  domainIdx: index('har_entries_domain_idx').on(table.domain),
  statusIdx: index('har_entries_status_idx').on(table.status),
  methodIdx: index('har_entries_method_idx').on(table.method),
}));

export const analysisJobs = pgTable('analysis_jobs', {
  id: serial('id').primaryKey(),
  harFileId: integer('har_file_id').notNull(),
  jobId: text('job_id'),
  status: varchar('status', { length: 20 }).default('queued'),
  progress: integer('progress').default(0),
  errorMessage: text('error_message'),
  result: jsonb('result'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const groqAnalyses = pgTable('groq_analyses', {
  id: serial('id').primaryKey(),
  harFileId: integer('har_file_id').notNull(),
  model: text('model').notNull(),
  analysisType: varchar('analysis_type', { length: 50 }),
  prompt: text('prompt'),
  result: text('result'),
  tokensUsed: integer('tokens_used'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type HarFileInsert = typeof harFiles.$inferInsert;
export type HarFileSelect = typeof harFiles.$inferSelect;
export type HarEntryInsert = typeof harEntries.$inferInsert;
export type HarEntrySelect = typeof harEntries.$inferSelect;
