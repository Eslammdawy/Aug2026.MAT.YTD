import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  Package,
  PieChart,
} from 'lucide-react';
import type { ExecutiveSummaryData, PeriodKpiSummary } from '../lib/analyticsEngine';
import {
  formatCompactValue,
  formatExactValue,
  formatGrowthMetric,
  formatSharePct,
} from '../lib/formatters';
import { useMarketStore } from '../store/useMarketStore';

interface ExecutiveSummaryBannerProps {
  executive: ExecutiveSummaryData;
  newProductsCount: number;
  newPacksCount: number;
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
  newPacksCount,
}) => {
  const { period, setPeriod } = useMarketStore();

  const active: PeriodKpiSummary = period === 'mat' ? executive.mat : executive.ytd;
  const secondary: PeriodKpiSummary = period === 'mat' ? executive.ytd : executive.mat;
  const activeLabel = period === 'mat' ? 'MAT Aug 2026' : 'YTD Aug 2026';
  const secondaryLabel = period === 'mat' ? 'YTD Aug 2026' : 'MAT Aug 2026';

  const valGrowthPos =
    active.valueGrowth26.raw !== null ? active.valueGrowth26.raw >= 0 : null;
  const unitGrowthPos =
    active.unitsGrowth26.raw !== null ? active.unitsGrowth26.raw >= 0 : null;

  return (
    <section
      aria-label="Executive Market Summary"
      className="max-w-[1680px] mx-auto px-4 sm:px-6 pt-4 pb-2 space-y-3"
    >
      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

          <div className="my-2">
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

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setPeriod(period === 'mat' ? 'ytd' : 'mat')}
              className="hover:text-indigo-400 transition-colors"
            >
              {secondaryLabel}:{' '}
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {formatCompactValue(secondary.value26, 'value', false)} (
                {formatGrowthMetric(secondary.valueGrowth26)})
              </span>
            </button>
            <span className="font-mono text-indigo-500 dark:text-indigo-400">
              {formatSharePct(active.shareOfGrandTotalValue)} of Egypt
            </span>
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

          <div className="my-2">
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

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              {secondaryLabel}:{' '}
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {formatCompactValue(secondary.units26, 'units', false)} (
                {formatGrowthMetric(secondary.unitsGrowth26)})
              </span>
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              {formatSharePct(active.shareOfGrandTotalUnits)} of Egypt
            </span>
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

          <div className="my-2">
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

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>2026 New Launches:</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              +{newProductsCount.toLocaleString()} prods / +{newPacksCount.toLocaleString()} packs
            </span>
          </div>
        </div>

        {/* Card 4: Top-5 / Top-10 Concentration & HHI */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_12px_-3px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Brand Concentration
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20">
              <PieChart className="w-4 h-4" />
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                {active.top5ProductSharePct.toFixed(1)}%
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Top-5 Brands
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>Top-10 Brands Share:</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {active.top10ProductSharePct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Scope Product HHI:</span>
            <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
              {active.productHHI !== null ? Math.round(active.productHHI).toLocaleString() : '—'}{' '}
              {active.productHHI !== null &&
                (active.productHHI > 2500
                  ? '(High)'
                  : active.productHHI > 1500
                  ? '(Moderate)'
                  : '(Fragmented)')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
