import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuidv4 } from 'uuid';
import { DB_TOKEN } from '../database/database.module';
import * as schema from '../database/schema';
import { HarParserService } from './har-parser.service';
import { HarAnalysis, ProcessedEntry } from '../shared-types';

@Injectable()
export class HarService {
  constructor(
    @Inject(DB_TOKEN) private db: NodePgDatabase<typeof schema>,
    @InjectQueue('har-analysis') private analysisQueue: Queue,
    private parser: HarParserService,
  ) {}

  async uploadHar(content: string, fileName: string): Promise<{ id: string; status: string }> {
    const uuid = uuidv4();
    const fileSize = Buffer.byteLength(content, 'utf8');

    let harFile: any;
    try {
      harFile = this.parser.parseHarFile(content);
    } catch (e) {
      throw new BadRequestException('Invalid HAR file format: ' + e.message);
    }

    const hashes = this.parser.computeHashes(content);
    const log = harFile.log;

    const [inserted] = await (this.db.insert(schema.harFiles).values({
      uuid,
      fileName,
      fileSize,
      md5Hash: hashes.md5,
      sha256Hash: hashes.sha256,
      harVersion: log.version || '1.2',
      creatorName: log.creator?.name || 'Unknown',
      creatorVersion: log.creator?.version || 'Unknown',
      browserName: log.browser?.name || 'Unknown',
      browserVersion: log.browser?.version || 'Unknown',
      generatedTimestamp: log.entries?.[0]?.startedDateTime || '',
      exportTimestamp: log.entries?.[log.entries.length - 1]?.startedDateTime || '',
      pageCount: log.pages?.length || 0,
      entryCount: log.entries?.length || 0,
      requestCount: log.entries?.length || 0,
      uniqueUrlCount: new Set(log.entries?.map((e: any) => e.request.url) || []).size,
      status: 'processing',
      rawData: harFile,
    } as any).returning() as any);

    await this.analysisQueue.add('analyze', {
      harFileId: inserted.id,
      uuid,
      content,
      fileName,
      fileSize,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });

    return { id: uuid, status: 'processing' };
  }

  async getHarFile(uuid: string) {
    const [file] = await this.db.select().from(schema.harFiles).where(eq(schema.harFiles.uuid, uuid));
    if (!file) throw new NotFoundException('HAR file not found');
    return file;
  }

  async getAnalysisStatus(uuid: string) {
    const file = await this.getHarFile(uuid);
    return {
      id: uuid,
      status: file.status,
      progress: file.status === 'complete' ? 100 : file.status === 'processing' ? 50 : 0,
      error: file.errorMessage,
    };
  }

  async getAnalysis(uuid: string): Promise<HarAnalysis> {
    const file = await this.getHarFile(uuid);
    if (file.status !== 'complete') {
      throw new BadRequestException('Analysis not complete yet. Status: ' + file.status);
    }
    return file.analysisData as unknown as HarAnalysis;
  }

  async getEntries(uuid: string, options: Record<string, any>) {
    const file = await this.getHarFile(uuid);
    const analysis = file.analysisData as unknown as HarAnalysis;
    if (!analysis?.entries) return { entries: [], total: 0, page: 1, limit: 50 };

    let entries = analysis.entries as ProcessedEntry[];
    const { search, method, status, domain, resourceType, mimeType, minDuration, maxDuration, minSize, maxSize, cacheStatus, https: httpsOnly, sortBy, sortDir } = options;

    if (search) {
      const s = search.toLowerCase();
      entries = entries.filter(e =>
        e.url?.toLowerCase().includes(s) ||
        e.domain?.toLowerCase().includes(s) ||
        e.path?.toLowerCase().includes(s) ||
        String(e.status).includes(s)
      );
    }
    if (method) entries = entries.filter(e => e.method === method);
    if (status) {
      if (String(status).endsWith('xx')) {
        const base = parseInt(status[0]) * 100;
        entries = entries.filter(e => e.status >= base && e.status < base + 100);
      } else {
        entries = entries.filter(e => String(e.status) === String(status));
      }
    }
    if (domain) entries = entries.filter(e => e.domain?.includes(domain));
    if (resourceType) entries = entries.filter(e => e.resourceType === resourceType);
    if (mimeType) entries = entries.filter(e => e.mimeType?.includes(mimeType));
    if (minDuration) entries = entries.filter(e => e.duration >= parseFloat(minDuration));
    if (maxDuration) entries = entries.filter(e => e.duration <= parseFloat(maxDuration));
    if (minSize) entries = entries.filter(e => e.transferredSize >= parseInt(minSize));
    if (maxSize) entries = entries.filter(e => e.transferredSize <= parseInt(maxSize));
    if (cacheStatus) entries = entries.filter(e => e.cacheStatus === cacheStatus);
    if (httpsOnly !== undefined) entries = entries.filter(e => httpsOnly === 'true' ? e.scheme === 'https' : e.scheme === 'http');

    if (sortBy) {
      const dir = sortDir === 'desc' ? -1 : 1;
      entries.sort((a, b) => {
        const av = (a as any)[sortBy]; const bv = (b as any)[sortBy];
        if (typeof av === 'number') return (av - bv) * dir;
        return String(av || '').localeCompare(String(bv || '')) * dir;
      });
    }

    const total = entries.length;
    const page = parseInt(options.page || '1');
    const limit = Math.min(parseInt(options.limit || '100'), 1000);
    const start = (page - 1) * limit;

    return { entries: entries.slice(start, start + limit), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getEntry(uuid: string, entryIndex: number): Promise<ProcessedEntry> {
    const analysis = await this.getAnalysis(uuid);
    const entry = analysis.entries[entryIndex];
    if (!entry) throw new NotFoundException('Entry not found');
    return entry;
  }

  async searchEntries(uuid: string, query: string, fields: string[]) {
    const analysis = await this.getAnalysis(uuid);
    const entries = analysis.entries as ProcessedEntry[];
    const q = query.toLowerCase();
    const isRegex = fields.includes('regex');

    let matches: ProcessedEntry[];
    if (isRegex) {
      try {
        const regex = new RegExp(query, 'i');
        matches = entries.filter(e => regex.test(e.url) || regex.test(e.domain));
      } catch { matches = []; }
    } else {
      matches = entries.filter(e => {
        const searchFields = fields.length > 0 ? fields : ['url', 'domain', 'path', 'method', 'mimeType'];
        return searchFields.some(field => {
          const val = (e as any)[field];
          if (typeof val === 'string') return val.toLowerCase().includes(q);
          if (typeof val === 'number') return String(val).includes(q);
          return false;
        });
      });
    }
    return matches;
  }

  async compareHarFiles(uuidA: string, uuidB: string) {
    const [analysisA, analysisB] = await Promise.all([this.getAnalysis(uuidA), this.getAnalysis(uuidB)]);
    const entriesA = analysisA.entries as ProcessedEntry[];
    const entriesB = analysisB.entries as ProcessedEntry[];

    const mapA = new Map(entriesA.map(e => [e.url + ':' + e.method, e]));
    const mapB = new Map(entriesB.map(e => [e.url + ':' + e.method, e]));

    const added = entriesB.filter(e => !mapA.has(e.url + ':' + e.method));
    const removed = entriesA.filter(e => !mapB.has(e.url + ':' + e.method));
    const modified: any[] = [];
    const timingDifferences: any[] = [];
    const sizeDifferences: any[] = [];

    for (const [key, entryA] of mapA) {
      const entryB = mapB.get(key);
      if (!entryB) continue;

      const headerDiffs = this.diffHeaders(entryA.rawEntry.request.headers || [], entryB.rawEntry.request.headers || []);
      const cookieDiffs = this.diffCookies(entryA.rawEntry.request.cookies || [], entryB.rawEntry.request.cookies || []);
      const bodyChanged = JSON.stringify(entryA.rawEntry.request.postData) !== JSON.stringify(entryB.rawEntry.request.postData);

      if (headerDiffs.length > 0 || cookieDiffs.length > 0 || bodyChanged || entryA.status !== entryB.status || Math.abs(entryA.duration - entryB.duration) > 10) {
        modified.push({ url: entryA.url, a: entryA, b: entryB, headerDiffs, cookieDiffs, bodyChanged, timingDiff: entryB.duration - entryA.duration, sizeDiff: entryB.transferredSize - entryA.transferredSize });
      }

      const timingDiff = entryB.duration - entryA.duration;
      if (Math.abs(timingDiff) > 100) {
        timingDifferences.push({ url: entryA.url, aDuration: entryA.duration, bDuration: entryB.duration, diff: timingDiff, percentChange: entryA.duration > 0 ? (timingDiff / entryA.duration) * 100 : 0 });
      }

      const sizeDiff = entryB.transferredSize - entryA.transferredSize;
      if (Math.abs(sizeDiff) > 512) {
        sizeDifferences.push({ url: entryA.url, aSize: entryA.transferredSize, bSize: entryB.transferredSize, diff: sizeDiff, percentChange: entryA.transferredSize > 0 ? (sizeDiff / entryA.transferredSize) * 100 : 0 });
      }
    }

    return { added, removed, modified, timingDifferences: timingDifferences.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)), sizeDifferences: sizeDifferences.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)) };
  }

  private diffHeaders(aH: any[], bH: any[]) {
    const mapA = new Map(aH.map(h => [h.name.toLowerCase(), h.value]));
    const mapB = new Map(bH.map(h => [h.name.toLowerCase(), h.value]));
    const diffs: any[] = [];
    for (const [n, v] of mapA) { if (!mapB.has(n)) diffs.push({ name: n, aValue: v, type: 'removed' }); else if (mapB.get(n) !== v) diffs.push({ name: n, aValue: v, bValue: mapB.get(n), type: 'modified' }); }
    for (const [n, v] of mapB) { if (!mapA.has(n)) diffs.push({ name: n, bValue: v, type: 'added' }); }
    return diffs;
  }

  private diffCookies(aC: any[], bC: any[]) {
    const mapA = new Map(aC.map(c => [c.name, c.value]));
    const mapB = new Map(bC.map(c => [c.name, c.value]));
    const diffs: any[] = [];
    for (const [n, v] of mapA) { if (!mapB.has(n)) diffs.push({ name: n, aValue: v, type: 'removed' }); else if (mapB.get(n) !== v) diffs.push({ name: n, aValue: v, bValue: mapB.get(n), type: 'modified' }); }
    for (const [n, v] of mapB) { if (!mapA.has(n)) diffs.push({ name: n, bValue: v, type: 'added' }); }
    return diffs;
  }

  async getAllHarFiles() {
    return this.db.select({ id: schema.harFiles.id, uuid: schema.harFiles.uuid, fileName: schema.harFiles.fileName, fileSize: schema.harFiles.fileSize, entryCount: schema.harFiles.entryCount, status: schema.harFiles.status, createdAt: schema.harFiles.createdAt, browserName: schema.harFiles.browserName, browserVersion: schema.harFiles.browserVersion }).from(schema.harFiles).orderBy(sql`${schema.harFiles.createdAt} DESC`);
  }

  async deleteHarFile(uuid: string) {
    await this.db.delete(schema.harFiles).where(eq(schema.harFiles.uuid, uuid));
    return { success: true };
  }
}
