import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Compass,
  Loader2,
  PieChart,
  RotateCcw,
  Sparkles,
  Table2,
  TrendingUp,
  X,
} from 'lucide-react';
import { ExecutiveSummaryBanner } from './components/ExecutiveSummaryBanner';
import { HeaderBar } from './components/HeaderBar';
import { InterlinkedFilterBar } from './components/InterlinkedFilterBar';
import { MainHierarchyTable } from './components/MainHierarchyTable';
import { GrowthDecompositionView } from './components/views/GrowthDecompositionView';
import { MarketStructureView } from './components/views/MarketStructureView';
import { PortfolioAndLaunchesView } from './components/views/PortfolioAndLaunchesView';
import { ShareAndMatrixView } from './components/views/ShareAndMatrixView';
import { buildTableViewData } from './lib/aggregationEngine';
import { computeScopedAnalyticsBundle } from './lib/analyticsEngine';
import { computeFacetedFilterState } from './lib/filterEngine';
import { type StoryPresetInput, useMarketStore } from './store/useMarketStore';
import type { ActiveTab } from './types/market';

const CHART_TABS: {
  id: ActiveTab;
  label: string;
  sectionsBadge: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'structure',
    label: 'Market Structure & Concentration',
    sectionsBadge: 'Sec B, H, K, M & P',
    icon: PieChart,
  },
  {
    id: 'growth',
    label: 'Growth Drivers & Movers',
    sectionsBadge: 'Sec C, F & L',
    icon: TrendingUp,
  },
  {
    id: 'share',
    label: 'Share Matrix, Shifts & Momentum',
    sectionsBadge: 'Sec D, E, G & N',
    icon: Compass,
  },
  {
    id: 'portfolio',
    label: 'Portfolio, Packs & Launches',
    sectionsBadge: 'Sec I, J & O',
    icon: Boxes,
  },
];

interface GuidedStoryStep {
  title: string;
  caption: string;
  preset: StoryPresetInput;
}

const GUIDED_STORY_STEPS: GuidedStoryStep[] = [
  {
    title: '1. Macro Scale, Where-to-Play & Revenue Fragility',
    caption:
      'MAT Aug 2026 reached EGP 320.5bn (+16.3% YoY). Review the Revenue Fragility Strip (H3), Class Attractiveness Matrix (K), and Pareto 80/20 concentration curve (H1).',
    preset: {
      period: 'mat',
      measure: 'value',
      activeTab: 'structure',
      groupBy: 'tree_product_pack',
      selections: { atc1: [], atc4: [], nfc1: [], product: [], pack: [] },
    },
  },
  {
    title: '2. Price/Mix Repricing vs Real Unit Volume',
    caption:
      'Price/mix repricing is the dominant revenue driver. Compare Volume vs Price/Mix bars (C1), Growth Contribution Waterfall (C2), and Indexed Real vs Nominal small multiples (L).',
    preset: {
      period: 'mat',
      measure: 'value',
      activeTab: 'growth',
      groupBy: 'ATC1',
    },
  },
  {
    title: '3. YTD Jan–Aug Pacing & Class Seasonality',
    caption:
      'Switching to YTD Aug 2026 highlights short-term acceleration, front-loaded summer demand in the Seasonality Pacing Index (P), and cross-metric class health (M).',
    preset: {
      period: 'ytd',
      measure: 'value',
      activeTab: 'structure',
      groupBy: 'ATC4',
    },
  },
  {
    title: '4. Share of Growth (SOM–SOG) & EI Trajectory',
    caption:
      'Identify brands punching above their weight on the SOM–SOG Matrix (N) and separate sustained multi-year outperformers from cooling leaders on the EI 25 vs EI 26 Quadrant (G3).',
    preset: {
      period: 'mat',
      measure: 'value',
      activeTab: 'share',
      groupBy: 'Product',
    },
  },
  {
    title: '5. Physical Volume Winners & Brand Ladder (Units Lens)',
    caption:
      'Switching to Units strips out inflation to reveal true patient-volume share gainers and multi-year rank climbers on the Brand Ladder Bump Chart (E3).',
    preset: {
      period: 'mat',
      measure: 'units',
      activeTab: 'share',
      groupBy: 'Product',
    },
  },
  {
    title: '6. Price Positioning, Tier Migration & 2026 Launches',
    caption:
      'Evaluate Price Index vs Units Share (O), Price-Tier Migration (I4), Brand SKU Breadth vs Hero-Pack Dependency (I5), and 2026 Launch Entry Positioning (J2).',
    preset: {
      period: 'mat',
      measure: 'value',
      activeTab: 'portfolio',
      groupBy: 'tree_product_pack',
    },
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
    applyPresetState,
  } = useMarketStore();

  const [storyStepIdx, setStoryStepIdx] = useState<number | null>(null);

  useEffect(() => {
    loadDataset();
  }, [loadDataset]);

  // Synchronize document theme class with store theme state (daylight default)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  const goToStoryStep = useCallback(
    (idx: number) => {
      const bounded = Math.max(0, Math.min(GUIDED_STORY_STEPS.length - 1, idx));
      setStoryStepIdx(bounded);
      applyPresetState(GUIDED_STORY_STEPS[bounded].preset);
    },
    [applyPresetState]
  );

  const toggleStoryMode = useCallback(() => {
    if (storyStepIdx !== null) {
      setStoryStepIdx(null);
    } else {
      goToStoryStep(0);
    }
  }, [storyStepIdx, goToStoryStep]);

  // Keyboard navigation for Story Mode (Left / Right / Escape)
  useEffect(() => {
    if (storyStepIdx === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStoryStepIdx(null);
      } else if (e.key === 'ArrowRight') {
        if (storyStepIdx < GUIDED_STORY_STEPS.length - 1) {
          goToStoryStep(storyStepIdx + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (storyStepIdx > 0) {
          goToStoryStep(storyStepIdx - 1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [storyStepIdx, goToStoryStep]);

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
  const activeStoryStep =
    storyStepIdx !== null ? GUIDED_STORY_STEPS[storyStepIdx] : null;

  return (
    <div className="min-h-screen bg-slate-50/90 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col transition-colors">
      {/* Print-Only Report Header */}
      <div className="hidden print:block px-6 py-4 border-b border-slate-300">
        <h1 className="text-lg font-bold text-slate-900">
          IQVIA Egypt Pharma Market Intelligence — Executive Brief ({period.toUpperCase()} Aug 2026 •{' '}
          {measure === 'value' ? 'LC Value EGP' : 'Units'})
        </h1>
        <p className="text-xs text-slate-600">
          Generated from interactive market explorer • Active Tab: {activeTab.toUpperCase()}
        </p>
      </div>

      {/* Sticky Top Header */}
      <HeaderBar
        storyModeActive={storyStepIdx !== null}
        onToggleStoryMode={toggleStoryMode}
      />

      {/* UX-3: Guided Story Mode Stepper Banner */}
      {activeStoryStep && storyStepIdx !== null && (
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white border-b border-indigo-500/30 no-print">
          <div className="max-w-[1680px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-slate-950 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  Story {storyStepIdx + 1} / {GUIDED_STORY_STEPS.length}
                </span>
              </span>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-bold text-white">
                  {activeStoryStep.title}
                </div>
                <p className="text-xs text-indigo-200/90 leading-snug">
                  {activeStoryStep.caption}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {GUIDED_STORY_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goToStoryStep(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === storyStepIdx
                      ? 'w-5 bg-amber-400'
                      : 'bg-indigo-400/40 hover:bg-indigo-300'
                  }`}
                  title={`Jump to step ${idx + 1}`}
                />
              ))}
              <button
                type="button"
                disabled={storyStepIdx === 0}
                onClick={() => goToStoryStep(storyStepIdx - 1)}
                className="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                disabled={storyStepIdx === GUIDED_STORY_STEPS.length - 1}
                onClick={() => goToStoryStep(storyStepIdx + 1)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setStoryStepIdx(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-indigo-200 hover:text-white ml-1"
                title="Exit Guided Story Mode (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] no-print"
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

              {activeTab === 'structure' && (
                <MarketStructureView bundle={analyticsBundle} />
              )}
              {activeTab === 'growth' && (
                <GrowthDecompositionView bundle={analyticsBundle} />
              )}
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
