'use client';

import { motion } from 'framer-motion';
import {
  LayoutDashboard, List, BarChart2, PieChart, Globe,
  Shield, Zap, GitCompare, Bot, Network, Flame, Lock, ScanSearch
} from 'lucide-react';
import { useHarStore, ViewTab } from '@/store/har-store';

const NAV_ITEMS: { tab: ViewTab; icon: React.ElementType; label: string }[] = [
  { tab: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { tab: 'requests',     icon: List,            label: 'Requests' },
  { tab: 'waterfall',    icon: Network,         label: 'Waterfall' },
  { tab: 'flamegraph',   icon: Flame,           label: 'Flame Graph' },
  { tab: 'statistics',   icon: BarChart2,       label: 'Statistics' },
  { tab: 'domains',      icon: Globe,           label: 'Domains' },
  { tab: 'security',     icon: Shield,          label: 'Security' },
  { tab: 'certificates', icon: Lock,            label: 'Certificates' },
  { tab: 'pii',          icon: ScanSearch,      label: 'PII Scanner' },
  { tab: 'performance',  icon: Zap,             label: 'Performance' },
  { tab: 'compare',      icon: GitCompare,      label: 'Compare' },
  { tab: 'ai',           icon: Bot,             label: 'AI Analysis' },
];

export function ViewerSidebar() {
  const { activeTab, setActiveTab, analysis } = useHarStore();

  const getBadge = (tab: ViewTab): string | undefined => {
    if (!analysis) return undefined;
    if (tab === 'performance') {
      const n = (analysis.performance?.slowRequests?.length || 0) +
        (analysis.performance?.largeResources?.length || 0) +
        (analysis.performance?.duplicateRequests?.length || 0);
      return n > 0 ? String(n) : undefined;
    }
    if (tab === 'security') {
      const n = (analysis.security?.insecureRequests || 0) +
        (analysis.security?.cookieSecurityIssues?.length || 0) +
        (analysis.security?.mixedContent || 0);
      return n > 0 ? String(n) : undefined;
    }
    return undefined;
  };

  return (
    <nav className="flex-shrink-0 flex flex-col py-2 px-1.5 gap-0.5"
      style={{
        width: 52,
        background: 'var(--color-surface-0)',
        borderRight: '1px solid var(--color-border)',
        overflowY: 'auto',
      }}>
      {NAV_ITEMS.map(({ tab, icon: Icon, label }) => {
        const badge = getBadge(tab);
        const active = activeTab === tab;
        return (
          <div key={tab} className="relative group">
            <button
              onClick={() => setActiveTab(tab)}
              className="relative w-full flex flex-col items-center justify-center gap-0.5 rounded-lg p-2 transition-all"
              style={{
                background: active ? 'var(--color-accent-bg)' : 'transparent',
                border: active ? '1px solid var(--color-accent-glow)' : '1px solid transparent',
                minHeight: 36,
              }}
              title={label}>
              <Icon size={15} style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }} />
              {badge && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--color-error)', color: '#fff', fontSize: 8, fontWeight: 700 }}>
                  {parseInt(badge) > 9 ? '9+' : badge}
                </span>
              )}
              {active && (
                <motion.div layoutId="sidebar-indicator"
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r"
                  style={{ background: 'var(--color-accent)' }} />
              )}
            </button>
            {/* Tooltip */}
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-xs
              whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity"
              style={{
                background: 'var(--color-surface-3)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}>
              {label}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
