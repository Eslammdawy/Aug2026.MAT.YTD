import { create } from 'zustand';
import {
  buildIndexedMarketData,
  DIMENSION_KEYS,
  type FilterSelections,
  type IndexedMarketData,
  sanitizeAndPruneSelections,
} from '../lib/filterEngine';
import type {
  DimensionKey,
  GroupByMode,
  MarketDatasetJSON,
  MeasureType,
  PeriodType,
  ShareBasis,
} from '../types/market';

export interface PruneNotice {
  count: number;
  details: string[];
  timestamp: number;
}

export interface SavedViewPreset {
  id: string;
  name: string;
  createdAt: number;
  period: PeriodType;
  measure: MeasureType;
  groupBy: GroupByMode;
  shareBasis: ShareBasis;
  selections: FilterSelections;
}

interface MarketStoreState {
  indexed: IndexedMarketData | null;
  loading: boolean;
  error: string | null;

  // Core view state (persisted in URL)
  period: PeriodType;
  measure: MeasureType;
  groupBy: GroupByMode;
  shareBasis: ShareBasis;
  tableSearch: string;
  selections: FilterSelections;

  // Filter & UI preferences
  showUnavailableOptions: boolean;
  optionMetricDisplay: 'value' | 'count';
  theme: 'dark' | 'light';
  pruneNotice: PruneNotice | null;

  // Saved Views / Watchlists (UX-2)
  savedViews: SavedViewPreset[];

  // Actions
  loadDataset: () => Promise<void>;
  setPeriod: (period: PeriodType) => void;
  setMeasure: (measure: MeasureType) => void;
  setGroupBy: (groupBy: GroupByMode) => void;
  setShareBasis: (basis: ShareBasis) => void;
  setTableSearch: (search: string) => void;
  setShowUnavailableOptions: (show: boolean) => void;
  setOptionMetricDisplay: (mode: 'value' | 'count') => void;
  toggleTheme: () => void;
  clearPruneNotice: () => void;

  // Filter actions (interlinked + auto-prune)
  toggleFilterValue: (dim: DimensionKey, idx: number) => void;
  setDimensionSelections: (dim: DimensionKey, indices: number[]) => void;
  clearDimension: (dim: DimensionKey) => void;
  resetAllFilters: () => void;
  drillToProductsInTable: (dim: DimensionKey, idx: number) => void;

  // Watchlist preset actions
  saveCurrentView: (name: string) => SavedViewPreset | null;
  applySavedView: (id: string) => void;
  renameSavedView: (id: string, name: string) => void;
  deleteSavedView: (id: string) => void;
}

const EMPTY_SELECTIONS: FilterSelections = {
  atc1: [],
  atc4: [],
  nfc1: [],
  product: [],
  pack: [],
};

function parseIntList(param: string | null, maxLen: number): number[] {
  if (!param) return [];
  return param
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < maxLen);
}

function readInitialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored =
      localStorage.getItem('iqvia_theme') || localStorage.getItem('hpg-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return 'light';
}

const SAVED_VIEWS_STORAGE_KEY = 'iqvia_saved_views';

function readSavedViews(): SavedViewPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as SavedViewPreset[];
  } catch {}
  return [];
}

function persistSavedViews(views: SavedViewPreset[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views));
  } catch {}
}

export function buildShareUrlForPreset(state: {
  period: PeriodType;
  measure: MeasureType;
  groupBy: GroupByMode;
  shareBasis: ShareBasis;
  tableSearch?: string;
  selections: FilterSelections;
}): string {
  const params = new URLSearchParams();
  params.set('period', state.period);
  params.set('measure', state.measure);
  if (state.groupBy !== 'tree_product_pack') params.set('groupBy', state.groupBy);
  if (state.shareBasis !== 'scope') params.set('shareBasis', state.shareBasis);
  if (state.tableSearch?.trim()) params.set('q', state.tableSearch.trim());

  for (const dim of DIMENSION_KEYS) {
    if (state.selections[dim].length > 0) {
      params.set(dim, state.selections[dim].join(','));
    }
  }

  if (typeof window === 'undefined') {
    return `?${params.toString()}`;
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function readInitialUrlParams() {
  if (typeof window === 'undefined') {
    return {
      period: 'mat' as PeriodType,
      measure: 'value' as MeasureType,
      groupBy: 'tree_product_pack' as GroupByMode,
      shareBasis: 'scope' as ShareBasis,
      tableSearch: '',
    };
  }
  const params = new URLSearchParams(window.location.search);
  const p = params.get('period');
  const m = params.get('measure');
  const gb = params.get('groupBy');
  const sb = params.get('shareBasis');
  const q = params.get('q') || '';

  const period: PeriodType = p === 'ytd' ? 'ytd' : 'mat';
  const measure: MeasureType = m === 'units' ? 'units' : 'value';

  const validGroupBys: GroupByMode[] = [
    'tree_product_pack',
    'tree_full',
    'Product',
    'Pack',
    'NFC1',
    'ATC4',
    'ATC1',
  ];
  const groupBy: GroupByMode = validGroupBys.includes(gb as GroupByMode)
    ? (gb as GroupByMode)
    : 'tree_product_pack';

  const validBasis: ShareBasis[] = ['scope', 'parent', 'total'];
  const shareBasis: ShareBasis = validBasis.includes(sb as ShareBasis)
    ? (sb as ShareBasis)
    : 'scope';

  return { period, measure, groupBy, shareBasis, tableSearch: q };
}

function syncStateToUrl(state: {
  period: PeriodType;
  measure: MeasureType;
  groupBy: GroupByMode;
  shareBasis: ShareBasis;
  tableSearch: string;
  selections: FilterSelections;
}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  params.set('period', state.period);
  params.set('measure', state.measure);
  if (state.groupBy !== 'tree_product_pack') params.set('groupBy', state.groupBy);
  if (state.shareBasis !== 'scope') params.set('shareBasis', state.shareBasis);
  if (state.tableSearch.trim()) params.set('q', state.tableSearch.trim());

  for (const dim of DIMENSION_KEYS) {
    if (state.selections[dim].length > 0) {
      params.set(dim, state.selections[dim].join(','));
    }
  }

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

const initParams = readInitialUrlParams();

export const useMarketStore = create<MarketStoreState>((set, get) => ({
  indexed: null,
  loading: true,
  error: null,

  period: initParams.period,
  measure: initParams.measure,
  groupBy: initParams.groupBy,
  shareBasis: initParams.shareBasis,
  tableSearch: initParams.tableSearch,
  selections: { ...EMPTY_SELECTIONS },

  showUnavailableOptions: false,
  optionMetricDisplay: 'value',
  theme: readInitialTheme(),
  pruneNotice: null,
  savedViews: readSavedViews(),

  loadDataset: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/data/market-data.json');
      if (!res.ok) {
        throw new Error(`Failed to load market-data.json (HTTP ${res.status})`);
      }
      const dataset = (await res.json()) as MarketDatasetJSON;
      const indexed = buildIndexedMarketData(dataset);

      // Hydrate selections from URL query string if present
      const params =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams();

      const rawSelections: FilterSelections = {
        atc1: parseIntList(params.get('atc1'), dataset.dicts.atc1.length),
        atc4: parseIntList(params.get('atc4'), dataset.dicts.atc4.length),
        nfc1: parseIntList(params.get('nfc1'), dataset.dicts.nfc1.length),
        product: parseIntList(params.get('product'), dataset.dicts.product.length),
        pack: parseIntList(params.get('pack'), dataset.dicts.pack.length),
      };

      const { selections, removedCount, removedDetails } = sanitizeAndPruneSelections(
        indexed,
        rawSelections
      );

      set({
        indexed,
        loading: false,
        selections,
        pruneNotice:
          removedCount > 0
            ? { count: removedCount, details: removedDetails, timestamp: Date.now() }
            : null,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error loading dataset',
      });
    }
  },

  setPeriod: (period) => {
    set({ period });
    syncStateToUrl({ ...get(), period });
  },

  setMeasure: (measure) => {
    set({ measure });
    syncStateToUrl({ ...get(), measure });
  },

  setGroupBy: (groupBy) => {
    set({ groupBy });
    syncStateToUrl({ ...get(), groupBy });
  },

  setShareBasis: (shareBasis) => {
    set({ shareBasis });
    syncStateToUrl({ ...get(), shareBasis });
  },

  setTableSearch: (tableSearch) => {
    set({ tableSearch });
    syncStateToUrl({ ...get(), tableSearch });
  },

  setShowUnavailableOptions: (showUnavailableOptions) => {
    set({ showUnavailableOptions });
  },

  setOptionMetricDisplay: (optionMetricDisplay) => {
    set({ optionMetricDisplay });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem('iqvia_theme', next);
        localStorage.setItem('hpg-theme', next);
      } catch {}
    }
    set({ theme: next });
  },

  clearPruneNotice: () => set({ pruneNotice: null }),

  toggleFilterValue: (dim, idx) => {
    const state = get();
    if (!state.indexed) return;
    const current = state.selections[dim];
    const exists = current.includes(idx);
    const nextList = exists ? current.filter((v) => v !== idx) : [...current, idx];

    const nextSelections: FilterSelections = {
      ...state.selections,
      [dim]: nextList,
    };

    const { selections, removedCount, removedDetails } = sanitizeAndPruneSelections(
      state.indexed,
      nextSelections,
      dim
    );

    set({
      selections,
      pruneNotice:
        removedCount > 0
          ? { count: removedCount, details: removedDetails, timestamp: Date.now() }
          : state.pruneNotice,
    });
    syncStateToUrl({ ...get(), selections });
  },

  setDimensionSelections: (dim, indices) => {
    const state = get();
    if (!state.indexed) return;
    const nextSelections: FilterSelections = {
      ...state.selections,
      [dim]: indices,
    };
    const { selections, removedCount, removedDetails } = sanitizeAndPruneSelections(
      state.indexed,
      nextSelections,
      dim
    );
    set({
      selections,
      pruneNotice:
        removedCount > 0
          ? { count: removedCount, details: removedDetails, timestamp: Date.now() }
          : state.pruneNotice,
    });
    syncStateToUrl({ ...get(), selections });
  },

  clearDimension: (dim) => {
    const state = get();
    if (!state.indexed) return;
    const nextSelections: FilterSelections = {
      ...state.selections,
      [dim]: [],
    };
    const { selections, removedCount, removedDetails } = sanitizeAndPruneSelections(
      state.indexed,
      nextSelections
    );
    set({
      selections,
      pruneNotice:
        removedCount > 0
          ? { count: removedCount, details: removedDetails, timestamp: Date.now() }
          : null,
    });
    syncStateToUrl({ ...get(), selections });
  },

  resetAllFilters: () => {
    const selections: FilterSelections = {
      atc1: [],
      atc4: [],
      nfc1: [],
      product: [],
      pack: [],
    };
    set({ selections, tableSearch: '', pruneNotice: null });
    syncStateToUrl({ ...get(), selections, tableSearch: '' });
  },

  drillToProductsInTable: (dim, idx) => {
    const state = get();
    if (!state.indexed) return;
    const nextSelections: FilterSelections = {
      ...state.selections,
      [dim]: [idx],
    };
    const { selections, removedCount, removedDetails } = sanitizeAndPruneSelections(
      state.indexed,
      nextSelections,
      dim
    );
    set({
      selections,
      groupBy: 'tree_product_pack',
      pruneNotice:
        removedCount > 0
          ? { count: removedCount, details: removedDetails, timestamp: Date.now() }
          : null,
    });
    syncStateToUrl({
      ...get(),
      selections,
      groupBy: 'tree_product_pack',
    });
    if (typeof document !== 'undefined') {
      document
        .getElementById('explorer-table-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  saveCurrentView: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const state = get();
    const newPreset: SavedViewPreset = {
      id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      createdAt: Date.now(),
      period: state.period,
      measure: state.measure,
      groupBy: state.groupBy,
      shareBasis: state.shareBasis,
      selections: {
        atc1: [...state.selections.atc1],
        atc4: [...state.selections.atc4],
        nfc1: [...state.selections.nfc1],
        product: [...state.selections.product],
        pack: [...state.selections.pack],
      },
    };
    const nextViews = [newPreset, ...state.savedViews];
    persistSavedViews(nextViews);
    set({ savedViews: nextViews });
    return newPreset;
  },

  applySavedView: (id) => {
    const state = get();
    const preset = state.savedViews.find((v) => v.id === id);
    if (!preset) return;
    let nextSelections = {
      atc1: [...preset.selections.atc1],
      atc4: [...preset.selections.atc4],
      nfc1: [...preset.selections.nfc1],
      product: [...preset.selections.product],
      pack: [...preset.selections.pack],
    };
    if (state.indexed) {
      const sanitized = sanitizeAndPruneSelections(state.indexed, nextSelections);
      nextSelections = sanitized.selections;
    }
    set({
      period: preset.period,
      measure: preset.measure,
      groupBy: preset.groupBy,
      shareBasis: preset.shareBasis,
      selections: nextSelections,
      pruneNotice: null,
    });
    syncStateToUrl({
      ...get(),
      period: preset.period,
      measure: preset.measure,
      groupBy: preset.groupBy,
      shareBasis: preset.shareBasis,
      selections: nextSelections,
    });
  },

  renameSavedView: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const state = get();
    const nextViews = state.savedViews.map((v) =>
      v.id === id ? { ...v, name: trimmed } : v
    );
    persistSavedViews(nextViews);
    set({ savedViews: nextViews });
  },

  deleteSavedView: (id) => {
    const state = get();
    const nextViews = state.savedViews.filter((v) => v.id !== id);
    persistSavedViews(nextViews);
    set({ savedViews: nextViews });
  },
}));
