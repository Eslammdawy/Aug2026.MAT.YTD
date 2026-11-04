import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ArchiveRestore,
  Boxes,
  DollarSign,
  Layers,
  PackagePlus,
  Sparkles,
  Table2,
} from 'lucide-react';
import type { ScopedAnalyticsBundle } from '../../lib/analyticsEngine';
import {
  formatCompactValue,
  formatExactValue,
  formatGrowthMetric,
  formatPriceEgp,
  formatSharePct,
} from '../../lib/formatters';
import { useMarketStore } from '../../store/useMarketStore';

interface PortfolioAndLaunchesViewProps {
  bundle: ScopedAnalyticsBundle;
}

export const PortfolioAndLaunchesView: React.FC<PortfolioAndLaunchesViewProps> = ({
  bundle,
}) => {
  const {
    measure,
    theme,
    toggleFilterValue,
    drillToProductsInTable,
  } = useMarketStore();

  const [launchLevel, setLaunchLevel] = useState<'product' | 'pack'>('product');
  const [onlyShowExtensions, setOnlyShowExtensions] = useState(false);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#1e293b';
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0';

  // 1. NFC1 Dosage Form Mix & Average Price Trend (2024 -> 2025 -> 2026)
  const nfc1ChartOption = useMemo(() => {
    const items = bundle.nfc1Nodes.slice(0, 12);
    const names = items.map((n) =>
      n.name.length > 22 ? `${n.name.slice(0, 20)}…` : n.name
    );

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
        formatter: (params: any[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const n = items[idx];
          if (!n) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${n.name}</div>
              <div>2026 Sales: <b>${formatExactValue(n.v2026, measure)}</b> (${formatSharePct(n.share26)})</div>
              <div>Avg Pack Price Trend: <b>${formatPriceEgp(n.avgPrice24)} → ${formatPriceEgp(n.avgPrice25)} → ${formatPriceEgp(n.avgPrice26)}</b></div>
              <div>LC Value Growth: <b>${formatGrowthMetric(n.valueGrowth26)}</b> | Units Growth: <b>${formatGrowthMetric(n.unitsGrowth26)}</b></div>
            </div>
          `;
        },
      },
      legend: {
        data: ['2026 Sales', 'Avg Price 2024 (EGP)', 'Avg Price 2026 (EGP)'],
        textStyle: { color: textColor, fontSize: 11 },
        top: 0,
      },
      grid: { left: 55, right: 55, top: 36, bottom: 75 },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: { color: textColor, fontSize: 10, rotate: 30 },
      },
      yAxis: [
        {
          type: 'value',
          name: measure === 'value' ? 'EGP' : 'Units',
          nameTextStyle: { color: textColor, fontSize: 10 },
          axisLabel: {
            color: textColor,
            fontSize: 10,
            formatter: (v: number) => formatCompactValue(v, measure),
          },
          splitLine: { lineStyle: { color: gridColor } },
        },
        {
          type: 'value',
          name: 'Avg Price (EGP)',
          nameTextStyle: { color: textColor, fontSize: 10 },
          axisLabel: {
            color: textColor,
            fontSize: 10,
            formatter: (v: number) => `${v}`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '2026 Sales',
          type: 'bar',
          data: items.map((n) => n.v2026),
          itemStyle: { color: '#06b6d4', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Avg Price 2024 (EGP)',
          type: 'line',
          yAxisIndex: 1,
          data: items.map((n) => Number((n.avgPrice24 || 0).toFixed(1))),
          itemStyle: { color: '#94a3b8' },
          lineStyle: { type: 'dashed', width: 2 },
        },
        {
          name: 'Avg Price 2026 (EGP)',
          type: 'line',
          yAxisIndex: 1,
          data: items.map((n) => Number((n.avgPrice26 || 0).toFixed(1))),
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 2.5 },
        },
      ],
    };
  }, [bundle.nfc1Nodes, measure, textColor, gridColor]);

  // 2. Price-Tier Mix & Pack-Size Mix Option
  const priceTierOption = useMemo(() => {
    const tiers = bundle.priceTierMix;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
      },
      legend: {
        data: ['LC Value Share %', 'Units Volume Share %', '2026 Value Growth %'],
        textStyle: { color: textColor, fontSize: 11 },
        top: 0,
      },
      grid: { left: 50, right: 45, top: 36, bottom: 45 },
      xAxis: {
        type: 'category',
        data: tiers.map((t) => `${t.tier}\n(${t.rangeLabel})`),
        axisLabel: { color: textColor, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'Percentage (%)',
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          name: 'LC Value Share %',
          type: 'bar',
          data: tiers.map((t) => Number((t.valueShare26 * 100).toFixed(1))),
          itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Units Volume Share %',
          type: 'bar',
          data: tiers.map((t) => Number((t.unitsShare26 * 100).toFixed(1))),
          itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '2026 Value Growth %',
          type: 'line',
          data: tiers.map((t) =>
            t.valueGrowth26.display !== null
              ? Number((t.valueGrowth26.display * 100).toFixed(1))
              : 0
          ),
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 2.5 },
        },
      ],
    };
  }, [bundle.priceTierMix, textColor, gridColor]);

  const displayedExtensions = useMemo(() => {
    const list = onlyShowExtensions
      ? bundle.packExtensions.filter((e) => e.newExtensionPackCount > 0)
      : bundle.packExtensions;
    return list.slice(0, 45);
  }, [bundle.packExtensions, onlyShowExtensions]);

  const activeNewList =
    launchLevel === 'product' ? bundle.newProducts : bundle.newPacks;
  const activeDiscList =
    launchLevel === 'product'
      ? bundle.discontinuedProducts
      : bundle.discontinuedPacks;

  const totalLaunchValue26 = useMemo(
    () => activeNewList.reduce((s, n) => s + n.v2026, 0),
    [activeNewList]
  );
  const totalDiscValue25 = useMemo(
    () => activeDiscList.reduce((s, n) => s + n.v2025, 0),
    [activeDiscList]
  );

  return (
    <div className="space-y-6">
      {/* Row 1: Section I — NFC1 Dosage Form Mix + Price-Tier & Pack-Size Mix */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card I1: NFC1 Mix & Average Price Trajectory */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>I1. Dosage Form (NFC1) Mix &amp; Average Price Trend (2024 → 2026)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any NFC1 bar to filter Products &amp; Packs by dosage form
            </p>
          </div>

          <div className="h-[340px] w-full">
            <ReactECharts
              option={nfc1ChartOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const n = bundle.nfc1Nodes[p.dataIndex];
                  if (n && n.nfc1Idx >= 0) {
                    toggleFilterValue('nfc1', n.nfc1Idx);
                  }
                },
              }}
            />
          </div>
        </div>

        {/* Card I2: Price-Tier Mix & Pack-Size Architecture */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>I2. Price-Tier Value vs Volume Share &amp; Pack-Size Mix</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Compares EGP revenue concentration vs unit volume across pack price tiers and pack sizes
            </p>
          </div>

          <div className="h-[220px] w-full">
            <ReactECharts option={priceTierOption} style={{ height: '100%', width: '100%' }} />
          </div>

          {/* Pack Size Mix compact summary table */}
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="text-slate-600 dark:text-slate-400 uppercase font-bold border-b border-slate-200/80 dark:border-slate-800">
                  <th className="py-1.5 pr-2">Pack-Size Cohort</th>
                  <th className="py-1.5 px-2 text-right">Packs</th>
                  <th className="py-1.5 px-2 text-right">2026 Value</th>
                  <th className="py-1.5 px-2 text-right">Val Share</th>
                  <th className="py-1.5 px-2 text-right">Val Growth</th>
                  <th className="py-1.5 pl-2 text-right">Avg Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {bundle.packSizeMix.map((b) => (
                  <tr key={b.bucket} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-1.5 pr-2 font-semibold text-slate-800 dark:text-slate-200">
                      {b.bucket}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                      {b.packCount.toLocaleString()}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {formatCompactValue(b.value26, 'value')}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-600 dark:text-slate-300">
                      {formatSharePct(b.valueShare26)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatGrowthMetric(b.valueGrowth26)}
                    </td>
                    <td className="py-1.5 pl-2 text-right font-mono font-medium text-amber-600 dark:text-amber-400">
                      {formatPriceEgp(b.avgPrice26)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 2: Section I3 — Pack Extensions vs Product Total */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-500" />
              <span>I3. Multi-Pack Brands &amp; 2026 Pack Line Extensions vs Product Total</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Analyzes how constituent packs and new 2026 pack extensions contribute to parent Product revenue
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyShowExtensions}
              onChange={(e) => setOnlyShowExtensions(e.target.checked)}
              className="rounded accent-indigo-600"
            />
            <span>Only show brands with new 2026 pack extensions</span>
          </label>
        </div>

        <div className="overflow-auto rounded-xl border border-slate-200/90 dark:border-slate-800 max-h-[360px] shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Product (Brand)</th>
                <th className="py-2.5 px-2.5">Therapeutic Class (ATC4)</th>
                <th className="py-2.5 px-2 text-right">Total Packs</th>
                <th className="py-2.5 px-2.5 text-right">Brand 2026 Total</th>
                <th className="py-2.5 px-2 text-right">Brand Growth</th>
                <th className="py-2.5 px-3">Lead Pack (% of Brand)</th>
                <th className="py-2.5 px-2.5 text-right">2026 New Extension Packs</th>
                <th className="py-2.5 px-2 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {displayedExtensions.map((ext) => (
                <tr
                  key={ext.prodIdx}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                    {ext.productName}
                  </td>
                  <td className="py-2 px-2.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                    {ext.atc4Name}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{ext.packCount} pks</td>
                  <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                    {formatCompactValue(ext.totalValue26, measure)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatGrowthMetric(ext.productGrowth26)}
                  </td>
                  <td className="py-2 px-3 max-w-[220px] truncate">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {ext.leadPackName}
                    </span>{' '}
                    <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                      ({ext.leadPackSharePct.toFixed(1)}%)
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono">
                    {ext.newExtensionPackCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 text-[11px] font-semibold">
                        +{ext.newExtensionPackCount} new ({formatCompactValue(ext.extensionValue26, measure)} •{' '}
                        {ext.extensionShareOfProductPct.toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => drillToProductsInTable('product', ext.prodIdx)}
                      className="p-1 rounded hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors"
                      title="Inspect Product & its Packs in Main Table"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Section J — New Launches (2025=0, 2026>0) & Discontinued (2025>0, 2026=0) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200/90 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-500" />
              <span>
                J. New 2026 Launches &amp; Discontinued / Dormant Portfolio Analysis
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Launches = 0 sales in 2025 and &gt;0 in 2026 • Discontinued = &gt;0 sales in 2025 and 0 in 2026
            </p>
          </div>

          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setLaunchLevel('product')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                launchLevel === 'product'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Products ({bundle.newProducts.length} New / {bundle.discontinuedProducts.length} Disc)
            </button>
            <button
              type="button"
              onClick={() => setLaunchLevel('pack')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                launchLevel === 'pack'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Packs ({bundle.newPacks.length} New / {bundle.discontinuedPacks.length} Disc)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* New 2026 Launches */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <PackagePlus className="w-4 h-4" />
                <span>
                  2026 New Launches ({activeNewList.length.toLocaleString()}{' '}
                  {launchLevel === 'product' ? 'Products' : 'Packs'})
                </span>
              </span>
              <span className="text-xs font-mono font-semibold text-sky-600 dark:text-sky-400">
                Total 2026 Sales: {formatCompactValue(totalLaunchValue26, measure, true)}
              </span>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200/90 dark:border-slate-800 max-h-[380px] shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-2">ATC4 Class</th>
                    <th className="py-2.5 px-3 text-right">2026 Sales</th>
                    <th className="py-2.5 px-2 text-right">Scope Share</th>
                    <th className="py-2.5 px-2.5 text-right">Avg Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {activeNewList.slice(0, 35).map((n, idx) => (
                    <tr
                      key={n.id}
                      onClick={() =>
                        n.dimKey && n.dictIdx !== undefined && toggleFilterValue(n.dimKey, n.dictIdx)
                      }
                      className="hover:bg-sky-50/50 dark:hover:bg-sky-500/10 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white max-w-[180px] truncate">
                        {n.name}
                      </td>
                      <td className="py-2 px-2 text-slate-500 dark:text-slate-400 max-w-[150px] truncate">
                        {n.atc4Name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-sky-600 dark:text-sky-400">
                        {formatCompactValue(n.v2026, measure)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatSharePct(n.share26)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatPriceEgp(n.avgPrice26)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discontinued / Dormant in 2026 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ArchiveRestore className="w-4 h-4" />
                <span>
                  Discontinued / Zero in 2026 ({activeDiscList.length.toLocaleString()}{' '}
                  {launchLevel === 'product' ? 'Products' : 'Packs'})
                </span>
              </span>
              <span className="text-xs font-mono font-semibold text-rose-600 dark:text-rose-400">
                Prior 2025 Base: {formatCompactValue(totalDiscValue25, measure, true)}
              </span>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200/90 dark:border-slate-800 max-h-[380px] shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-2">ATC4 Class</th>
                    <th className="py-2.5 px-3 text-right">2025 Sales Lost</th>
                    <th className="py-2.5 px-2 text-right">2024 Sales</th>
                    <th className="py-2.5 px-2.5 text-right">2025 Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {activeDiscList.slice(0, 35).map((n, idx) => (
                    <tr
                      key={n.id}
                      onClick={() =>
                        n.dimKey && n.dictIdx !== undefined && toggleFilterValue(n.dimKey, n.dictIdx)
                      }
                      className="hover:bg-rose-50/50 dark:hover:bg-rose-500/10 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white max-w-[180px] truncate">
                        {n.name}
                      </td>
                      <td className="py-2 px-2 text-slate-500 dark:text-slate-400 max-w-[150px] truncate">
                        {n.atc4Name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        -{formatCompactValue(n.v2025, measure)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatCompactValue(n.v2024, measure)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatPriceEgp(n.avgPrice25)}
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
