'use client';

import { ProcessedEntry } from '@har-viewer/shared';
import { BodyViewer } from '@/components/body-viewer/BodyViewer';
import { formatBytes } from '@/lib/utils';

interface ResponseBodyTabProps { entry: ProcessedEntry; }

export function ResponseBodyTab({ entry }: ResponseBodyTabProps) {
  const content = entry.rawEntry.response.content;

  if (!content?.text && content?.size === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No response body</p>
      </div>
    );
  }

  const isImage = content.mimeType?.startsWith('image/');
  const isFont = content.mimeType?.startsWith('font/') || content.mimeType?.includes('font');
  const isAudio = content.mimeType?.startsWith('audio/');
  const isVideo = content.mimeType?.startsWith('video/');
  const isBinary = !content.text && (isImage || isFont || isAudio || isVideo);

  if (isBinary && !content.text) {
    return (
      <div className="p-4">
        <div className="rounded-xl p-6 text-center"
          style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Binary content — {content.mimeType}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Size: {formatBytes(content.size)}
          </p>
          {content.comment && (
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {content.comment}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center gap-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          MIME: <span style={{ color: 'var(--color-text-secondary)' }}>{content.mimeType || 'unknown'}</span>
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Size: <span style={{ color: 'var(--color-text-secondary)' }}>{formatBytes(content.size)}</span>
        </span>
        {content.compression && content.compression > 0 && (
          <span className="text-xs" style={{ color: 'var(--color-success)' }}>
            Compressed: {formatBytes(content.compression)} saved
          </span>
        )}
        {content.encoding && (
          <span className="text-xs" style={{ color: 'var(--color-warning)' }}>
            Encoding: {content.encoding}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <BodyViewer
          content={content.text || ''}
          mimeType={content.mimeType}
          encoding={content.encoding}
          label="Response Body"
        />
      </div>
    </div>
  );
}
