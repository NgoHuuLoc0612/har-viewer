'use client';

import { useState } from 'react';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { HarFileInfo } from '@har-viewer/shared';
import { formatBytes, formatTimestamp, copyToClipboard } from '@/lib/utils';

interface FileInfoCardProps {
  fileInfo: HarFileInfo;
}

export function FileInfoCard({ fileInfo }: FileInfoCardProps) {
  const [expanded, setExpanded] = useState(false);

  const fields = [
    { label: 'File Name', value: fileInfo.fileName },
    { label: 'File Size', value: formatBytes(fileInfo.fileSize) },
    { label: 'HAR Version', value: fileInfo.harVersion },
    { label: 'Creator', value: `${fileInfo.creatorName} ${fileInfo.creatorVersion}` },
    { label: 'Browser', value: `${fileInfo.browserName} ${fileInfo.browserVersion}` },
    { label: 'Generated', value: formatTimestamp(fileInfo.generatedTimestamp) },
    { label: 'Pages', value: fileInfo.pageCount.toString() },
    { label: 'Entries', value: fileInfo.entryCount.toString() },
    { label: 'Unique URLs', value: fileInfo.uniqueUrlCount.toString() },
    ...(expanded ? [
      { label: 'MD5', value: fileInfo.md5Hash, mono: true },
      { label: 'SHA-256', value: fileInfo.sha256Hash, mono: true },
      { label: 'File Path', value: fileInfo.filePath || '—' },
      { label: 'Export Timestamp', value: formatTimestamp(fileInfo.exportTimestamp) },
    ] : []),
  ];

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
          HAR File Information
        </span>
        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: 'var(--color-text-muted)' }}>
          {expanded ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> More</>}
        </button>
      </div>
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-px"
        style={{ background: 'var(--color-border-subtle)' }}>
        {fields.map(({ label, value, mono }) => (
          <div key={label} className="px-3 py-2.5 group"
            style={{ background: 'var(--color-surface-1)' }}>
            <div className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            <div className="flex items-center gap-1">
              <span className={`text-xs font-medium truncate ${mono ? 'mono' : ''}`}
                style={{ color: 'var(--color-text-primary)', fontFamily: mono ? 'var(--font-mono)' : undefined }}>
                {value}
              </span>
              {(mono || ['MD5', 'SHA-256', 'File Name'].includes(label)) && (
                <button
                  onClick={() => { copyToClipboard(value); toast.success('Copied!'); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0">
                  <Copy size={10} style={{ color: 'var(--color-text-muted)' }} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
