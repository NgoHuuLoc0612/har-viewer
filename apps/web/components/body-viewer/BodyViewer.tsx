'use client';

import { useState, useMemo } from 'react';
import { Copy, WrapText } from 'lucide-react';
import { toast } from 'sonner';
import JsonView from '@uiw/react-json-view';
import { darkTheme } from '@uiw/react-json-view/dark';
import { copyToClipboard, isJsonString } from '@/lib/utils';
import { parseMimeFrontend } from '@/lib/enrichment';

type ViewMode = 'pretty' | 'raw' | 'hex' | 'base64' | 'preview';

interface BodyViewerProps {
  content: string;
  mimeType?: string;
  encoding?: string;
  label?: string;
}

function HexViewer({ content }: { content: string }) {
  const bytes = useMemo(() => {
    const buf: number[] = [];
    for (let i = 0; i < Math.min(content.length, 8192); i++) buf.push(content.charCodeAt(i) & 0xff);
    return buf;
  }, [content]);

  const rows: { offset: number; hex: string; ascii: string }[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const row = bytes.slice(i, i + 16);
    rows.push({
      offset: i,
      hex: row.map(b => b.toString(16).padStart(2, '0')).join(' ').padEnd(47),
      ascii: row.map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join(''),
    });
  }

  return (
    <div className="p-3 overflow-auto" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      {rows.map(({ offset, hex, ascii }) => (
        <div key={offset} className="flex gap-4 py-0.5 hover:bg-slate-800/30">
          <span style={{ color: 'var(--color-text-muted)', userSelect: 'none', minWidth: 64 }}>
            {offset.toString(16).padStart(8, '0')}
          </span>
          <span style={{ color: '#10b981', flex: 1 }}>{hex}</span>
          <span style={{ color: '#94a3b8' }}>{ascii}</span>
        </div>
      ))}
      {content.length > 8192 && (
        <div className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Showing first 8 KB of {(content.length / 1024).toFixed(1)} KB
        </div>
      )}
    </div>
  );
}

function ImagePreview({ content, mimeType }: { content: string; mimeType: string }) {
  const [error, setError] = useState(false);
  const src = content.startsWith('data:')
    ? content
    : `data:${mimeType};base64,${content}`;
  return (
    <div className="flex flex-col items-center p-4 gap-3">
      {!error ? (
        <img src={src} alt="Response preview" onError={() => setError(true)}
          className="max-w-full max-h-80 rounded-lg shadow"
          style={{ border: '1px solid var(--color-border)' }} />
      ) : (
        <div className="text-xs py-6" style={{ color: 'var(--color-text-muted)' }}>
          Failed to render image preview
        </div>
      )}
    </div>
  );
}

export function BodyViewer({ content, mimeType, encoding, label }: BodyViewerProps) {
  const mimeInfo = useMemo(() => parseMimeFrontend(mimeType || ''), [mimeType]);
  const [wrap, setWrap] = useState(true);

  const decodedContent = useMemo(() => {
    if (encoding === 'base64') {
      try { return atob(content); } catch { return content; }
    }
    return content;
  }, [content, encoding]);

  const parsedJson = useMemo(() => {
    if (mimeInfo.isJson || isJsonString(decodedContent)) {
      try { return JSON.parse(decodedContent); } catch { return null; }
    }
    return null;
  }, [decodedContent, mimeInfo.isJson]);

  const defaultMode: ViewMode = useMemo(() => {
    if (parsedJson !== null) return 'pretty';
    if (mimeInfo.isImage) return 'preview';
    return 'raw';
  }, [parsedJson, mimeInfo.isImage]);

  const [mode, setMode] = useState<ViewMode>(defaultMode);

  const availableModes = useMemo<ViewMode[]>(() => {
    const modes: ViewMode[] = [];
    if (parsedJson !== null) modes.push('pretty');
    modes.push('raw');
    if (mimeInfo.isImage) modes.push('preview');
    if (mimeInfo.isHtml) modes.push('preview');
    modes.push('hex');
    if (encoding === 'base64') modes.push('base64');
    return modes;
  }, [parsedJson, mimeInfo, encoding]);

  if (!content) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No body content</p>
      </div>
    );
  }

  const byteSize = new Blob([decodedContent]).size;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-1">
          {availableModes.map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="text-xs px-2 py-0.5 rounded capitalize transition-colors"
              style={{
                background: mode === m ? 'var(--color-accent-bg)' : 'transparent',
                border: `1px solid ${mode === m ? 'var(--color-accent)' : 'transparent'}`,
                color: mode === m ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}>
              {m === 'pretty' ? (mimeInfo.isJson ? '{ } Tree' : 'Pretty') : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* MIME badge */}
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-surface-3)', color: mimeInfo.color }}>
            {mimeInfo.emoji} {mimeInfo.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {byteSize >= 1024 ? `${(byteSize / 1024).toFixed(1)} KB` : `${byteSize} B`}
          </span>
          <button onClick={() => setWrap(!wrap)} title="Toggle wrap"
            className="p-1 rounded transition-colors"
            style={{ color: wrap ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
            <WrapText size={12} />
          </button>
          <button onClick={() => { copyToClipboard(decodedContent); toast.success('Body copied'); }}
            className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
            <Copy size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* JSON Tree via @uiw/react-json-view */}
        {mode === 'pretty' && parsedJson !== null && (
          <div className="p-3" style={{ background: 'transparent' }}>
            <JsonView
              value={parsedJson}
              style={{
                ...darkTheme,
                '--w-rjv-background-color': 'transparent',
                '--w-rjv-font-size': '12px',
                '--w-rjv-font-family': 'var(--font-mono)',
                '--w-rjv-line-height': '1.7',
                '--w-rjv-color': '#e2e8f0',
                '--w-rjv-key-string': '#10b981',
                '--w-rjv-info-color': '#64748b',
                '--w-rjv-type-string-color': '#06b6d4',
                '--w-rjv-type-int-color': '#f59e0b',
                '--w-rjv-type-float-color': '#f59e0b',
                '--w-rjv-type-boolean-color': '#8b5cf6',
                '--w-rjv-type-null-color': '#94a3b8',
                '--w-rjv-curlybraces-color': '#64748b',
                '--w-rjv-brackets-color': '#64748b',
                '--w-rjv-colon-color': '#64748b',
                '--w-rjv-arrow-color': '#475569',
              } as any}
              collapsed={3}
              displayDataTypes={false}
              enableClipboard
            />
          </div>
        )}

        {/* Image preview */}
        {mode === 'preview' && mimeInfo.isImage && (
          <ImagePreview content={content} mimeType={mimeType || ''} />
        )}

        {/* HTML preview */}
        {mode === 'preview' && mimeInfo.isHtml && (
          <div style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
            {/* Sandboxed preview — JS inside may log SecurityErrors for localStorage/cookies (expected) */}
            <div style={{
              padding: '3px 10px', fontSize: 11,
              background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
              borderBottom: '1px solid var(--color-border)', flexShrink: 0,
            }}>
              🔒 Sandboxed preview — scripts run isolated, storage APIs disabled
            </div>
            <iframe
              srcDoc={decodedContent}
              sandbox="allow-scripts allow-forms allow-popups"
              className="w-full border-0 flex-1"
              style={{ minHeight: 380 }}
              title="HTML Preview"
              onError={() => {/* suppress iframe load errors */}}
            />
          </div>
        )}

        {/* Hex viewer */}
        {mode === 'hex' && <HexViewer content={decodedContent} />}

        {/* Base64 raw */}
        {mode === 'base64' && (
          <pre className="p-3 text-xs overflow-auto"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
              whiteSpace: wrap ? 'pre-wrap' : 'pre', wordBreak: wrap ? 'break-all' : 'normal' }}>
            {content}
          </pre>
        )}

        {/* Raw / formatted text */}
        {mode === 'raw' && (
          <pre className="p-3 text-xs overflow-auto"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)',
              whiteSpace: wrap ? 'pre-wrap' : 'pre', wordBreak: wrap ? 'break-all' : 'normal',
              lineHeight: 1.65 }}>
            {mimeInfo.isJson ? (() => {
              try { return JSON.stringify(JSON.parse(decodedContent), null, 2); } catch { return decodedContent; }
            })() : decodedContent}
          </pre>
        )}
      </div>
    </div>
  );
}
