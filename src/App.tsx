import React, { useEffect, useMemo } from 'react';
import {
  AlertOctagon,
  Boxes,
  Compass,
  Loader2,
  RotateCcw,
  Table2,
} from 'lucide-react';
import { ExecutiveSummaryBanner } from './components/ExecutiveSummaryBanner';
import { HeaderBar } from './components/HeaderBar';
import { InterlinkedFilterBar } from './components/InterlinkedFilterBar';
import { MainHierarchyTable } from './components/MainHierarchyTable';
import { PortfolioAndLaunchesView } from './components/views/PortfolioAndLaunchesView';
import { ShareAndMatrixView } from './components/views/ShareAndMatrixView';
import { buildTableViewData } from './lib/aggregationEngine';
import { computeScopedAnalyticsBundle } from './lib/analyticsEngine';
import { computeFacetedFilterState } from './lib/filterEngine';
import { useMarketStore } from './store/useMarketStore';
import type { ActiveTab } from './types/market';

const CHART_TABS: {
  id: ActiveTab;
  label: string;
  sectionsBadge: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'share',
    label: 'Share Matrix, Shifts & Momentum',
    sectionsBadge: 'Sec D, E & G',
    icon: Compass,
  },
  {
    id: 'portfolio',
    label: 'Portfolio, Packs & Launches',
    sectionsBadge: 'Sec I & J',
    icon: Boxes,
  },
];

export const App: React.FC = () => {
  const {
    indexed,
    loading,
    error,
    period,
    measure,
    activeTab,
    groupBy,
    selections,
    theme,
    loadDataset,
    setActiveTab,
    resetAllFilters,
  } = useMarketStore();

  useEffect(() => {
    loadDataset();
  }, [loadDataset]);

  // Synchronize document theme class with store theme state (daylight default)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // 1. Compute bi-directional interlinked filter state + matching scope rows
  const filterState = useMemo(() => {
    if (!indexed) return null;
    return computeFacetedFilterState(indexed, selections, period, measure);
  }, [indexed, selections, period, measure]);

  // 2. Compute Main Table view data for active groupBy mode
  const tableData = useMemo(() => {
    if (!indexed || !filterState) return null;
    return buildTableViewData(indexed, filterState, period, measure, groupBy);
  }, [indexed, filterState, period, measure, groupBy]);

  // 3. Compute Complete Scoped Analytics Bundle for Sections
  const analyticsBundle = useMemo(() => {
    if (!indexed || !filterState) return null;
    return computeScopedAnalyticsBundle(indexed, filterState, period, measure);
  }, [indexed, filterState, period, measure]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Loading IQVIA Egypt Pharma Market Dataset…
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Indexing 28,410 hierarchical rows (10,161 Products • 8,823 Packs • 507 ATC4s)
        </p>
      </div>
    );
  }

  if (error || !indexed || !filterState || !tableData || !analyticsBundle) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 shadow-xl">
          <AlertOctagon className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Failed to Load Market Dataset
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {error || 'Unknown error initializing market data.'}
          </p>
          <p className="text-[11px] font-mono text-slate-400 mt-3">
            Run <code>npm run preprocess</code> to generate{' '}
            <code>/public/data/market-data.json</code>.
          </p>
          <button
            type="button"
            onClick={() => loadDataset()}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const isEmptyScope = filterState.matchingPackRowIndices.length === 0;

  return (
    <div className="min-h-screen bg-slate-50/90 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col transition-colors">
      {/* Sticky Top Header */}
      <HeaderBar />

      {/* Filter Bar */}
      <InterlinkedFilterBar filterState={filterState} />

      {/* Section A: Persistent Executive Summary Banner + Auto-Generated Insights */}
      <ExecutiveSummaryBanner
        executive={analyticsBundle.executive}
        newProductsCount={analyticsBundle.newProducts.length}
        newPacksCount={analyticsBundle.newPacks.length}
      />

      {/* Main Content Area: Top Explorer Table + Bottom Charts Section */}
      <main className="max-w-[1680px] w-full mx-auto px-4 sm:px-6 py-3 flex-1 space-y-6">
        {/* Empty State if Filters Result in 0 Rows */}
        {isEmptyScope ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              No products or packs match the current filter combination.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          <>
            {/* 1. Top Standalone Explorer Table Section */}
            <section
              id="explorer-table-section"
              aria-label="Explorer Table (Product > Pack)"
              className="space-y-2.5 scroll-mt-20"
            >
              <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                    <Table2 className="w-4 h-4 shrink-0" />
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Explorer Table (Product &gt; Pack)
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20">
                    Core Table
                  </span>
                </div>
              </div>

              <MainHierarchyTable tableData={tableData} />
            </section>

            {/* 2. Bottom Charts & Visual Analytics Section */}
            <section
              aria-label="Interactive Charts and Market Analytics"
              className="space-y-4 pt-2 border-t border-slate-200/90 dark:border-slate-800/80"
            >
              {/* Chart View Tabs */}
              <nav
                aria-label="Analytics Views Navigation"
                className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                {CHART_TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{t.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t.sectionsBadge}
                      </span>
                    </button>
                  );
                })}
              </nav>

              {activeTab === 'share' && (
                <ShareAndMatrixView bundle={analyticsBundle} />
              )}
              {activeTab === 'portfolio' && (
                <PortfolioAndLaunchesView bundle={analyticsBundle} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
