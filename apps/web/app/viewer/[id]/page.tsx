'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { toast } from 'sonner';
import { harApi, groqApi } from '@/lib/api';
import { useHarStore } from '@/store/har-store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ViewerHeader }       from '@/components/layout/ViewerHeader';
import { ViewerSidebar }      from '@/components/layout/ViewerSidebar';
import { DashboardView }      from '@/components/dashboard/DashboardView';
import { RequestTable }       from '@/components/request-table/RequestTable';
import { WaterfallView }      from '@/components/waterfall/WaterfallView';
import { FlameGraph }         from '@/components/flamegraph/FlameGraph';
import { StatisticsView }     from '@/components/charts/StatisticsView';
import { DomainsView }        from '@/components/charts/DomainsView';
import { SecurityView }       from '@/components/security/SecurityView';
import { CertificateInspector } from '@/components/security/CertificateInspector';
import { PiiScanner }         from '@/components/security/PiiScanner';
import { PerformanceView }    from '@/components/performance/PerformanceView';
import { CompareView }        from '@/components/compare/CompareView';
import { AiView }             from '@/components/groq/AiView';
import { RequestDetailPanel } from '@/components/request-detail/RequestDetailPanel';
import { SearchOverlay }      from '@/components/search/SearchOverlay';
import { Loader2, Keyboard }  from 'lucide-react';

export default function ViewerPage() {
  const params   = useParams();
  const router   = useRouter();
  const uuid     = params.id as string;
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const {
    analysis, setAnalysis, setCurrentUuid,
    activeTab, selectedEntry, detailPanelOpen,
    groqModels, setGroqModels,
  } = useHarStore();

  const [status,   setStatus]   = useState('loading');
  const [progress, setProgress] = useState(0);

  useKeyboardShortcuts();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fetchAnalysis = useCallback(async () => {
    try {
      const data = await harApi.getAnalysis(uuid);
      setAnalysis(data);
      setStatus('complete');
      if (pollingInterval) clearInterval(pollingInterval);
    } catch {}
  }, [uuid]);

  const pollStatus = useCallback(() => {
    const interval = setInterval(async () => {
      try {
        const s = await harApi.getStatus(uuid);
        setProgress(s.progress || 0);
        if (s.status === 'complete') {
          clearInterval(interval); setPollingInterval(null);
          await fetchAnalysis();
        } else if (s.status === 'error') {
          clearInterval(interval); setPollingInterval(null);
          setStatus('error');
          toast.error('Analysis failed', { description: s.error });
        }
      } catch { clearInterval(interval); }
    }, 1200);
    setPollingInterval(interval);
  }, [uuid, fetchAnalysis]);

  useEffect(() => {
    setCurrentUuid(uuid);
    (async () => {
      try {
        const s = await harApi.getStatus(uuid);
        setProgress(s.progress || 0);
        if (s.status === 'complete')     await fetchAnalysis();
        else if (s.status === 'error')   setStatus('error');
        else { setStatus('processing'); pollStatus(); }
      } catch (err: any) {
        toast.error('Connection failed', { description: err.message });
        setStatus('error');
      }
    })();
    return () => { if (pollingInterval) clearInterval(pollingInterval); };
  }, [uuid]);

  useEffect(() => {
    if (groqModels.length === 0)
      groqApi.getModels().then(setGroqModels).catch(() => {});
  }, []);

  /* ─── loading / error states ─────────────────────────────── */
  if (status === 'loading' || status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-surface-3)" strokeWidth="4" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-accent)" strokeWidth="4"
                strokeDasharray={`${213.6 * (progress / 100)} 213.6`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.5s ease' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            </div>
          </div>
          <p className="text-base font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {status === 'processing' ? 'Analyzing HAR Archive' : 'Loading…'}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {progress > 0 ? `${progress}% complete` : 'Parsing network requests…'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="text-lg mb-2" style={{ color: 'var(--color-error)' }}>Failed to load analysis</p>
          <button onClick={() => router.push('/')} className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--color-surface-2)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}>
            ← Back to uploads
          </button>
        </div>
      </div>
    );
  }

  /* ─── tab → component map ────────────────────────────────── */
  const tabContent: Record<string, React.ReactNode> = {
    dashboard:    <DashboardView      analysis={analysis} uuid={uuid} />,
    requests:     <RequestTable       uuid={uuid} analysis={analysis} />,
    waterfall:    <WaterfallView      analysis={analysis} />,
    flamegraph:   <FlameGraph         analysis={analysis} />,
    statistics:   <StatisticsView     analysis={analysis} />,
    domains:      <DomainsView        analysis={analysis} />,
    security:     <SecurityView       analysis={analysis} />,
    certificates: <CertificateInspector analysis={analysis} />,
    pii:          <PiiScanner         analysis={analysis} uuid={uuid} />,
    performance:  <PerformanceView    analysis={analysis} />,
    compare:      <CompareView        currentUuid={uuid} analysis={analysis} />,
    ai:           <AiView             uuid={uuid} analysis={analysis} />,
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--color-background)' }}>
      <ViewerHeader analysis={analysis} uuid={uuid} onSearchOpen={() => setSearchOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <ViewerSidebar />

        <PanelGroup direction="horizontal" autoSaveId="viewer-layout" className="flex-1 overflow-hidden">
          <Panel id="main-content" order={1} minSize={30} defaultSize={detailPanelOpen ? 55 : 100}>
            <div className="h-full overflow-auto">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                  className="h-full">
                  {tabContent[activeTab] || tabContent.dashboard}
                </motion.div>
              </AnimatePresence>
            </div>
          </Panel>

          <AnimatePresence>
            {detailPanelOpen && selectedEntry && (
              <>
                <PanelResizeHandle className="w-1"
                  style={{ background: 'var(--color-border)', cursor: 'col-resize' }} />
                <Panel id="detail-panel" order={2} minSize={25} defaultSize={45} maxSize={70}>
                  <motion.div
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.15 }}
                    className="h-full">
                    <RequestDetailPanel entry={selectedEntry} />
                  </motion.div>
                </Panel>
              </>
            )}
          </AnimatePresence>
        </PanelGroup>
      </div>

      <SearchOverlay analysis={analysis} open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Keyboard hint */}
      <div className="fixed bottom-3 right-3 z-40">
        <button onClick={() => setShowShortcuts(!showShortcuts)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
          style={{
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)', opacity: 0.5,
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
          <Keyboard size={12} /> Shortcuts
        </button>
        <AnimatePresence>
          {showShortcuts && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full right-0 mb-2 p-3 rounded-xl w-56"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              {[
                ['⌘K',     'Search requests'],
                ['⌘1–9',   'Switch tabs'],
                ['/',       'Focus search bar'],
                ['⌘R',     'Reset filters'],
                ['ESC',    'Close detail panel'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{desc}</span>
                  <kbd className="text-xs px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'var(--color-surface-3)', color: 'var(--color-accent)', border: '1px solid var(--color-border)' }}>
                    {key}
                  </kbd>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
