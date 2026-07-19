'use client';

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { HarAnalysis, ProcessedEntry } from '@har-viewer/shared';

export type ViewTab =
  | 'dashboard' | 'requests' | 'waterfall' | 'flamegraph'
  | 'statistics' | 'domains' | 'security' | 'certificates'
  | 'pii' | 'performance' | 'compare' | 'ai';

export type DetailTab = 'general' | 'request-headers' | 'response-headers'
  | 'cookies' | 'params' | 'request-body' | 'response-body' | 'timing';

export interface FilterState {
  search: string;
  searchFields: string[];
  method: string;
  status: string;
  domain: string;
  resourceType: string;
  mimeType: string;
  protocol: string;
  minDuration: number | undefined;
  maxDuration: number | undefined;
  minSize: number | undefined;
  maxSize: number | undefined;
  cacheStatus: string;
  https: boolean | undefined;
  regex: boolean;
}

const defaultFilters: FilterState = {
  search: '', searchFields: ['url', 'domain', 'path'], method: '', status: '',
  domain: '', resourceType: '', mimeType: '', protocol: '',
  minDuration: undefined, maxDuration: undefined,
  minSize: undefined, maxSize: undefined,
  cacheStatus: '', https: undefined, regex: false,
};

const defaultColumnVisibility: Record<string, boolean> = {
  index: true, method: true, status: true, domain: true, path: true,
  resourceType: true, mimeType: false, duration: true, ttfb: false,
  transferredSize: true, protocol: false, cacheStatus: false, waterfall: true,
};

export interface HarViewerState {
  harFiles: any[];
  setHarFiles: (files: any[]) => void;
  currentUuid: string | null;
  setCurrentUuid: (uuid: string | null) => void;
  analysis: HarAnalysis | null;
  setAnalysis: (analysis: HarAnalysis | null) => void;
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  activeDetailTab: DetailTab;
  setActiveDetailTab: (tab: DetailTab) => void;
  selectedEntry: ProcessedEntry | null;
  setSelectedEntry: (entry: ProcessedEntry | null) => void;
  detailPanelOpen: boolean;
  setDetailPanelOpen: (open: boolean) => void;
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  waterfallZoom: [number, number];
  setWaterfallZoom: (zoom: [number, number]) => void;
  waterfallHighlight: number | null;
  setWaterfallHighlight: (index: number | null) => void;
  compareUuidA: string | null;
  compareUuidB: string | null;
  setCompareUuids: (a: string | null, b: string | null) => void;
  comparisonResult: any | null;
  setComparisonResult: (result: any | null) => void;
  groqModel: string;
  setGroqModel: (model: string) => void;
  groqModels: any[];
  setGroqModels: (models: any[]) => void;
  aiChatHistory: Array<{ role: string; content: string }>;
  addAiMessage: (msg: { role: string; content: string }) => void;
  clearAiHistory: () => void;
  loading: Record<string, boolean>;
  setLoading: (key: string, value: boolean) => void;
  showMilliseconds: boolean;
  setShowMilliseconds: (v: boolean) => void;
  columnVisibility: Record<string, boolean>;
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
}

export const useHarStore = create<HarViewerState>()(
  devtools(
    subscribeWithSelector((set) => ({
      harFiles: [], setHarFiles: (files) => set({ harFiles: files }),
      currentUuid: null, setCurrentUuid: (uuid) => set({ currentUuid: uuid }),
      analysis: null, setAnalysis: (analysis) => set({ analysis }),
      activeTab: 'dashboard', setActiveTab: (tab) => set({ activeTab: tab }),
      activeDetailTab: 'general', setActiveDetailTab: (tab) => set({ activeDetailTab: tab }),
      selectedEntry: null, setSelectedEntry: (entry) => set({ selectedEntry: entry }),
      detailPanelOpen: false, setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
      filters: { ...defaultFilters },
      setFilters: (filters) => set(state => ({ filters: { ...state.filters, ...filters } })),
      resetFilters: () => set({ filters: { ...defaultFilters } }),
      waterfallZoom: [0, 100], setWaterfallZoom: (zoom) => set({ waterfallZoom: zoom }),
      waterfallHighlight: null, setWaterfallHighlight: (index) => set({ waterfallHighlight: index }),
      compareUuidA: null, compareUuidB: null,
      setCompareUuids: (a, b) => set({ compareUuidA: a, compareUuidB: b }),
      comparisonResult: null, setComparisonResult: (result) => set({ comparisonResult: result }),
      groqModel: 'llama-3.3-70b-versatile', setGroqModel: (model) => set({ groqModel: model }),
      groqModels: [], setGroqModels: (models) => set({ groqModels: models }),
      aiChatHistory: [],
      addAiMessage: (msg) => set(state => ({ aiChatHistory: [...state.aiChatHistory, msg] })),
      clearAiHistory: () => set({ aiChatHistory: [] }),
      loading: {}, setLoading: (key, value) => set(state => ({ loading: { ...state.loading, [key]: value } })),
      showMilliseconds: true, setShowMilliseconds: (v) => set({ showMilliseconds: v }),
      columnVisibility: { ...defaultColumnVisibility },
      setColumnVisibility: (visibility) => set({ columnVisibility: visibility }),
    })),
    { name: 'HAR Viewer' }
  )
);
