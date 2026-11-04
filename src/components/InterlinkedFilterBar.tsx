import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Filter,
  Hash,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  DIMENSION_KEYS,
  type FacetedFilterStateResult,
  type FilterOptionStat,
} from '../lib/filterEngine';
import { formatCompactValue } from '../lib/formatters';
import { useMarketStore } from '../store/useMarketStore';
import type { DimensionKey } from '../types/market';

const DIM_META: Record<
  DimensionKey,
  { label: string; shortLabel: string; description: string; badgeColor: string }
> = {
  atc1: {
    label: 'ATC1 Class',
    shortLabel: 'ATC1',
    description: 'Anatomical Main Group (16 classes)',
    badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  },
  atc4: {
    label: 'ATC4 Subclass',
    shortLabel: 'ATC4',
    description: 'Therapeutic/Chemical Subclass (507 classes)',
    badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
  },
  nfc1: {
    label: 'NFC1 Form',
    shortLabel: 'NFC1',
    description: 'New Form Code Dosage Form (16 forms)',
    badgeColor: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30',
  },
  product: {
    label: 'Product (Brand)',
    shortLabel: 'Product',
    description: 'Commercial Brand Name (10,161 products)',
    badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  },
  pack: {
    label: 'Pack Presentation',
    shortLabel: 'Pack',
    description: 'Strength, Form & Pack Size (8,823 packs)',
    badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  },
};

interface VirtualizedFilterDropdownProps {
  dim: DimensionKey;
  options: FilterOptionStat[];
  selectedIndices: number[];
  totalDictSize: number;
  hasOtherFiltersActive: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
}

const VirtualizedFilterDropdown: React.FC<VirtualizedFilterDropdownProps> = ({
  dim,
  options,
  selectedIndices,
  totalDictSize,
  hasOtherFiltersActive,
  isOpen,
  onToggleOpen,
  onClose,
}) => {
  const {
    measure,
    showUnavailableOptions,
    optionMetricDisplay,
    toggleFilterValue,
    setDimensionSelections,
    clearDimension,
  } = useMarketStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const parentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 80);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const availableCount = useMemo(
    () => options.reduce((acc, o) => acc + (o.available ? 1 : 0), 0),
    [options]
  );

  // Filter and sort options: selected first, then available sorted by metricValue desc, then unavailable
  const filteredOptions = useMemo(() => {
    const q = debouncedSearch;
    const list: FilterOptionStat[] = [];
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      if (!showUnavailableOptions && !o.available && !o.selected) continue;
      if (q && !o.label.toLowerCase().includes(q)) continue;
      list.push(o);
    }
    list.sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      if (a.available !== b.available) return a.available ? -1 : 1;
      return b.metricValue - a.metricValue;
    });
    return list;
  }, [options, debouncedSearch, showUnavailableOptions]);

  const rowVirtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentScrollRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const handleSelectAllFiltered = () => {
    const availableFiltered = filteredOptions
      .filter((o) => o.available)
      .map((o) => o.idx);
    const merged = Array.from(new Set([...selectedIndices, ...availableFiltered]));
    setDimensionSelections(dim, merged);
  };

  const meta = DIM_META[dim];
  const isNarrowedByOther = hasOtherFiltersActive && availableCount < totalDictSize;

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[180px]">
      <button
        type="button"
        onClick={onToggleOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
          selectedIndices.length > 0
            ? 'bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/50 text-slate-900 dark:text-white shadow-sm'
            : isNarrowedByOther
            ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/40 text-slate-800 dark:text-slate-200'
            : 'bg-slate-50 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold tracking-wide uppercase text-slate-900 dark:text-slate-100">
              {meta.label}
            </span>
            {selectedIndices.length > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                {selectedIndices.length} selected
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
            {isNarrowedByOther ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 shrink-0" />
                {availableCount.toLocaleString()} of {totalDictSize.toLocaleString()} linked
              </span>
            ) : (
              <span>{availableCount.toLocaleString()} available</span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 sm:w-[360px] mt-1.5 z-50 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-black/40 overflow-hidden">
          {/* Header & Search */}
          <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
              <span>{meta.description}</span>
              <span className="font-mono text-[10px] text-indigo-500 dark:text-indigo-400">
                OR within • AND across
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${filteredOptions.length.toLocaleString()} ${meta.shortLabel} options...`}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bulk actions */}
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px]">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                disabled={filteredOptions.filter((o) => o.available).length === 0}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40"
              >
                Select all matching ({filteredOptions.filter((o) => o.available).length.toLocaleString()})
              </button>
              <button
                type="button"
                onClick={() => clearDimension(dim)}
                disabled={selectedIndices.length === 0}
                className="font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-40"
              >
                Clear ({selectedIndices.length})
              </button>
            </div>
          </div>

          {/* Virtualized Option List */}
          <div
            ref={parentScrollRef}
            className="h-[280px] overflow-y-auto overscroll-contain px-1.5 py-1"
          >
            {filteredOptions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-xs text-slate-400">
                <p>No matching {meta.shortLabel} options found.</p>
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const opt = filteredOptions[virtualRow.index];
                  const isDisabled = !opt.available && !opt.selected;

                  return (
                    <div
                      key={opt.idx}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFilterValue(dim, opt.idx)}
                        className={`w-full h-[34px] px-2.5 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors ${
                          opt.selected
                            ? 'bg-indigo-600/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 font-semibold'
                            : isDisabled
                            ? 'opacity-45 text-slate-400 dark:text-slate-600 hover:opacity-75'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                        }`}
                        title={
                          isDisabled
                            ? `${opt.label} (0 matching rows in current filter scope — click to switch context)`
                            : `${opt.label} — ${opt.rowCount} packs`
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              opt.selected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {opt.selected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="truncate text-left">{opt.label}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                          {optionMetricDisplay === 'value'
                            ? formatCompactValue(opt.metricValue, measure, false)
                            : `${opt.rowCount.toLocaleString()} pk`}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface InterlinkedFilterBarProps {
  filterState: FacetedFilterStateResult;
}

export const InterlinkedFilterBar: React.FC<InterlinkedFilterBarProps> = ({ filterState }) => {
  const {
    indexed,
    selections,
    showUnavailableOptions,
    optionMetricDisplay,
    pruneNotice,
    setShowUnavailableOptions,
    setOptionMetricDisplay,
    toggleFilterValue,
    clearDimension,
    resetAllFilters,
    clearPruneNotice,
  } = useMarketStore();

  const [openDim, setOpenDim] = useState<DimensionKey | null>(null);

  if (!indexed) return null;
  const { dicts } = indexed.dataset;

  const totalSelectedCount = DIMENSION_KEYS.reduce(
    (acc, d) => acc + selections[d].length,
    0
  );

  return (
    <section
      aria-label="Interlinked Market Filters"
      className="bg-white dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800/80 transition-colors"
    >
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 py-3 space-y-2.5">
        {/* Top Row: Filter Label + Options Settings */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Bi-Directional Interlinked Filters
            </span>
            <span className="hidden md:inline text-slate-400 dark:text-slate-500">
              — Selecting any Product, Pack, or Class dynamically narrows all other filters in both directions
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Scope Level: {filterState.scopeAggregationLevel} (
              {filterState.matchingPackRowIndices.length.toLocaleString()} packs)
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Option Badge Display Toggle: 2026 Value/Units vs Pack Count */}
            <button
              type="button"
              onClick={() =>
                setOptionMetricDisplay(optionMetricDisplay === 'value' ? 'count' : 'value')
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/70 text-[11px]"
              title="Toggle between showing 2026 Value/Units or Pack Row Count next to each filter option"
            >
              <Hash className="w-3 h-3 text-indigo-400" />
              <span>Badge: {optionMetricDisplay === 'value' ? '2026 Sales' : 'Pack Count'}</span>
            </button>

            {/* Hide vs Grey out 0-match options */}
            <button
              type="button"
              onClick={() => setShowUnavailableOptions(!showUnavailableOptions)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/70 text-[11px]"
              title="User setting: Hide options with 0 matching rows, or show them greyed out"
            >
              {showUnavailableOptions ? (
                <>
                  <Eye className="w-3 h-3 text-amber-400" />
                  <span>0-Match: Greyed Out</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 text-emerald-400" />
                  <span>0-Match: Hidden</span>
                </>
              )}
            </button>

            {totalSelectedCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 font-semibold text-[11px] transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset all ({totalSelectedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 Interlinked Filter Dropdowns in exact required display order: ATC1, ATC4, NFC1, Product, Pack */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {DIMENSION_KEYS.map((dim) => {
            const hasOtherFiltersActive = DIMENSION_KEYS.some(
              (other) => other !== dim && selections[other].length > 0
            );
            return (
              <VirtualizedFilterDropdown
                key={dim}
                dim={dim}
                options={filterState.optionsByDim[dim]}
                selectedIndices={selections[dim]}
                totalDictSize={dicts[dim].length}
                hasOtherFiltersActive={hasOtherFiltersActive}
                isOpen={openDim === dim}
                onToggleOpen={() => setOpenDim(openDim === dim ? null : dim)}
                onClose={() => setOpenDim(null)}
              />
            );
          })}
        </div>

        {/* Active Filter Chips Bar + Auto-Prune Notice */}
        {(totalSelectedCount > 0 || pruneNotice) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {pruneNotice && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                title={pruneNotice.details.join(', ')}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {pruneNotice.count}{' '}
                  {pruneNotice.count === 1 ? 'selection' : 'selections'} removed
                </span>
                <button
                  type="button"
                  onClick={clearPruneNotice}
                  className="hover:text-amber-100 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {DIMENSION_KEYS.map((dim) => {
              const sel = selections[dim];
              if (sel.length === 0) return null;
              const meta = DIM_META[dim];
              const dict = dicts[dim];

              return (
                <div
                  key={dim}
                  className="inline-flex flex-wrap items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-0.5">
                    {meta.shortLabel}:
                  </span>
                  {sel.slice(0, 6).map((idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${meta.badgeColor}`}
                    >
                      <span className="max-w-[180px] truncate">{dict[idx]}</span>
                      <button
                        type="button"
                        onClick={() => toggleFilterValue(dim, idx)}
                        className="opacity-75 hover:opacity-100"
                        title={`Remove ${dict[idx]}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {sel.length > 6 && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                      +{sel.length - 6} more
                    </span>
                  )}
                  {sel.length > 1 && (
                    <button
                      type="button"
                      onClick={() => clearDimension(dim)}
                      className="text-[10px] text-slate-400 hover:text-rose-400 ml-1"
                      title={`Clear all ${meta.shortLabel} selections`}
                    >
                      Clear
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
