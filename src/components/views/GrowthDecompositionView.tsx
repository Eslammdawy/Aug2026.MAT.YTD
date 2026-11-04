import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  Sliders,
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
import { AnalyticsChartCard, exportRowsToCsv } from '../charts/AnalyticsChartCard';

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
    selections,
    toggleFilterValue,
  } = useMarketStore();

  const [decompScope, setDecompScope] = useState<'product' | 'pack' | 'atc4' | 'atc1'>(
    'product'
  );
  const [moversScope, setMoversScope] = useState<'product' | 'pack'>('product');
  const [minBaseExponent, setMinBaseExponent] = useState<number>(6); // 10^6 = 1mn default
  const [annualDeflatorPct, setAnnualDeflatorPct] = useState<number>(0); // 0%, 15%, 25%

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

  const reversedDecompItems = useMemo(() => [...decompItems].reverse(), [decompItems]);

  const decompOption = useMemo(() => {
    const items = reversedDecompItems;
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
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
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
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bar to cross-filter report</div>
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
          cursor: 'pointer',
          stack: 'decomp',
          data: volEffects,
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'Price/Mix Effect %',
          type: 'bar',
          cursor: 'pointer',
          stack: 'decomp',
          data: pmEffects,
          itemStyle: { color: '#f59e0b' },
        },
        {
          name: 'Total Value Growth %',
          type: 'scatter',
          cursor: 'pointer',
          data: totalValGrowths,
          symbolSize: 8,
          itemStyle: { color: '#10b981' },
        },
      ],
    };
  }, [reversedDecompItems, isDark, textColor, gridColor]);

  // 2. Waterfall Chart of Market Growth by Top Contributors (pp)
  const { waterfallOption, topContributors } = useMemo(() => {
    const source = decompScope === 'pack' ? bundle.packNodes : bundle.productNodes;
    const sortedByContrib = [...source]
      .filter((n) => n.contribGrowthPp !== null)
      .sort((a, b) => (b.contribGrowthPp || 0) - (a.contribGrowthPp || 0));

    const top = sortedByContrib.slice(0, 12);
    const totalScopeGrowthPp =
      (bundle.scopeTotalNode.growth26.raw ?? 0) * 100;
    const sumTopPp = top.reduce(
      (s, n) => s + (n.contribGrowthPp || 0),
      0
    );
    const restPp = totalScopeGrowthPp - sumTopPp;

    const categories = [
      ...top.map((n) =>
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
      ...top.map((n) => n.contribGrowthPp || 0),
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
      topContributors: top,
      waterfallOption: {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
          borderColor: isDark ? '#334155' : '#cbd5e1',
          textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
          formatter: (params: any[]) => {
            const idx = params[0]?.dataIndex ?? 0;
            if (idx < top.length) {
              const item = top[idx];
              return `
                <div style="font-size:12px;line-height:1.5">
                  <div style="font-weight:700">${item.name}</div>
                  <div>Contribution to Scope Growth: <b style="color:#10b981">${formatPp(item.contribGrowthPp, 2)}</b></div>
                  <div>Absolute Change (26 vs 25): <b>${formatExactValue(item.absGrowth26, measure)}</b></div>
                  <div>2026 Sales: <b>${formatExactValue(item.v2026, measure)}</b></div>
                  <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bar to filter report</div>
                </div>
              `;
            }
            if (idx === top.length) {
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
            cursor: 'pointer',
            stack: 'waterfall',
            itemStyle: { color: '#10b981', borderRadius: [3, 3, 0, 0] },
            data: posData,
          },
          {
            name: 'Negative Drag',
            type: 'bar',
            cursor: 'pointer',
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
      },
    };
  }, [bundle, decompScope, measure, isDark, textColor, gridColor]);

  // 3. NC-2 (Section L): Real vs Nominal Momentum Panels (Indexed Small Multiples, 2024 = 100)
  const indexedPanels = useMemo(() => {
    const deflator1Yr = 1 + annualDeflatorPct / 100;
    const deflator2Yr = deflator1Yr * deflator1Yr;

    return bundle.atc1Nodes.map((n) => {
      const hasBase = n.value2024 > 0 && n.units2024 > 0;
      const valIdx24 = 100;
      const valIdx25 = hasBase
        ? ((n.value2025 / n.value2024) * 100) / deflator1Yr
        : null;
      const valIdx26 = hasBase
        ? ((n.value2026 / n.value2024) * 100) / deflator2Yr
        : null;

      const unitIdx24 = 100;
      const unitIdx25 = hasBase ? (n.units2025 / n.units2024) * 100 : null;
      const unitIdx26 = hasBase ? (n.units2026 / n.units2024) * 100 : null;

      const wedgePts =
        valIdx26 !== null && unitIdx26 !== null ? valIdx26 - unitIdx26 : null;

      return {
        node: n,
        hasBase,
        valIdx24,
        valIdx25,
        valIdx26,
        unitIdx24,
        unitIdx25,
        unitIdx26,
        wedgePts,
      };
    });
  }, [bundle.atc1Nodes, annualDeflatorPct]);

  // 4. Section F: Top 15 Growers & Top 15 Decliners with Minimum Size Threshold Slider
  const minBaseThreshold = useMemo(() => {
    if (minBaseExponent <= 0) return 0;
    return Math.pow(10, minBaseExponent);
  }, [minBaseExponent]);

  const { topGrowers, topDecliners, eligibleCount } = useMemo(() => {
    const source = moversScope === 'product' ? bundle.productNodes : bundle.packNodes;
    const eligible = source.filter(
      (n) => n.v2025 >= minBaseThreshold || n.v2026 >= minBaseThreshold
    );

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
        <AnalyticsChartCard
          title={`C1. Growth Decomposition: Volume vs Price/Mix (${period.toUpperCase()} Aug 2026)`}
          subtitle="Separates unit volume demand from price/repricing inflation across leading entities • Click bar to filter"
          icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
          exportFilename={`growth-decomposition-${decompScope}`}
          measureBadge="Value & Units Dual"
          controls={
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
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    decompScope === k
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
          csvRows={decompItems.map((n) => ({
            Name: n.name,
            ValueGrowth26Pct:
              n.valueGrowth26.raw !== null ? Number((n.valueGrowth26.raw * 100).toFixed(2)) : '—',
            VolumeEffectUnitsGrowth26Pct:
              n.unitsGrowth26.raw !== null ? Number((n.unitsGrowth26.raw * 100).toFixed(2)) : '—',
            PriceMixEffect26Pct:
              n.priceMixGrowth26 !== null ? Number((n.priceMixGrowth26 * 100).toFixed(2)) : '—',
            AvgPackPrice25: n.avgPrice25 !== null ? Number(n.avgPrice25.toFixed(2)) : '—',
            AvgPackPrice26: n.avgPrice26 !== null ? Number(n.avgPrice26.toFixed(2)) : '—',
          }))}
        >
          <div className="h-[390px] w-full">
            <ReactECharts
              option={decompOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const item = reversedDecompItems[p.dataIndex];
                  if (item?.dimKey && item.dictIdx !== undefined && item.dictIdx >= 0) {
                    toggleFilterValue(item.dimKey, item.dictIdx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>

        {/* Card C2: Market Growth Waterfall by Top Contributors (pp) */}
        <AnalyticsChartCard
          title={`C2. Waterfall of Scope Growth by Top Contributing ${
            decompScope === 'pack' ? 'Packs' : 'Products'
          } (pp)`}
          subtitle={`Percentage-point (pp) bridge from 2025 base to 2026 total growth (${formatGrowthMetric(
            bundle.scopeTotalNode.growth26
          )})`}
          icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}
          exportFilename={`growth-waterfall-${decompScope === 'pack' ? 'packs' : 'products'}`}
          csvRows={topContributors.map((n) => ({
            Name: n.name,
            ContributionPp: n.contribGrowthPp !== null ? Number(n.contribGrowthPp.toFixed(3)) : 0,
            AbsChange26_25: n.absGrowth26,
            Sales2026: n.v2026,
          }))}
        >
          <div className="h-[390px] w-full">
            <ReactECharts
              option={waterfallOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const item = topContributors[p.dataIndex];
                  if (item?.dimKey && item.dictIdx !== undefined && item.dictIdx >= 0) {
                    toggleFilterValue(item.dimKey, item.dictIdx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>
      </div>

      {/* Row 2: NC-2 (Section L) — Real vs Nominal Momentum Panels (Indexed Small Multiples, 2024 = 100) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>
                L. Real vs Nominal Momentum Panels — Indexed Trajectories by Therapeutic Class (Aug 2024 = 100)
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Compares Indexed Value (indigo solid) vs Indexed Units (amber dashed) across all ATC1 classes to expose repricing wedges vs real volume expansion
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
              {(
                [
                  [0, 'Nominal EGP (0% Deflator)'],
                  [15, 'Real EGP (−15%/yr CPI)'],
                  [25, 'Real EGP (−25%/yr Repricing)'],
                ] as const
              ).map(([defl, label]) => (
                <button
                  key={defl}
                  type="button"
                  onClick={() => setAnnualDeflatorPct(defl)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    annualDeflatorPct === defl
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                exportRowsToCsv(
                  `real-vs-nominal-indexed-atc1-${period}`,
                  indexedPanels.map((p) => ({
                    ATC1_Class: p.node.name,
                    DeflatorAnnualPct: annualDeflatorPct,
                    ValueIndex2024: 100,
                    ValueIndex2025: p.valIdx25 !== null ? Number(p.valIdx25.toFixed(1)) : 'n/a',
                    ValueIndex2026: p.valIdx26 !== null ? Number(p.valIdx26.toFixed(1)) : 'n/a',
                    UnitsIndex2024: 100,
                    UnitsIndex2025: p.unitIdx25 !== null ? Number(p.unitIdx25.toFixed(1)) : 'n/a',
                    UnitsIndex2026: p.unitIdx26 !== null ? Number(p.unitIdx26.toFixed(1)) : 'n/a',
                    PriceMixWedgePts26: p.wedgePts !== null ? Number(p.wedgePts.toFixed(1)) : 'n/a',
                  }))
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* 4x4 Small Multiples Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {indexedPanels.map((p) => {
            const isSelected = selections.atc1.includes(p.node.atc1Idx);
            const v25 = p.valIdx25 ?? 100;
            const v26 = p.valIdx26 ?? 100;
            const u25 = p.unitIdx25 ?? 100;
            const u26 = p.unitIdx26 ?? 100;
            const minIdx = Math.min(80, v25, v26, u25, u26);
            const maxIdx = Math.max(160, v25, v26, u25, u26);
            const span = Math.max(20, maxIdx - minIdx);

            const toY = (val: number) => 52 - ((val - minIdx) / span) * 44;
            const y100 = toY(100);
            const valPath = `M 12 ${toY(100).toFixed(1)} L 90 ${toY(v25).toFixed(1)} L 168 ${toY(v26).toFixed(1)}`;
            const unitPath = `M 12 ${toY(100).toFixed(1)} L 90 ${toY(u25).toFixed(1)} L 168 ${toY(u26).toFixed(1)}`;

            return (
              <button
                key={p.node.id}
                type="button"
                onClick={() => toggleFilterValue('atc1', p.node.atc1Idx)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40'
                    : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-indigo-400/60'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5 mb-1.5">
                  <div
                    className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate"
                    title={p.node.name}
                  >
                    {p.node.name}
                  </div>
                  <span className="shrink-0 text-[10px] font-mono text-slate-400">
                    {((p.node.share26 || 0) * 100).toFixed(1)}%
                  </span>
                </div>

                {!p.hasBase ? (
                  <div className="h-[58px] flex items-center justify-center text-[11px] text-slate-400 italic">
                    n/a (Zero 2024 base)
                  </div>
                ) : (
                  <>
                    <svg viewBox="0 0 180 58" className="w-full h-[54px] overflow-visible">
                      {/* 100 baseline */}
                      <line
                        x1="8"
                        y1={y100}
                        x2="172"
                        y2={y100}
                        stroke={isDark ? '#334155' : '#cbd5e1'}
                        strokeDasharray="2 2"
                        strokeWidth="1"
                      />
                      {/* Units Index dashed amber line */}
                      <path
                        d={unitPath}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                      {/* Value Index solid indigo line */}
                      <path
                        d={valPath}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="2.2"
                      />
                      <circle cx="12" cy={toY(100)} r="2.5" fill="#6366f1" />
                      <circle cx="90" cy={toY(u25)} r="2.5" fill="#f59e0b" />
                      <circle cx="168" cy={toY(u26)} r="3" fill="#f59e0b" />
                      <circle cx="90" cy={toY(v25)} r="2.5" fill="#6366f1" />
                      <circle cx="168" cy={toY(v26)} r="3" fill="#6366f1" />
                    </svg>

                    <div className="flex items-center justify-between text-[10px] font-mono mt-1 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        Val: {v26.toFixed(0)}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Unit: {u26.toFixed(0)}
                      </span>
                      <span
                        className={`px-1 py-0.2 rounded ${
                          (p.wedgePts ?? 0) >= 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                        title="2026 Value Index minus Units Index"
                      >
                        Δ {(p.wedgePts ?? 0) >= 0 ? '+' : ''}
                        {(p.wedgePts ?? 0).toFixed(0)}
                      </span>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: Section F — Top 15 Growers & Top 15 Decliners with Minimum-Size Threshold Slider */}
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
