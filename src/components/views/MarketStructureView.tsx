import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ArrowRight,
  BarChart2,
  Filter,
  Grid,
  Layers,
  PieChart,
  Table2,
} from 'lucide-react';
import type { ScopedAnalyticsBundle } from '../../lib/analyticsEngine';
import {
  formatCompactValue,
  formatExactValue,
  formatGrowthMetric,
  formatSharePct,
} from '../../lib/formatters';
import { winsoriseForColorScale } from '../../lib/metrics';
import { useMarketStore } from '../../store/useMarketStore';
import type { DimensionKey } from '../../types/market';

interface MarketStructureViewProps {
  bundle: ScopedAnalyticsBundle;
}

export const MarketStructureView: React.FC<MarketStructureViewProps> = ({ bundle }) => {
  const {
    period,
    measure,
    theme,
    toggleFilterValue,
    drillToProductsInTable,
  } = useMarketStore();

  const [barScope, setBarScope] = useState<'product' | 'pack' | 'atc1' | 'atc4'>('product');
  const [treemapMode, setTreemapMode] = useState<'product_pack' | 'atc1_atc4'>('product_pack');

  const isDark = theme === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#334155';
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.25)';

  // 1. Bar Chart + Growth Overlay (Defaults to Top 25 Products, switchable to Packs, ATC1, ATC4)
  const barChartItems = useMemo(() => {
    if (barScope === 'product') return bundle.productNodes.slice(0, 25);
    if (barScope === 'pack') return bundle.packNodes.slice(0, 25);
    if (barScope === 'atc4') return bundle.atc4Nodes.slice(0, 25);
    return bundle.atc1Nodes;
  }, [bundle, barScope]);

  const barOption = useMemo(() => {
    const names = barChartItems.map((n) =>
      n.name.length > 26 ? `${n.name.slice(0, 24)}…` : n.name
    );
    const values = barChartItems.map((n) => n.v2026);
    const valGrowths = barChartItems.map((n) =>
      n.valueGrowth26.display !== null
        ? Number((n.valueGrowth26.display * 100).toFixed(1))
        : 0
    );
    const unitGrowths = barChartItems.map((n) =>
      n.unitsGrowth26.display !== null
        ? Number((n.unitsGrowth26.display * 100).toFixed(1))
        : 0
    );

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const item = barChartItems[idx];
          if (!item) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700;margin-bottom:4px">${item.name}</div>
              ${item.subtitle ? `<div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${item.subtitle}</div>` : ''}
              <div>2026 ${measure === 'value' ? 'Value' : 'Units'}: <b>${formatExactValue(item.v2026, measure)}</b> (${formatSharePct(item.share26)} share)</div>
              <div>LC Value Growth: <b style="color:${(item.valueGrowth26.raw ?? 0) >= 0 ? '#10b981' : '#f43f5e'}">${formatGrowthMetric(item.valueGrowth26)}</b></div>
              <div>Units Growth: <b style="color:${(item.unitsGrowth26.raw ?? 0) >= 0 ? '#10b981' : '#f43f5e'}">${formatGrowthMetric(item.unitsGrowth26)}</b></div>
              <div>Evolution Index: <b>${item.evolutionIndex26?.toFixed(1) ?? '—'}</b></div>
              <div style="margin-top:4px;font-size:10px;color:#818cf8">Click bar to cross-filter report</div>
            </div>
          `;
        },
      },
      legend: {
        data: [
          `2026 ${measure === 'value' ? 'LC Value' : 'Units'}`,
          'LC Value Growth %',
          'Units Growth %',
        ],
        textStyle: { color: textColor, fontSize: 11 },
        top: 0,
      },
      grid: { left: 56, right: 56, top: 38, bottom: 85 },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          color: textColor,
          fontSize: 10,
          rotate: 35,
        },
        axisLine: { lineStyle: { color: gridColor } },
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
          name: 'Growth %',
          nameTextStyle: { color: textColor, fontSize: 10 },
          axisLabel: {
            color: textColor,
            fontSize: 10,
            formatter: (v: number) => `${v}%`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: `2026 ${measure === 'value' ? 'LC Value' : 'Units'}`,
          type: 'bar',
          data: values,
          itemStyle: {
            color: '#6366f1',
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: 'LC Value Growth %',
          type: 'line',
          yAxisIndex: 1,
          data: valGrowths,
          smooth: true,
          symbolSize: 6,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2.5, color: '#10b981' },
        },
        {
          name: 'Units Growth %',
          type: 'line',
          yAxisIndex: 1,
          data: unitGrowths,
          smooth: true,
          symbolSize: 6,
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 2, type: 'dashed', color: '#f59e0b' },
        },
      ],
    };
  }, [barChartItems, measure, textColor, gridColor]);

  // 2. Hierarchical Treemap: Product > Pack (Top 40 Products & their Packs) OR ATC1 > ATC4
  const treemapOption = useMemo(() => {
    const colorFromGrowth = (rawGrowth: number | null): string => {
      const w = winsoriseForColorScale(rawGrowth, -0.3, 0.6);
      if (w === null) return '#475569';
      if (w < 0) return '#e11d48';
      if (w < 0.1) return '#d97706';
      if (w < 0.25) return '#059669';
      return '#10b981';
    };

    const treeData =
      treemapMode === 'product_pack'
        ? bundle.productNodes.slice(0, 45).map((p) => ({
            name: p.name,
            value: p.v2026,
            dimKey: 'product' as DimensionKey,
            dictIdx: p.prodIdx,
            growthText: formatGrowthMetric(p.growth26),
            shareText: formatSharePct(p.share26),
            itemStyle: { color: colorFromGrowth(p.growth26.raw) },
            children: (p.children || []).map((pk) => ({
              name: `${p.name} • ${pk.name}`,
              value: pk.v2026,
              dimKey: 'pack' as DimensionKey,
              dictIdx: pk.packIdx,
              growthText: formatGrowthMetric(pk.growth26),
              shareText: formatSharePct(pk.share26),
              itemStyle: { color: colorFromGrowth(pk.growth26.raw) },
            })),
          }))
        : bundle.atc1Nodes.map((a1) => {
            const childAtc4s = bundle.atc4Nodes
              .filter((a4) => a4.atc1Idx === a1.atc1Idx)
              .slice(0, 25);
            return {
              name: a1.name,
              value: a1.v2026,
              dimKey: 'atc1' as DimensionKey,
              dictIdx: a1.atc1Idx,
              growthText: formatGrowthMetric(a1.growth26),
              shareText: formatSharePct(a1.share26),
              children: childAtc4s.map((a4) => ({
                name: a4.name,
                value: a4.v2026,
                dimKey: 'atc4' as DimensionKey,
                dictIdx: a4.atc4Idx,
                growthText: formatGrowthMetric(a4.growth26),
                shareText: formatSharePct(a4.share26),
                itemStyle: { color: colorFromGrowth(a4.growth26.raw) },
              })),
            };
          });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (info: any) => {
          const d = info.data;
          if (!d) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${d.name}</div>
              <div>2026 ${measure === 'value' ? 'Value' : 'Units'}: <b>${formatExactValue(d.value, measure)}</b> (${d.shareText || ''})</div>
              <div>YoY Growth: <b>${d.growthText || '—'}</b></div>
              <div style="margin-top:4px;font-size:10px;color:#818cf8">Click tile to filter globally</div>
            </div>
          `;
        },
      },
      series: [
        {
          name:
            treemapMode === 'product_pack'
              ? 'Top Products > Packs'
              : 'ATC1 > ATC4',
          type: 'treemap',
          roam: false,
          leafDepth: 1,
          upperLabel: {
            show: true,
            height: 22,
            color: '#fff',
            fontSize: 11,
            fontWeight: 'bold',
          },
          itemStyle: {
            borderColor: isDark ? '#0f172a' : '#ffffff',
            borderWidth: 1.5,
            gapWidth: 1.5,
          },
          label: {
            show: true,
            formatter: (params: any) =>
              `${params.name}\n${formatCompactValue(params.value, measure)} (${params.data.growthText || ''})`,
            fontSize: 10,
          },
          data: treeData,
        },
      ],
    };
  }, [bundle, treemapMode, measure, isDark]);

  // 3. Product Pareto 80/20 Curve Option (Section H)
  const paretoOption = useMemo(() => {
    const pts = bundle.pareto.points;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const pt = pts[idx];
          if (!pt) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">Rank #${pt.rank}: ${pt.name}</div>
              <div>2026 Sales: <b>${formatExactValue(pt.value26, measure)}</b> (${pt.sharePct.toFixed(2)}%)</div>
              <div>Cumulative Share (Top ${pt.rank} Products): <b>${pt.cumSharePct.toFixed(1)}%</b></div>
            </div>
          `;
        },
      },
      grid: { left: 55, right: 55, top: 30, bottom: 45 },
      xAxis: {
        type: 'category',
        name: 'Product Rank',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: textColor, fontSize: 11 },
        data: pts.map((p) => `#${p.rank}`),
        axisLabel: { color: textColor, fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Product Sales',
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
          name: 'Cumulative Share %',
          min: 0,
          max: 100,
          nameTextStyle: { color: textColor, fontSize: 10 },
          axisLabel: {
            color: textColor,
            fontSize: 10,
            formatter: (v: number) => `${v}%`,
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Product Sales',
          type: 'bar',
          data: pts.map((p) => p.value26),
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'Cumulative Share %',
          type: 'line',
          yAxisIndex: 1,
          data: pts.map((p) => Number(p.cumSharePct.toFixed(2))),
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2.5, color: '#10b981' },
          markLine: {
            silent: true,
            lineStyle: { color: '#f59e0b', type: 'dashed' },
            data: [{ yAxis: 80, name: '80% Pareto Threshold' }],
          },
        },
      ],
    };
  }, [bundle.pareto.points, measure, textColor, gridColor]);

  return (
    <div className="space-y-6">
      {/* Row 1: Market Structure Bar Chart + Growth Overlay & Hierarchical Treemap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card B1: Size Bar Chart with Value & Units Growth Overlay */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-500" />
                <span>
                  B1. Market Structure — Size &amp; Dual Growth Overlay (
                  {period.toUpperCase()} Aug 2026)
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compares 2026 scale against both LC Value Growth % and Units Growth %
              </p>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              {(
                [
                  ['product', 'Top Products'],
                  ['pack', 'Top Packs'],
                  ['atc4', 'Top ATC4'],
                  ['atc1', 'ATC1 Classes'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBarScope(key)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    barScope === key
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[370px] w-full">
            <ReactECharts
              option={barOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => {
                  const item = barChartItems[params.dataIndex];
                  if (item?.dimKey && item.dictIdx !== undefined && item.dictIdx >= 0) {
                    toggleFilterValue(item.dimKey, item.dictIdx);
                  }
                },
              }}
            />
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Click any bar to cross-filter the report by that {barScope.toUpperCase()}.</span>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById('explorer-table-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="inline-flex items-center gap-1 font-semibold text-indigo-500 hover:text-indigo-400"
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Scroll to Product &gt; Pack Table</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card B2: Hierarchical Treemap (Product > Pack or ATC1 > ATC4) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Grid className="w-4 h-4 text-emerald-500" />
                <span>B2. Hierarchical Market Treemap (Colored by Winsorised Growth)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Area = 2026 {measure === 'value' ? 'LC Value' : 'Units'} • Colour = YoY Growth (Red &lt;0%, Amber 0–10%, Green &gt;10%)
              </p>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setTreemapMode('product_pack')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  treemapMode === 'product_pack'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Product &gt; Pack
              </button>
              <button
                type="button"
                onClick={() => setTreemapMode('atc1_atc4')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  treemapMode === 'atc1_atc4'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                ATC1 &gt; ATC4
              </button>
            </div>
          </div>

          <div className="h-[370px] w-full">
            <ReactECharts
              option={treemapOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => {
                  const d = params?.data;
                  if (d?.dimKey && typeof d.dictIdx === 'number' && d.dictIdx >= 0) {
                    toggleFilterValue(d.dimKey, d.dictIdx);
                  }
                },
              }}
            />
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Click any tile to drill down or filter globally.</span>
            <span className="font-mono text-[10px]">
              Winsorised colour scale [-30%, +60%]
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Section H — Product Pareto 80/20 Curve + ATC4 Concentration & HHI Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Card H1: Product Pareto (80/20) Curve */}
        <div className="xl:col-span-5 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-500" />
              <span>H1. Product Pareto (80/20) Concentration Curve</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Top <strong>{bundle.pareto.countFor50Pct.toLocaleString()}</strong> products generate{' '}
              <strong>50%</strong> of scope sales; Top{' '}
              <strong>{bundle.pareto.countFor80Pct.toLocaleString()}</strong> products (of{' '}
              {bundle.pareto.totalActiveProducts.toLocaleString()} active) generate{' '}
              <strong>80%</strong>.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              <div className="text-[10px] uppercase text-slate-400">Top-5 Brands</div>
              <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                {bundle.pareto.top5SharePct.toFixed(1)}%
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              <div className="text-[10px] uppercase text-slate-400">Top-10 Brands</div>
              <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                {bundle.pareto.top10SharePct.toFixed(1)}%
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              <div className="text-[10px] uppercase text-slate-400">80% Cutoff</div>
              <div className="text-base font-bold font-mono text-emerald-500">
                {bundle.pareto.countFor80Pct.toLocaleString()} prods
              </div>
            </div>
          </div>

          <div className="h-[310px] w-full">
            <ReactECharts
              option={paretoOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (params: any) => {
                  const pt = bundle.pareto.points[params.dataIndex];
                  if (pt && pt.prodIdx >= 0) {
                    toggleFilterValue('product', pt.prodIdx);
                  }
                },
              }}
            />
          </div>
        </div>

        {/* Card H2: Top-5 / Top-10 Share & HHI per ATC4 + Lead Brand */}
        <div className="xl:col-span-7 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-500" />
                <span>
                  H2. Brand Concentration &amp; HHI Index by Therapeutic Subclass (ATC4)
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Identifies monopolistic vs fragmented therapeutic classes and the #1 leading Product in each class
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {bundle.atc4Concentration.length} active ATC4s
            </span>
          </div>

          <div className="h-[375px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2 px-3">ATC4 Subclass</th>
                  <th className="py-2 px-2.5 text-right">2026 Sales</th>
                  <th className="py-2 px-2.5 text-right">Brands</th>
                  <th className="py-2 px-2.5 text-right">Top-5 Share</th>
                  <th className="py-2 px-2.5 text-right">Top-10 Share</th>
                  <th className="py-2 px-2.5 text-right">HHI Index</th>
                  <th className="py-2 px-3">#1 Brand (Share)</th>
                  <th className="py-2 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {bundle.atc4Concentration.slice(0, 60).map((row) => {
                  const hhiVal = row.hhi ? Math.round(row.hhi) : 0;
                  const hhiBadge =
                    hhiVal >= 2500
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : hhiVal >= 1500
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

                  return (
                    <tr
                      key={row.atc4Idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 max-w-[210px] truncate">
                        <div className="truncate" title={row.atc4Name}>
                          {row.atc4Name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {row.atc1Name}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold">
                        {formatCompactValue(row.v2026, measure)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-500">
                        {row.productCount}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        {row.top5SharePct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-500">
                        {row.top10SharePct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold border ${hhiBadge}`}
                        >
                          {hhiVal.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-[160px] truncate">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-300">
                          {row.topProductName}
                        </span>{' '}
                        <span className="font-mono text-[11px] text-slate-400">
                          ({row.topProductSharePct.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleFilterValue('atc4', row.atc4Idx)}
                            className="p-1 rounded hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400"
                            title="Filter report by this ATC4"
                          >
                            <Filter className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => drillToProductsInTable('atc4', row.atc4Idx)}
                            className="p-1 rounded hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400"
                            title="Inspect Products & Packs of this ATC4 in Main Table"
                          >
                            <Table2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
