import React, { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Package,
  Pin,
  PinOff,
  Sparkles,
} from 'lucide-react';
import type { ExecutiveSummaryData, PeriodKpiSummary } from '../lib/analyticsEngine';
import {
  formatCompactValue,
  formatDecimalPct,
  formatExactValue,
  formatGrowthMetric,
  formatPp,
  formatPriceEgp,
} from '../lib/formatters';
import { useMarketStore } from '../store/useMarketStore';

interface ExecutiveSummaryBannerProps {
  executive: ExecutiveSummaryData;
  newProductsCount: number;
  newPacksCount: number;
}

interface PinnedSnapshot {
  label: string;
  period: 'mat' | 'ytd';
  summary: PeriodKpiSummary;
  newProductsCount: number;
  pinnedAt: string;
}

const GrowthBadge: React.FC<{
  text: string;
  positive: boolean | null;
  label?: string;
}> = ({ text, positive, label }) => {
  const colorClass =
    positive === null
      ? 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300 border-slate-200 dark:border-slate-500/30'
      : positive
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-semibold border ${colorClass}`}
    >
      {positive === true && <ArrowUpRight className="w-3 h-3 shrink-0" />}
      {positive === false && <ArrowDownRight className="w-3 h-3 shrink-0" />}
      <span>{text}</span>
      {label && <span className="text-[10px] opacity-75 ml-0.5 font-sans">{label}</span>}
    </span>
  );
};

export const ExecutiveSummaryBanner: React.FC<ExecutiveSummaryBannerProps> = ({
  executive,
  newProductsCount,
}) => {
  const { period, selections, indexed } = useMarketStore();

  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [pinnedSnapshot, setPinnedSnapshot] = useState<PinnedSnapshot | null>(null);

  const hasActiveFilters =
    selections.atc1.length > 0 ||
    selections.atc4.length > 0 ||
    selections.nfc1.length > 0 ||
    selections.product.length > 0 ||
    selections.pack.length > 0;

  useEffect(() => {
    if (hasActiveFilters) {
      setIsInsightsOpen(true);
    }
  }, [hasActiveFilters]);

  const active: PeriodKpiSummary = period === 'mat' ? executive.mat : executive.ytd;
  const activeLabel = period === 'mat' ? 'MAT Aug 2026' : 'YTD Aug 2026';

  const valGrowthPos =
    active.valueGrowth26.raw !== null ? active.valueGrowth26.raw >= 0 : null;
  const unitGrowthPos =
    active.unitsGrowth26.raw !== null ? active.unitsGrowth26.raw >= 0 : null;

  const buildScopeLabel = (): string => {
    const dicts = indexed?.dataset.dicts;
    if (!dicts || !hasActiveFilters) return `All Egypt (${activeLabel})`;
    const parts: string[] = [];
    if (selections.atc1.length > 0) {
      parts.push(dicts.atc1[selections.atc1[0]]?.split(' ')[0] || 'ATC1');
    }
    if (selections.atc4.length > 0) {
      parts.push(dicts.atc4[selections.atc4[0]]?.slice(0, 18) || 'ATC4');
    }
    if (selections.nfc1.length > 0) {
      parts.push(dicts.nfc1[selections.nfc1[0]]?.slice(0, 14) || 'NFC1');
    }
    if (selections.product.length > 0) {
      parts.push(
        selections.product.length === 1
          ? dicts.product[selections.product[0]]
          : `${selections.product.length} Brands`
      );
    }
    if (selections.pack.length > 0) {
      parts.push(`${selections.pack.length} Packs`);
    }
    return `${parts.join(' · ')} (${period.toUpperCase()}26)`;
  };

  const handlePinSnapshot = () => {
    setPinnedSnapshot({
      label: buildScopeLabel(),
      period,
      summary: { ...active },
      newProductsCount,
      pinnedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  return (
    <section
      aria-label="Executive Market Summary"
      className="max-w-[1680px] mx-auto px-4 sm:px-6 pt-4 pb-2 space-y-3"
    >
      {/* 3 Core KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Market Value (LC = EGP) + Growth + 2-yr CAGR */}
        <div
          className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_12px_-3px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between"
          title={`Exact ${activeLabel} Value: ${formatExactValue(active.value26, 'value')} | 2025: ${formatExactValue(active.value25, 'value')} | 2024: ${formatExactValue(active.value24, 'value')}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {activeLabel} LC Value
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                {formatCompactValue(active.value26, 'value', true)}
              </span>
              <GrowthBadge
                text={formatGrowthMetric(active.valueGrowth26)}
                positive={valGrowthPos}
                label="YoY"
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>2-yr CAGR, Aug-24 to Aug-26:</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {formatGrowthMetric(active.valueCagr24_26)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Units Volume + Growth + 2-yr CAGR (Always juxtaposed next to Value) */}
        <div
          className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_12px_-3px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between"
          title={`Exact ${activeLabel} Units: ${formatExactValue(active.units26, 'units')} | 2025: ${formatExactValue(active.units25, 'units')} | 2024: ${formatExactValue(active.units24, 'units')}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {activeLabel} Units Volume
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                {formatCompactValue(active.units26, 'units', false)}
              </span>
              <GrowthBadge
                text={formatGrowthMetric(active.unitsGrowth26)}
                positive={unitGrowthPos}
                label="YoY"
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>2-yr CAGR, Aug-24 to Aug-26:</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {formatGrowthMetric(active.unitsCagr24_26)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Products & Packs Portfolio Scope */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_12px_-3px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Products & Packs
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-500/20">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                {active.activeProductsCount.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Products
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-lg font-bold font-mono text-cyan-600 dark:text-cyan-400">
                {active.activePacksCount.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Packs
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>Avg Packs per Brand:</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {active.activeProductsCount > 0
                  ? (active.activePacksCount / active.activeProductsCount).toFixed(2)
                  : '0.00'}{' '}
                packs/prod
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Auto-Generated Key Insights Strip (QW-2) + Price/Mix Summary + Pin Snapshot (UX-6) */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsInsightsOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            aria-expanded={isInsightsOpen}
          >
            <span className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span>Key insights ({executive.insights.length})</span>
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                Filtered Scope
              </span>
            )}
            {isInsightsOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/25 font-mono"
              title="Implied Price/Mix Growth = (1 + Value Growth) / (1 + Units Growth) - 1"
            >
              Implied Price/Mix: <strong>{formatDecimalPct(active.priceMixGrowth26, 1)}</strong>
            </span>
            <span
              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono"
              title="Scope Weighted Average Pack Price = Total LC Value / Total Units"
            >
              Avg Pack Price:{' '}
              <strong>
                {formatPriceEgp(active.avgPrice25)} → {formatPriceEgp(active.avgPrice26)}
              </strong>
            </span>

            {/* UX-6: Pin Snapshot A/B Action */}
            {pinnedSnapshot ? (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePinSnapshot}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 font-semibold transition-colors"
                  title="Update pinned baseline snapshot to current scope"
                >
                  <Pin className="w-3 h-3" />
                  <span>Re-pin Snapshot</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPinnedSnapshot(null)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 font-semibold transition-colors"
                  title="Clear pinned A/B comparison snapshot"
                >
                  <PinOff className="w-3 h-3" />
                  <span>Unpin</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePinSnapshot}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-semibold transition-colors"
                title="Pin current scope metrics as baseline A to compare against another filter selection B"
              >
                <Pin className="w-3 h-3 text-indigo-500" />
                <span>Pin Snapshot (A/B)</span>
              </button>
            )}
          </div>
        </div>

        {isInsightsOpen && executive.insights.length > 0 && (
          <div className="px-4 pb-3 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 text-xs text-slate-700 dark:text-slate-300">
              {executive.insights.map((sentence, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 leading-relaxed"
                >
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{sentence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* UX-6: Pinned Scope Snapshot A/B Comparison Strip */}
      {pinnedSnapshot && (
        <div className="px-4 py-2.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/90 dark:border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white">
              <Pin className="w-2.5 h-2.5" />
              Snapshot A/B Compare
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Baseline A: <span className="text-indigo-700 dark:text-indigo-300">{pinnedSnapshot.label}</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Current B: <span className="text-emerald-700 dark:text-emerald-300">{buildScopeLabel()}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            {/* Value comparison */}
            <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 font-sans mr-1">2026 Value:</span>
              <span className="text-slate-600 dark:text-slate-400">
                {formatCompactValue(pinnedSnapshot.summary.value26, 'value')}
              </span>
              <span className="mx-1 text-slate-400">→</span>
              <strong className="text-slate-900 dark:text-white">
                {formatCompactValue(active.value26, 'value')}
              </strong>
              {pinnedSnapshot.summary.value26 > 0 && (
                <span className="ml-1.5 text-indigo-600 dark:text-indigo-400">
                  ({((active.value26 / pinnedSnapshot.summary.value26) * 100).toFixed(1)}% of A)
                </span>
              )}
            </div>

            {/* Value Growth delta */}
            <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 font-sans mr-1">Val Growth:</span>
              <span>{formatGrowthMetric(pinnedSnapshot.summary.valueGrowth26)}</span>
              <span className="mx-1 text-slate-400">→</span>
              <strong>{formatGrowthMetric(active.valueGrowth26)}</strong>
              {pinnedSnapshot.summary.valueGrowth26.raw !== null &&
                active.valueGrowth26.raw !== null && (
                  <span
                    className={`ml-1.5 font-bold ${
                      active.valueGrowth26.raw - pinnedSnapshot.summary.valueGrowth26.raw >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    (
                    {formatPp(
                      (active.valueGrowth26.raw - pinnedSnapshot.summary.valueGrowth26.raw) * 100,
                      1
                    )}
                    )
                  </span>
                )}
            </div>

            {/* Units Growth delta */}
            <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 font-sans mr-1">Units Growth:</span>
              <span>{formatGrowthMetric(pinnedSnapshot.summary.unitsGrowth26)}</span>
              <span className="mx-1 text-slate-400">→</span>
              <strong>{formatGrowthMetric(active.unitsGrowth26)}</strong>
              {pinnedSnapshot.summary.unitsGrowth26.raw !== null &&
                active.unitsGrowth26.raw !== null && (
                  <span
                    className={`ml-1.5 font-bold ${
                      active.unitsGrowth26.raw - pinnedSnapshot.summary.unitsGrowth26.raw >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    (
                    {formatPp(
                      (active.unitsGrowth26.raw - pinnedSnapshot.summary.unitsGrowth26.raw) * 100,
                      1
                    )}
                    )
                  </span>
                )}
            </div>

            {/* Top-5 Share delta */}
            <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 font-sans mr-1">Top-5 Share:</span>
              <span>{pinnedSnapshot.summary.top5ProductSharePct.toFixed(1)}%</span>
              <span className="mx-1 text-slate-400">→</span>
              <strong>{active.top5ProductSharePct.toFixed(1)}%</strong>
              <span className="ml-1 text-slate-500">
                ({formatPp(active.top5ProductSharePct - pinnedSnapshot.summary.top5ProductSharePct, 1)})
              </span>
            </div>

            {/* Active Brands delta */}
            <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 font-sans mr-1">Brands:</span>
              <span>{pinnedSnapshot.summary.activeProductsCount.toLocaleString()}</span>
              <span className="mx-1 text-slate-400">→</span>
              <strong>{active.activeProductsCount.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
