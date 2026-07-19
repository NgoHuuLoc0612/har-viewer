'use client';

import { ProcessedEntry } from '@har-viewer/shared';
import { BodyViewer } from '@/components/body-viewer/BodyViewer';

interface RequestBodyTabProps { entry: ProcessedEntry; }

export function RequestBodyTab({ entry }: RequestBodyTabProps) {
  const postData = entry.rawEntry.request.postData;
  if (!postData?.text && !postData?.params?.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          No request body
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Content-Type: <span style={{ color: 'var(--color-text-secondary)' }}>{postData.mimeType || 'unknown'}</span>
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <BodyViewer
          content={postData.text || ''}
          mimeType={postData.mimeType}
          label="Request Body"
        />
      </div>
    </div>
  );
}
