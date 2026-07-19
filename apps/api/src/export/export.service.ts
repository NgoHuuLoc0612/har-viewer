import { Injectable, Inject } from '@nestjs/common';
import { DB_TOKEN } from '../database/database.module';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HarAnalysis, ProcessedEntry } from '../shared-types';

@Injectable()
export class ExportService {
  constructor(
    @Inject(DB_TOKEN) private db: NodePgDatabase<typeof schema>,
  ) {}

  async exportHar(uuid: string, format: 'json' | 'csv' | 'markdown' | 'html', entryIndices?: number[]) {
    const [file] = await this.db.select().from(schema.harFiles).where(eq(schema.harFiles.uuid, uuid));
    const analysis = file.analysisData as unknown as HarAnalysis;
    let entries = analysis.entries as ProcessedEntry[];

    if (entryIndices?.length) {
      entries = entryIndices.map(i => entries[i]).filter(Boolean);
    }

    switch (format) {
      case 'json': return this.exportJson(analysis, entries);
      case 'csv': return this.exportCsv(entries);
      case 'markdown': return this.exportMarkdown(analysis, entries);
      case 'html': return this.exportHtml(analysis, entries);
      default: return this.exportJson(analysis, entries);
    }
  }

  private exportJson(analysis: HarAnalysis, entries: ProcessedEntry[]) {
    const data = {
      fileInfo: analysis.fileInfo,
      dashboard: analysis.dashboard,
      statistics: analysis.statistics,
      domains: analysis.domains,
      security: analysis.security,
      performance: analysis.performance,
      entries: entries.map(e => ({
        index: e.index,
        method: e.method,
        url: e.url,
        status: e.status,
        statusText: e.statusText,
        duration: e.duration,
        ttfb: e.ttfb,
        transferredSize: e.transferredSize,
        resourceType: e.resourceType,
        mimeType: e.mimeType,
        domain: e.domain,
        protocol: e.protocol,
        cacheStatus: e.cacheStatus,
      })),
    };
    return { content: JSON.stringify(data, null, 2), mimeType: 'application/json', fileName: 'har-analysis.json' };
  }

  private exportCsv(entries: ProcessedEntry[]) {
    const headers = ['#', 'Method', 'URL', 'Status', 'Duration(ms)', 'TTFB(ms)', 'Size(bytes)', 'MIME Type', 'Domain', 'Protocol', 'Cache', 'Resource Type'];
    const rows = entries.map(e => [
      e.index + 1,
      e.method,
      `"${e.url.replace(/"/g, '""')}"`,
      e.status,
      Math.round(e.duration),
      Math.round(e.ttfb),
      e.transferredSize,
      e.mimeType,
      e.domain,
      e.httpVersion,
      e.cacheStatus,
      e.resourceType,
    ].join(','));

    const content = [headers.join(','), ...rows].join('\n');
    return { content, mimeType: 'text/csv', fileName: 'har-requests.csv' };
  }

  private exportMarkdown(analysis: HarAnalysis, entries: ProcessedEntry[]) {
    const { fileInfo, dashboard } = analysis;
    const rs = dashboard.requestSummary;
    const ts = dashboard.timingSummary;
    const tr = dashboard.transferSummary;

    const md = `# HAR Analysis Report

## File Information
- **File**: ${fileInfo.fileName}
- **Size**: ${this.formatBytes(fileInfo.fileSize)}
- **Browser**: ${fileInfo.browserName} ${fileInfo.browserVersion}
- **Generated**: ${fileInfo.generatedTimestamp}

## Summary
- **Total Requests**: ${rs.total}
- **Successful**: ${rs.successful} (${((rs.successful / rs.total) * 100).toFixed(1)}%)
- **Failed**: ${rs.failed}
- **Cached**: ${rs.cached}

## Timing
- **Avg Duration**: ${Math.round(ts.avgDuration)}ms
- **P50**: ${Math.round(ts.p50)}ms
- **P90**: ${Math.round(ts.p90)}ms
- **P95**: ${Math.round(ts.p95)}ms
- **P99**: ${Math.round(ts.p99)}ms

## Transfer
- **Total Transferred**: ${this.formatBytes(tr.totalTransferredBytes)}
- **Compression Saved**: ${this.formatBytes(tr.compressionSavedBytes)} (${tr.compressionPercentage.toFixed(1)}%)

## Top 20 Requests (by duration)

| # | Method | Status | Duration | Size | URL |
|---|--------|--------|----------|------|-----|
${entries.slice(0, 20).sort((a, b) => b.duration - a.duration).map(e =>
  `| ${e.index + 1} | ${e.method} | ${e.status} | ${Math.round(e.duration)}ms | ${this.formatBytes(e.transferredSize)} | ${e.url.substring(0, 80)} |`
).join('\n')}
`;
    return { content: md, mimeType: 'text/markdown', fileName: 'har-analysis.md' };
  }

  private exportHtml(analysis: HarAnalysis, entries: ProcessedEntry[]) {
    const { fileInfo, dashboard } = analysis;
    const rs = dashboard.requestSummary;
    const ts = dashboard.timingSummary;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HAR Analysis Report - ${fileInfo.fileName}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #0a0a0f; color: #e2e8f0; }
  .header { background: linear-gradient(135deg, #0f172a, #1e293b); padding: 40px; border-bottom: 1px solid #334155; }
  h1 { color: #06b6d4; margin: 0 0 8px; font-size: 28px; }
  .subtitle { color: #94a3b8; font-size: 14px; }
  .container { max-width: 1400px; margin: 0 auto; padding: 32px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 24px 0; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; }
  .card-title { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .card-value { font-size: 28px; font-weight: 700; color: #06b6d4; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1e293b; color: #94a3b8; padding: 10px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  td { padding: 8px 12px; border-bottom: 1px solid #1e293b; }
  tr:hover td { background: #1e293b33; }
  .status-2xx { color: #22c55e; }
  .status-3xx { color: #f59e0b; }
  .status-4xx { color: #ef4444; }
  .status-5xx { color: #dc2626; }
  .method-get { color: #22c55e; }
  .method-post { color: #3b82f6; }
  .method-put { color: #f59e0b; }
  .method-delete { color: #ef4444; }
  h2 { color: #e2e8f0; border-bottom: 1px solid #334155; padding-bottom: 8px; }
</style>
</head>
<body>
<div class="header">
  <div class="container">
    <h1>HAR Analysis Report</h1>
    <div class="subtitle">${fileInfo.fileName} &bull; ${fileInfo.browserName} ${fileInfo.browserVersion} &bull; ${new Date(fileInfo.generatedTimestamp).toLocaleString()}</div>
  </div>
</div>
<div class="container">
  <h2>Summary</h2>
  <div class="grid">
    <div class="card"><div class="card-title">Total Requests</div><div class="card-value">${rs.total}</div></div>
    <div class="card"><div class="card-title">Successful</div><div class="card-value" style="color:#22c55e">${rs.successful}</div></div>
    <div class="card"><div class="card-title">Failed</div><div class="card-value" style="color:#ef4444">${rs.failed}</div></div>
    <div class="card"><div class="card-title">Cached</div><div class="card-value" style="color:#a78bfa">${rs.cached}</div></div>
    <div class="card"><div class="card-title">Avg Duration</div><div class="card-value">${Math.round(ts.avgDuration)}ms</div></div>
    <div class="card"><div class="card-title">P95 Duration</div><div class="card-value">${Math.round(ts.p95)}ms</div></div>
  </div>

  <h2>All Requests (${entries.length})</h2>
  <table>
    <thead><tr><th>#</th><th>Method</th><th>Status</th><th>Duration</th><th>Size</th><th>Type</th><th>URL</th></tr></thead>
    <tbody>
    ${entries.map(e => `
      <tr>
        <td>${e.index + 1}</td>
        <td class="method-${e.method.toLowerCase()}">${e.method}</td>
        <td class="status-${Math.floor(e.status / 100)}xx">${e.status}</td>
        <td>${Math.round(e.duration)}ms</td>
        <td>${this.formatBytes(e.transferredSize)}</td>
        <td>${e.resourceType}</td>
        <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.url}">${e.url}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>
</body>
</html>`;

    return { content: html, mimeType: 'text/html', fileName: 'har-analysis.html' };
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
