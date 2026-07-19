'use client';
import { useEffect } from 'react';
import { useHarStore, ViewTab } from '@/store/har-store';

const TAB_KEYS: Record<string, ViewTab> = {
  '1': 'dashboard',  '2': 'requests',    '3': 'waterfall',
  '4': 'flamegraph', '5': 'statistics',  '6': 'domains',
  '7': 'security',   '8': 'performance', '9': 'ai',
};

export function useKeyboardShortcuts() {
  const { setActiveTab, setDetailPanelOpen, resetFilters } = useHarStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && TAB_KEYS[e.key]) {
        e.preventDefault();
        setActiveTab(TAB_KEYS[e.key]);
        return;
      }
      if (e.key === 'Escape') { setDetailPanelOpen(false); return; }
      if (e.key === '/') {
        e.preventDefault();
        (document.querySelector('input[placeholder*="Search"]') as HTMLInputElement)?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') { e.preventDefault(); resetFilters(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTab, setDetailPanelOpen, resetFilters]);
}
