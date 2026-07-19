'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Upload, FileText, Trash2, Eye, GitCompare,
  Clock, HardDrive, Globe, Zap, Shield, BarChart3,
  ChevronRight, AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { harApi } from '@/lib/api';
import { formatBytes, formatTimestamp } from '@/lib/utils';
import { useHarStore } from '@/store/har-store';

export default function HomePage() {
  const router = useRouter();
  const { harFiles, setHarFiles } = useHarStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({});
  const [polling, setPolling] = useState<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    loadFiles();
    return () => { Object.values(polling).forEach(clearInterval); };
  }, []);

  const loadFiles = async () => {
    try {
      const files = await harApi.list();
      setHarFiles(files);
    } catch {}
  };

  const pollStatus = (uuid: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await harApi.getStatus(uuid);
        setUploadProgress(p => ({ ...p, [uuid]: status.status }));
        if (status.status === 'complete' || status.status === 'error') {
          clearInterval(interval);
          setPolling(p => { const n = { ...p }; delete n[uuid]; return n; });
          await loadFiles();
          if (status.status === 'complete') {
            toast.success('Analysis complete', { description: 'HAR file processed successfully' });
          } else {
            toast.error('Analysis failed', { description: status.error });
          }
        }
      } catch { clearInterval(interval); }
    }, 1500);
    setPolling(p => ({ ...p, [uuid]: interval }));
  };

  const processFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        // Validate JSON
        JSON.parse(content);
      } catch {
        toast.error('Invalid HAR file', { description: 'File must be valid JSON' });
        return;
      }
      try {
        const res = await harApi.upload(content, file.name);
        setUploadProgress(p => ({ ...p, [res.id]: 'processing' }));
        pollStatus(res.id);
        await loadFiles();
        toast.info('Processing HAR file...', { description: file.name });
      } catch (err: any) {
        toast.error('Upload failed', { description: err.message });
      }
    };
    reader.readAsText(file);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    for (const file of acceptedFiles) await processFile(file);
    setUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.har', '.json'] },
    multiple: true,
  });

  const handleDelete = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await harApi.delete(uuid);
      await loadFiles();
      toast.success('File deleted');
    } catch (err: any) {
      toast.error('Delete failed', { description: err.message });
    }
  };

  const getStatusIcon = (uuid: string, status: string) => {
    const progress = uploadProgress[uuid] || status;
    if (progress === 'processing') return <Loader2 size={14} className="animate-spin text-blue-400" />;
    if (progress === 'complete') return <CheckCircle2 size={14} className="text-emerald-400" />;
    if (progress === 'error') return <AlertCircle size={14} className="text-red-400" />;
    return <Clock size={14} className="text-slate-500" />;
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <header className="har-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent)' }}>
              <Zap size={16} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-wider" style={{ color: 'var(--color-accent)' }}>
                HAR VIEWER
              </span>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                HTTP Archive Analyzer
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API Connected
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            HTTP Archive{' '}
            <span style={{ color: 'var(--color-accent)' }}>Analyzer</span>
          </h1>
          <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
            Deep inspection of network requests — timing waterfall, security audit, performance analysis, AI-powered insights.
          </p>
        </motion.div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {[
            { icon: BarChart3, label: 'Waterfall Chart' },
            { icon: Shield, label: 'Security Audit' },
            { icon: Zap, label: 'Performance Analysis' },
            { icon: Globe, label: 'Domain Analytics' },
            { icon: GitCompare, label: 'HAR Comparison' },
            { icon: HardDrive, label: 'AI Insights (Groq)' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <Icon size={11} style={{ color: 'var(--color-accent)' }} />
              {label}
            </span>
          ))}
        </div>

        {/* Upload zone */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          className="mb-10">
          <div {...getRootProps()} className="relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200"
            style={{
              borderColor: isDragActive ? 'var(--color-accent)' : 'var(--color-border)',
              background: isDragActive ? 'var(--color-accent-bg)' : 'var(--color-surface-1)',
              boxShadow: isDragActive ? '0 0 40px var(--color-accent-glow)' : 'none',
            }}>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center py-16 px-8 gap-4">
              <motion.div animate={{ scale: isDragActive ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 300 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: isDragActive ? 'var(--color-accent)' : 'var(--color-surface-3)' }}>
                <Upload size={28} style={{ color: isDragActive ? '#fff' : 'var(--color-accent)' }} />
              </motion.div>
              {uploading ? (
                <div className="flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-medium">Uploading and parsing...</span>
                </div>
              ) : isDragActive ? (
                <p className="text-base font-medium" style={{ color: 'var(--color-accent)' }}>
                  Drop your HAR files here
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      Drop HAR files or click to upload
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      .har or .json — multiple files supported, up to 100 MB each
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>Chrome DevTools</span>
                    <span>·</span>
                    <span>Firefox Network</span>
                    <span>·</span>
                    <span>Safari Web Inspector</span>
                    <span>·</span>
                    <span>Fiddler</span>
                    <span>·</span>
                    <span>Charles Proxy</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* File List */}
        <AnimatePresence>
          {harFiles.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Uploaded Archives ({harFiles.length})
                </h2>
                <button onClick={loadFiles} className="text-xs px-3 py-1 rounded-md transition-colors"
                  style={{ color: 'var(--color-accent)', background: 'var(--color-accent-bg)', border: '1px solid var(--color-accent-glow)' }}>
                  Refresh
                </button>
              </div>

              <div className="grid gap-2">
                {harFiles.map((file, i) => {
                  const currentStatus = uploadProgress[file.uuid] || file.status;
                  const isReady = currentStatus === 'complete';

                  return (
                    <motion.div key={file.uuid}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => isReady && router.push(`/viewer/${file.uuid}`)}
                      className="group flex items-center gap-4 p-4 rounded-xl transition-all duration-150"
                      style={{
                        background: 'var(--color-surface-1)',
                        border: '1px solid var(--color-border)',
                        cursor: isReady ? 'pointer' : 'default',
                      }}
                      onMouseEnter={e => {
                        if (isReady) {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)';
                          (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)';
                        }
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                        (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-1)';
                      }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>
                        <FileText size={16} style={{ color: 'var(--color-accent)' }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {getStatusIcon(file.uuid, currentStatus)}
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {file.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          <span>{formatBytes(file.fileSize || 0)}</span>
                          {file.entryCount > 0 && <><span>·</span><span>{file.entryCount} requests</span></>}
                          {file.browserName && <><span>·</span><span>{file.browserName} {file.browserVersion}</span></>}
                          <span>·</span>
                          <span>{formatTimestamp(file.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        {currentStatus === 'processing' && (
                          <span className="text-xs px-2 py-0.5 rounded-full animate-pulse"
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                            Processing
                          </span>
                        )}
                        {currentStatus === 'error' && (
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                            Error
                          </span>
                        )}
                        {isReady && (
                          <button onClick={() => router.push(`/viewer/${file.uuid}`)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                            style={{ background: 'var(--color-accent)', color: '#000' }}>
                            <Eye size={12} />
                            Open
                          </button>
                        )}
                        <button onClick={(e) => handleDelete(file.uuid, e)}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--color-error)', background: 'rgba(239,68,68,0.1)' }}>
                          <Trash2 size={14} />
                        </button>
                        {isReady && <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--color-accent)' }} />}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {harFiles.filter(f => f.status === 'complete').length >= 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="mt-4 p-4 rounded-xl flex items-center gap-3"
                  style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)' }}>
                  <GitCompare size={18} style={{ color: 'var(--color-accent)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Compare Mode Available
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      You have {harFiles.filter(f => f.status === 'complete').length} processed archives — open any one to access comparison mode
                    </p>
                  </div>
                  <button onClick={() => router.push('/compare')}
                    className="ml-auto text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                    style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                    <GitCompare size={12} />
                    Compare Archives
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {harFiles.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No HAR archives yet. Upload your first file above.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
