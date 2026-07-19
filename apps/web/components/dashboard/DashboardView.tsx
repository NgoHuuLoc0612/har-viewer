'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, RotateCcw, Zap, Shield, Globe,
  Clock, HardDrive, ArrowDownUp, FileText, AlertTriangle,
  TrendingUp, Server, Wifi
} from 'lucide-react';
import { HarAnalysis } from '@har-viewer/shared';
import { formatBytes, formatDuration, formatNumber } from '@/lib/utils';
import { FileInfoCard } from './FileInfoCard';
import { MiniDonutChart } from './MiniDonutChart';
import { TimingBreakdown } from './TimingBreakdown';
import { RequestTimeline } from '../charts/RequestTimeline';

interface DashboardViewProps {
  analysis: HarAnalysis;
  uuid: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  delay?: number;
}

function StatCard({ label, value, sub, icon: Icon, color = 'var(--color-accent)', delay = 0 }: StatCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.25 }}
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <div>
        <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
          {value}
        </span>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{sub}</div>}
      </div>
    </motion.div>
  );
}

export function DashboardView({ analysis, uuid }: DashboardViewProps) {
  const { fileInfo, dashboard, statistics } = analysis;
  const { requestSummary: rs, transferSummary: tr, timingSummary: ts, resourceSummary: res } = dashboard;

  const successRate = rs.total > 0 ? ((rs.successful / rs.total) * 100).toFixed(1) : '0';

  return (
    <div className="p-6 space-y-6 h-full overflow-auto">
      {/* Section: File Info */}
      <FileInfoCard fileInfo={fileInfo} />

      {/* Section: Request Summary */}
      <div>
        <SectionHeader title="Request Summary" />
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total" value={formatNumber(rs.total)} icon={FileText} delay={0} />
          <StatCard label="Successful" value={formatNumber(rs.successful)}
            sub={`${successRate}%`} icon={CheckCircle2} color="var(--color-success)" delay={0.05} />
          <StatCard label="Failed" value={formatNumber(rs.failed)} icon={XCircle}
            color={rs.failed > 0 ? 'var(--color-error)' : 'var(--color-text-muted)'} delay={0.07} />
          <StatCard label="Redirects" value={formatNumber(rs.redirect)} icon={RotateCcw}
            color="var(--color-warning)" delay={0.09} />
          <StatCard label="Client Errors" value={formatNumber(rs.clientError)} icon={AlertTriangle}
            color={rs.clientError > 0 ? 'var(--color-error)' : 'var(--color-text-muted)'} delay={0.11} />
          <StatCard label="Server Errors" value={formatNumber(rs.serverError)} icon={Server}
            color={rs.serverError > 0 ? 'var(--color-error)' : 'var(--color-text-muted)'} delay={0.13} />
          <StatCard label="Cached" value={formatNumber(rs.cached)} sub={`${rs.total > 0 ? ((rs.cached / rs.total) * 100).toFixed(0) : 0}%`}
            icon={Zap} color="var(--color-purple)" delay={0.15} />
          <StatCard label="Service Worker" value={formatNumber(rs.serviceWorker)} icon={Wifi}
            color="var(--color-info)" delay={0.17} />
        </div>
      </div>

      {/* 2-col layout: Transfer + Timing */}
      <div className="grid grid-cols-2 gap-6">
        {/* Transfer Summary */}
        <div>
          <SectionHeader title="Transfer Summary" />
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
            {[
              { label: 'Total Transferred', value: formatBytes(tr.totalTransferredBytes), icon: ArrowDownUp },
              { label: 'Total Decoded', value: formatBytes(tr.totalDecodedBytes), icon: HardDrive },
              { label: 'Request Headers', value: formatBytes(tr.totalRequestHeadersSize), icon: FileText },
              { label: 'Response Headers', value: formatBytes(tr.totalResponseHeadersSize), icon: FileText },
              { label: 'Request Body', value: formatBytes(tr.totalRequestBodySize), icon: FileText },
              { label: 'Response Body', value: formatBytes(tr.totalResponseBodySize), icon: FileText },
              { label: 'Compression Saved', value: formatBytes(tr.compressionSavedBytes), icon: TrendingUp },
              { label: 'Compression Rate', value: `${tr.compressionPercentage.toFixed(1)}%`, icon: Zap },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <Icon size={12} style={{ color: 'var(--color-text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timing Summary */}
        <div>
          <SectionHeader title="Timing Summary" />
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
            {[
              { label: 'Total Load Time', value: formatDuration(ts.totalLoadingTime) },
              { label: 'Average Duration', value: formatDuration(ts.avgDuration) },
              { label: 'Min Duration', value: formatDuration(ts.minDuration) },
              { label: 'Max Duration', value: formatDuration(ts.maxDuration) },
              { label: 'Median (P50)', value: formatDuration(ts.p50) },
              { label: 'P75', value: formatDuration(ts.p75) },
              { label: 'P90', value: formatDuration(ts.p90) },
              { label: 'P95', value: formatDuration(ts.p95) },
              { label: 'P99', value: formatDuration(ts.p99) },
              { label: 'Avg TTFB', value: formatDuration(ts.avgTtfb) },
              { label: 'Min TTFB', value: formatDuration(ts.minTtfb) },
              { label: 'Max TTFB', value: formatDuration(ts.maxTtfb) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resource Summary */}
      <div>
        <SectionHeader title="Resource Summary" />
        <div className="grid grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Domains" value={res.totalDomains} icon={Globe} delay={0} />
          <StatCard label="IP Addresses" value={res.totalIpAddresses} icon={Server} delay={0.04} />
          <StatCard label="MIME Types" value={res.totalMimeTypes} icon={FileText} delay={0.06} />
          <StatCard label="HTTP Methods" value={res.totalHttpMethods} icon={ArrowDownUp} delay={0.08} />
          <StatCard label="Protocols" value={res.totalProtocols} icon={Shield} delay={0.10} />
          <StatCard label="Cookies" value={res.totalCookies} icon={Zap} color="var(--color-warning)" delay={0.12} />
          <StatCard label="Redirects" value={res.totalRedirects} icon={RotateCcw} color="var(--color-warning)" delay={0.14} />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <SectionHeader title="By Method" />
          <MiniDonutChart data={statistics.methods} colorMap={{
            GET: '#10b981', POST: '#3b82f6', PUT: '#f59e0b',
            PATCH: '#f59e0b', DELETE: '#ef4444', OPTIONS: '#8b5cf6',
            HEAD: '#64748b',
          }} />
        </div>
        <div className="col-span-1">
          <SectionHeader title="By Resource Type" />
          <MiniDonutChart data={statistics.resourceTypes} colorMap={{
            document: '#06b6d4', stylesheet: '#a78bfa', script: '#f59e0b',
            image: '#ec4899', font: '#8b5cf6', media: '#ef4444',
            xhr: '#3b82f6', fetch: '#10b981', other: '#64748b',
          }} />
        </div>
        <div className="col-span-1">
          <SectionHeader title="By Protocol" />
          <MiniDonutChart data={statistics.protocols} colorMap={{
            'HTTP/1.0': '#94a3b8', 'HTTP/1.1': '#3b82f6',
            'HTTP/2': '#10b981', 'HTTP/3': '#06b6d4', 'h2': '#10b981',
          }} />
        </div>
      </div>

      {/* Timing breakdown */}
      <div>
        <SectionHeader title="Timing Breakdown (Avg per Phase)" />
        <TimingBreakdown entries={analysis.entries} />
      </div>

      {/* Request timeline */}
      <div>
        <SectionHeader title="Request Timeline (Concurrency + Transfer Rate)" />
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
          <div className="p-2">
            <RequestTimeline analysis={analysis} height={260} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-semibold tracking-wider uppercase"
        style={{ color: 'var(--color-text-muted)' }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
    </div>
  );
}
