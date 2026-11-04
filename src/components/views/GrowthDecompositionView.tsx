import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Sliders,
  Table2,
  TrendingUp,
} from 'lucide-react';
import type { ScopedAnalyticsBundle } from '../../lib/analyticsEngine';
import {
  formatCompactValue,
  formatDecimalPct,
  formatExactValue,
  formatGrowthMetric,
  formatPp,
} from '../../lib/formatters';
import { useMarketStore } from '../../store/useMarketStore';

interface GrowthDecompositionViewProps {
  bundle: ScopedAnalyticsBundle;
}

export const GrowthDecompositionView: React.FC<GrowthDecompositionViewProps> = ({
  bundle,
}) => {
  const {
    period,
    measure,
    theme,
    toggleFilterValue,
    drillToProductsInTable,
  } = useMarketStore();

  const [decompScope, setDecompScope] = useState<'product' | 'pack' | 'atc4' | 'atc1'>(
    'product'
  );
  const [moversScope, setMoversScope] = useState<'product' | 'pack'>('product');
  const [minBaseExponent, setMinBaseExponent] = useState<number>(6); // 10^6 = 1mn default

  const isDark = theme === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#334155';
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.25)';

  // 1. Volume vs Price/Mix Stacked Bars (Defaults to Top 18 Products)
  const decompItems = useMemo(() => {
    const source =
      decompScope === 'product'
        ? bundle.productNodes
        : decompScope === 'pack'
        ? bundle.packNodes
        : decompScope === 'atc4'
        ? bundle.atc4Nodes
        : bundle.atc1Nodes;
    return source.filter((n) => n.value2025 > 0 && n.units2025 > 0).slice(0, 18);
  }, [bundle, decompScope]);

  const decompOption = useMemo(() => {
    const items = [...decompItems].reverse();
    const names = items.map((n) =>
      n.name.length > 26 ? `${n.name.slice(0, 24)}…` : n.name
    );
    const volEffects = items.map((n) =>
      n.unitsGrowth26.display !== null
        ? Number((n.unitsGrowth26.display * 100).toFixed(1))
        : 0
    );
    const pmEffects = items.map((n) =>
      n.priceMixGrowth26 !== null
        ? Number((Math.min(Math.max(n.priceMixGrowth26, -1), 5) * 100).toFixed(1))
        : 0
    );
    const totalValGrowths = items.map((n) =>
      n.valueGrowth26.display !== null
        ? Number((n.valueGrowth26.display * 100).toFixed(1))
        : 0
    );

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const item = items[idx];
          if (!item) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700;margin-bottom:4px">${item.name}</div>
              <div>Total LC Value Growth: <b>${formatGrowthMetric(item.valueGrowth26)}</b></div>
              <div>• Volume Effect (Units Growth): <b style="color:#3b82f6">${formatGrowthMetric(item.unitsGrowth26)}</b></div>
              <div>• Price / Mix Effect: <b style="color:#f59e0b">${formatDecimalPct(item.priceMixGrowth26, 1)}</b></div>
              <div>Avg Pack Price: <b>EGP ${item.avgPrice25?.toFixed(1) ?? '—'} → EGP ${item.avgPrice26?.toFixed(1) ?? '—'}</b></div>
            </div>
          `;
        },
      },
      legend: {
        data: ['Volume Effect (Units Growth %)', 'Price/Mix Effect %', 'Total Value Growth %'],
        textStyle: { color: textColor, fontSize: 11 },
        top: 0,
      },
      grid: { left: 165, right: 35, top: 34, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { color: textColor, fontSize: 10 },
        axisLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          name: 'Volume Effect (Units Growth %)',
          type: 'bar',
          stack: 'decomp',
          data: volEffects,
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'Price/Mix Effect %',
          type: 'bar',
          stack: 'decomp',
          data: pmEffects,
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: 'Total Value Growth %',
          type: 'scatter',
          data: totalValGrowths,
          symbolSize: 8,
          itemStyle: { color: '#10b981' },
        },
      ],
    };
  }, [decompItems, textColor, gridColor]);

  // 2. Waterfall Chart of Market Growth by Top Contributors (pp)
  const waterfallOption = useMemo(() => {
    const source = decompScope === 'pack' ? bundle.packNodes : bundle.productNodes;
    const sortedByContrib = [...source]
      .filter((n) => n.contribGrowthPp !== null)
      .sort((a, b) => (b.contribGrowthPp || 0) - (a.contribGrowthPp || 0));

    const topContributors = sortedByContrib.slice(0, 12);
    const totalScopeGrowthPp =
      (bundle.scopeTotalNode.growth26.raw ?? 0) * 100;
    const sumTopPp = topContributors.reduce(
      (s, n) => s + (n.contribGrowthPp || 0),
      0
    );
    const restPp = totalScopeGrowthPp - sumTopPp;

    const categories = [
      ...topContributors.map((n) =>
        n.name.length > 18 ? `${n.name.slice(0, 16)}…` : n.name
      ),
      'All Other Brands',
      'Total Scope Growth',
    ];

    const baseData: number[] = [];
    const posData: (number | string)[] = [];
    const negData: (number | string)[] = [];
    const totalData: (number | string)[] = [];

    let running = 0;
    const steps = [
      ...topContributors.map((n) => n.contribGrowthPp || 0),
      restPp,
    ];

    for (let i = 0; i < steps.length; i++) {
      const val = Number(steps[i].toFixed(2));
      if (val >= 0) {
        baseData.push(Number(running.toFixed(2)));
        posData.push(val);
        negData.push('-');
      } else {
        baseData.push(Number((running + val).toFixed(2)));
        posData.push('-');
        negData.push(Math.abs(val));
      }
      totalData.push('-');
      running += val;
    }

    // Final Total bar
    baseData.push(0);
    posData.push('-');
    negData.push('-');
    totalData.push(Number(totalScopeGrowthPp.toFixed(2)));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          if (idx < topContributors.length) {
            const item = topContributors[idx];
            return `
              <div style="font-size:12px;line-height:1.5">
                <div style="font-weight:700">${item.name}</div>
                <div>Contribution to Scope Growth: <b style="color:#10b981">${formatPp(item.contribGrowthPp, 2)}</b></div>
                <div>Absolute Change (26 vs 25): <b>${formatExactValue(item.absGrowth26, measure)}</b></div>
                <div>2026 Sales: <b>${formatExactValue(item.v2026, measure)}</b></div>
              </div>
            `;
          }
          if (idx === topContributors.length) {
            return `<b>All Other Brands</b><br/>Net Contribution: <b>${formatPp(restPp, 2)}</b>`;
          }
          return `<b>Total Scope Growth</b>: <b>${formatPp(totalScopeGrowthPp, 2)}</b>`;
        },
      },
      grid: { left: 50, right: 25, top: 30, bottom: 85 },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: textColor, fontSize: 10, rotate: 35 },
        axisLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        name: 'Contribution (pp)',
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => `${v} pp`,
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          name: 'Base',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
          data: baseData,
        },
        {
          name: 'Positive Contribution',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { color: '#10b981', borderRadius: [3, 3, 0, 0] },
          data: posData,
        },
        {
          name: 'Negative Drag',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { color: '#f43f5e', borderRadius: [0, 0, 3, 3] },
          data: negData,
        },
        {
          name: 'Total Growth',
          type: 'bar',
          stack: 'waterfall',
          itemStyle: { color: '#6366f1', borderRadius: [3, 3, 0, 0] },
          data: totalData,
        },
      ],
    };
  }, [bundle, decompScope, measure, textColor, gridColor]);

  // 3. Section F: Top 15 Growers & Top 15 Decliners with Minimum Size Threshold Slider
  const minBaseThreshold = useMemo(() => {
    if (minBaseExponent <= 0) return 0;
    return Math.pow(10, minBaseExponent);
  }, [minBaseExponent]);

  const { topGrowers, topDecliners, eligibleCount } = useMemo(() => {
    const source = moversScope === 'product' ? bundle.productNodes : bundle.packNodes;
    const eligible = source.filter((n) => n.v2025 >= minBaseThreshold || n.v2026 >= minBaseThreshold);

    const growers = [...eligible]
      .filter((n) => n.absGrowth26 > 0)
      .sort((a, b) => b.absGrowth26 - a.absGrowth26)
      .slice(0, 15);

    const decliners = [...eligible]
      .filter((n) => n.absGrowth26 < 0)
      .sort((a, b) => a.absGrowth26 - b.absGrowth26)
      .slice(0, 15);

    return {
      topGrowers: growers,
      topDecliners: decliners,
      eligibleCount: eligible.length,
    };
  }, [bundle, moversScope, minBaseThreshold]);

  return (
    <div className="space-y-6">
      {/* Row 1: Section C — Volume vs Price/Mix Decomposition & Growth Contribution Waterfall */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card C1: Volume vs Price/Mix Stacked Bars */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <span>
                  C1. Growth Decomposition: Volume vs Price/Mix ({period.toUpperCase()} Aug 2026)
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Separates unit volume demand from price/repricing inflation across leading brands
              </p>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              {(
                [
                  ['product', 'Products'],
                  ['pack', 'Packs'],
                  ['atc4', 'ATC4'],
                  ['atc1', 'ATC1'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDecompScope(k)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    decompScope === k
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[390px] w-full">
            <ReactECharts
              option={decompOption}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </div>

        {/* Card C2: Market Growth Waterfall by Top Contributors (pp) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <span>
                  C2. Waterfall of Scope Growth by Top Contributing{' '}
                  {decompScope === 'pack' ? 'Packs' : 'Products'} (pp)
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Percentage-point (pp) bridge from 2025 base to 2026 total growth (
                {formatGrowthMetric(bundle.scopeTotalNode.growth26)})
              </p>
            </div>
          </div>

          <div className="h-[390px] w-full">
            <ReactECharts
              option={waterfallOption}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Section F — Top 15 Growers & Top 15 Decliners with Minimum-Size Threshold Slider */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <span>
                F. Top 15 Growers &amp; Top 15 Decliners by Absolute Change (2026 vs 2025)
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ranked by absolute {measure === 'value' ? 'EGP Value' : 'Units'} gain/loss, with minimum size threshold to filter out tiny bases
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Minimum Size Threshold Slider */}
            <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Min Size Threshold:
              </span>
              <input
                type="range"
                min={0}
                max={measure === 'value' ? 8.5 : 6.5}
                step={0.5}
                value={minBaseExponent}
                onChange={(e) => setMinBaseExponent(Number(e.target.value))}
                className="w-28 accent-indigo-600 cursor-pointer"
              />
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 min-w-[78px]">
                {minBaseThreshold === 0
                  ? 'All (0)'
                  : formatCompactValue(minBaseThreshold, measure, true)}
              </span>
              <span className="text-[11px] text-slate-400">
                ({eligibleCount.toLocaleString()} eligible)
              </span>
            </div>

            {/* Scope Toggle: Products | Packs */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setMoversScope('product')}
                className={`px-3 py-1 rounded-md font-semibold ${
                  moversScope === 'product'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Products (Brands)
              </button>
              <button
                type="button"
                onClick={() => setMoversScope('pack')}
                className={`px-3 py-1 rounded-md font-semibold ${
                  moversScope === 'pack'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Packs
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 15 Growers Table */}
          <div>
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-4 h-4" />
              <span>Top 15 Absolute Growers (2026 vs 2025)</span>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[420px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">
                      {moversScope === 'product' ? 'Product' : 'Product — Pack'}
                    </th>
                    <th className="py-2 px-2 text-right">2025</th>
                    <th className="py-2 px-2 text-right">2026</th>
                    <th className="py-2 px-2.5 text-right">Abs Gain</th>
                    <th className="py-2 px-2 text-right">Growth %</th>
                    <th className="py-2 px-2 text-right">Contrib</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {topGrowers.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (item.dimKey && item.dictIdx !== undefined) {
                          toggleFilterValue(item.dimKey, item.dictIdx);
                        }
                      }}
                      className="hover:bg-emerald-500/5 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-2.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-900 dark:text-slate-100 max-w-[180px] truncate">
                        <div className="truncate" title={item.name}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal truncate">
                          {item.atc4Name}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500">
                        {formatCompactValue(item.v2025, measure)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">
                        {formatCompactValue(item.v2026, measure)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatCompactValue(item.absGrowth26, measure)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {formatGrowthMetric(item.growth26)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500">
                        {formatPp(item.contribGrowthPp, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 15 Decliners Table */}
          <div>
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="w-4 h-4" />
              <span>Top 15 Absolute Decliners (2026 vs 2025)</span>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[420px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">
                      {moversScope === 'product' ? 'Product' : 'Product — Pack'}
                    </th>
                    <th className="py-2 px-2 text-right">2025</th>
                    <th className="py-2 px-2 text-right">2026</th>
                    <th className="py-2 px-2.5 text-right">Abs Loss</th>
                    <th className="py-2 px-2 text-right">Growth %</th>
                    <th className="py-2 px-2 text-right">Drag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {topDecliners.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (item.dimKey && item.dictIdx !== undefined) {
                          toggleFilterValue(item.dimKey, item.dictIdx);
                        }
                      }}
                      className="hover:bg-rose-500/5 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-2.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2.5 font-semibold text-slate-900 dark:text-slate-100 max-w-[180px] truncate">
                        <div className="truncate" title={item.name}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal truncate">
                          {item.atc4Name}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500">
                        {formatCompactValue(item.v2025, measure)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold">
                        {formatCompactValue(item.v2026, measure)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatCompactValue(item.absGrowth26, measure)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-rose-600 dark:text-rose-400">
                        {formatGrowthMetric(item.growth26)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500">
                        {formatPp(item.contribGrowthPp, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
