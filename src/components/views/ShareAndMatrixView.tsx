import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  GitCommit,
  Zap,
} from 'lucide-react';
import type { ScopedAnalyticsBundle } from '../../lib/analyticsEngine';
import {
  formatCompactValue,
  formatEvolutionIndex,
  formatExactValue,
  formatGrowthMetric,
  formatPp,
  formatSharePct,
} from '../../lib/formatters';
import { winsoriseForColorScale } from '../../lib/metrics';
import { useMarketStore } from '../../store/useMarketStore';

interface ShareAndMatrixViewProps {
  bundle: ScopedAnalyticsBundle;
}

export const ShareAndMatrixView: React.FC<ShareAndMatrixViewProps> = ({ bundle }) => {
  const { measure, theme, toggleFilterValue } = useMarketStore();

  const [scope, setScope] = useState<'product' | 'pack' | 'nfc1' | 'atc4'>('product');

  const isDark = theme === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#1e293b';
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0';

  const activeItems = useMemo(() => {
    if (scope === 'product') return bundle.productNodes;
    if (scope === 'pack') return bundle.packNodes;
    if (scope === 'nfc1') return bundle.nfc1Nodes;
    return bundle.atc4Nodes;
  }, [bundle, scope]);

  // 1. Section D: Growth-Share Bubble Matrix (Top 80 items with valid growth)
  const { matrixData, shareCutoffPct, mktGrowthPct, quadrantCounts } = useMemo(() => {
    const candidates = activeItems
      .filter((n) => n.v2026 > 0 && n.v2025 > 0 && n.growth26.raw !== null)
      .slice(0, 80);

    const mktG = (bundle.scopeTotalNode.growth26.raw ?? 0) * 100;
    const shares = candidates.map((n) => (n.share26 || 0) * 100);
    const avgShare =
      shares.length > 0 ? shares.reduce((a, b) => a + b, 0) / shares.length : 1;

    let stars = 0,
      cashCows = 0,
      rising = 0,
      declining = 0;

    for (const c of candidates) {
      const s = (c.share26 || 0) * 100;
      const g = (c.growth26.raw || 0) * 100;
      if (s >= avgShare && g >= mktG) stars++;
      else if (s >= avgShare && g < mktG) cashCows++;
      else if (s < avgShare && g >= mktG) rising++;
      else declining++;
    }

    return {
      matrixData: candidates,
      shareCutoffPct: Number(avgShare.toFixed(2)),
      mktGrowthPct: Number(mktG.toFixed(1)),
      quadrantCounts: { stars, cashCows, rising, declining },
    };
  }, [activeItems, bundle.scopeTotalNode.growth26.raw]);

  const bubbleMatrixOption = useMemo(() => {
    const maxVal = Math.max(...matrixData.map((d) => d.v2026), 1);

    const seriesData = matrixData.map((n) => {
      const sharePct = Number(((n.share26 || 0) * 100).toFixed(3));
      const growthPct = Number(
        (Math.min(Math.max(n.growth26.raw || 0, -0.8), 2.5) * 100).toFixed(1)
      );
      const ei = n.evolutionIndex26 ?? 100;
      const winEi = winsoriseForColorScale(ei, 60, 150) ?? 100;

      let color = '#64748b';
      if (winEi >= 115) color = '#10b981';
      else if (winEi >= 100) color = '#34d399';
      else if (winEi >= 85) color = '#f59e0b';
      else color = '#f43f5e';

      return {
        value: [sharePct, growthPct, n.v2026, ei],
        name: n.name,
        node: n,
        symbolSize: Math.max(10, Math.min(48, Math.sqrt(n.v2026 / maxVal) * 46)),
        itemStyle: {
          color,
          opacity: 0.85,
          borderColor: isDark ? '#0f172a' : '#fff',
          borderWidth: 1,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
        formatter: (param: any) => {
          const n = param.data?.node;
          if (!n) return '';
          const s = (n.share26 || 0) * 100;
          const g = (n.growth26.raw || 0) * 100;
          const quad =
            s >= shareCutoffPct && g >= mktGrowthPct
              ? '★ Star (High Share, Outgrowing Market)'
              : s >= shareCutoffPct && g < mktGrowthPct
              ? '● Cash Cow (High Share, Below Market Growth)'
              : s < shareCutoffPct && g >= mktGrowthPct
              ? '▲ Rising Challenger (Growing Share)'
              : '▼ Declining (Losing Share)';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${n.name}</div>
              <div style="color:#818cf8;font-size:11px;margin-bottom:4px">${quad}</div>
              <div>2026 Sales: <b>${formatExactValue(n.v2026, measure)}</b></div>
              <div>Scope Market Share: <b>${formatSharePct(n.share26)}</b></div>
              <div>2026 YoY Growth: <b>${formatGrowthMetric(n.growth26)}</b></div>
              <div>Evolution Index: <b>${formatEvolutionIndex(n.evolutionIndex26)}</b></div>
            </div>
          `;
        },
      },
      grid: { left: 55, right: 35, top: 30, bottom: 45 },
      xAxis: {
        type: 'value',
        name: '2026 Market Share (%)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        name: '2026 Growth (%)',
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          type: 'scatter',
          data: seriesData,
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) =>
              p.data.symbolSize >= 18 ? p.data.name.slice(0, 14) : '',
            fontSize: 9,
            color: textColor,
          },
          markLine: {
            silent: true,
            lineStyle: { color: '#6366f1', type: 'dashed', width: 1.5 },
            data: [
              {
                yAxis: mktGrowthPct,
                name: `Scope Growth (${mktGrowthPct}%)`,
              },
              {
                xAxis: shareCutoffPct,
                name: `Avg Top Share (${shareCutoffPct}%)`,
              },
            ],
          },
        },
      ],
    };
  }, [matrixData, shareCutoffPct, mktGrowthPct, measure, isDark, textColor, gridColor]);

  // 2. Section E: Share Shift Slope/Bump Chart (2024 -> 2025 -> 2026) & Gainers/Losers
  const slopeOption = useMemo(() => {
    const top10 = activeItems.slice(0, 10);
    const palette = [
      '#6366f1',
      '#10b981',
      '#f59e0b',
      '#ec4899',
      '#06b6d4',
      '#8b5cf6',
      '#14b8a6',
      '#f43f5e',
      '#3b82f6',
      '#eab308',
    ];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
      },
      legend: {
        data: top10.map((n) => n.name),
        textStyle: { color: textColor, fontSize: 10 },
        type: 'scroll',
        bottom: 0,
      },
      grid: { left: 50, right: 30, top: 20, bottom: 45 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['Aug 2024', 'Aug 2025', 'Aug 2026'],
        axisLabel: { color: textColor, fontSize: 11, fontWeight: 'bold' },
      },
      yAxis: {
        type: 'value',
        name: 'Market Share (%)',
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: top10.map((n, idx) => ({
        name: n.name,
        type: 'line',
        smooth: 0.2,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: palette[idx % palette.length] },
        itemStyle: { color: palette[idx % palette.length] },
        data: [
          Number(((n.share24 || 0) * 100).toFixed(2)),
          Number(((n.share25 || 0) * 100).toFixed(2)),
          Number(((n.share26 || 0) * 100).toFixed(2)),
        ],
      })),
    };
  }, [activeItems, textColor, gridColor]);

  const { shareGainers, shareLosers } = useMemo(() => {
    const withDelta = activeItems.filter((n) => n.deltaShare26_25Pp !== null);
    const gainers = [...withDelta]
      .sort((a, b) => (b.deltaShare26_25Pp || 0) - (a.deltaShare26_25Pp || 0))
      .slice(0, 10);
    const losers = [...withDelta]
      .sort((a, b) => (a.deltaShare26_25Pp || 0) - (b.deltaShare26_25Pp || 0))
      .slice(0, 10);
    return { shareGainers: gainers, shareLosers: losers };
  }, [activeItems]);

  // 3. Section G: 2-yr CAGR vs Latest Growth Scatter (with 1:1 diagonal) + YTD-vs-MAT Momentum Bars
  const cagrScatterOption = useMemo(() => {
    const pts = activeItems
      .filter(
        (n) =>
          n.v2024 > 0 &&
          n.v2025 > 0 &&
          n.v2026 > 0 &&
          n.cagr24_26.raw !== null &&
          n.growth26.raw !== null
      )
      .slice(0, 80);

    const data = pts.map((n) => {
      const cagrPct = Number(
        (Math.min(Math.max(n.cagr24_26.raw || 0, -0.6), 1.8) * 100).toFixed(1)
      );
      const g26Pct = Number(
        (Math.min(Math.max(n.growth26.raw || 0, -0.6), 1.8) * 100).toFixed(1)
      );
      const isAccelerating = g26Pct >= cagrPct;
      return {
        value: [cagrPct, g26Pct],
        name: n.name,
        node: n,
        itemStyle: {
          color: isAccelerating ? '#10b981' : '#f43f5e',
          opacity: 0.8,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText: 'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
        formatter: (p: any) => {
          const n = p.data?.node;
          if (!n) return '';
          const accel = (n.growth26.raw || 0) >= (n.cagr24_26.raw || 0);
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${n.name}</div>
              <div style="color:${accel ? '#10b981' : '#f43f5e'};font-weight:600">
                ${accel ? '▲ Accelerating (Above 2-yr CAGR)' : '▼ Decelerating (Below 2-yr CAGR)'}
              </div>
              <div>2-yr CAGR, Aug-24 to Aug-26: <b>${formatGrowthMetric(n.cagr24_26)}</b></div>
              <div>Latest 2026 YoY Growth: <b>${formatGrowthMetric(n.growth26)}</b></div>
              <div>YTD vs MAT Momentum: <b>${n.momentum26 !== null ? formatPp(n.momentum26 * 100, 1) : '—'}</b></div>
            </div>
          `;
        },
      },
      grid: { left: 55, right: 30, top: 25, bottom: 45 },
      xAxis: {
        type: 'value',
        name: '2-yr CAGR, Aug-24 to Aug-26 (%)',
        nameLocation: 'middle',
        nameGap: 28,
        min: -40,
        max: 150,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        name: 'Latest 2026 Growth (%)',
        min: -40,
        max: 150,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 10,
          data,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#94a3b8', type: 'dashed', width: 1.5 },
            data: [
              [
                { coord: [-40, -40], name: '1:1 Diagonal (Latest = CAGR)' },
                { coord: [150, 150] },
              ],
            ],
          },
        },
      ],
    };
  }, [activeItems, textColor, gridColor]);

  const momentumBarsOption = useMemo(() => {
    const top50 = activeItems
      .slice(0, 60)
      .filter((n) => n.momentum26 !== null && Math.abs(n.momentum26) < 2);
    const sorted = [...top50].sort(
      (a, b) => (b.momentum26 || 0) - (a.momentum26 || 0)
    );
    const combined = [
      ...sorted.slice(0, 8),
      ...sorted.slice(-8),
    ].reverse();

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
          const item = combined[idx];
          if (!item) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${item.name}</div>
              <div>YTD vs MAT Momentum: <b>${formatPp((item.momentum26 || 0) * 100, 1)}</b></div>
              <div>2026 Sales: <b>${formatExactValue(item.v2026, measure)}</b></div>
            </div>
          `;
        },
      },
      grid: { left: 155, right: 30, top: 20, bottom: 35 },
      xAxis: {
        type: 'value',
        name: 'YTD Growth minus MAT Growth (pp)',
        nameLocation: 'middle',
        nameGap: 24,
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v} pp` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'category',
        data: combined.map((n) =>
          n.name.length > 22 ? `${n.name.slice(0, 20)}…` : n.name
        ),
        axisLabel: { color: textColor, fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: combined.map((n) => {
            const pp = Number(((n.momentum26 || 0) * 100).toFixed(1));
            return {
              value: pp,
              itemStyle: {
                color: pp >= 0 ? '#10b981' : '#f43f5e',
                borderRadius: pp >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
              },
            };
          }),
        },
      ],
    };
  }, [activeItems, measure, textColor, gridColor]);

  return (
    <div className="space-y-6">
      {/* Scope Switcher Banner */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05)] flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
          Select entity granularity for Matrix, Share Shift, and Momentum analyses:
        </div>
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
          {(
            [
              ['product', 'Products (Brands — Default)'],
              ['pack', 'Packs'],
              ['nfc1', 'NFC1 Dosage Forms'],
              ['atc4', 'ATC4 Classes'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                scope === k
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Section D — Growth-Share Bubble Matrix & Section E — Slope Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card D: Growth-Share Bubble Matrix */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>D. Growth-Share Bubble Matrix (Colored by Evolution Index)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              X = Share 26 • Y = Growth 26 • Size = 2026 Value • Colour = Winsorised EI (Green &gt;100, Red &lt;100)
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2.5 mb-3 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/25">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">★ Stars</div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {quadrantCounts.stars}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/25">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">● Cash Cows</div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {quadrantCounts.cashCows}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-500/25">
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide">▲ Rising</div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {quadrantCounts.rising}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/25">
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">▼ Declining</div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {quadrantCounts.declining}
              </div>
            </div>
          </div>

          <div className="h-[340px] w-full">
            <ReactECharts
              option={bubbleMatrixOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const n = p.data?.node;
                  if (n?.dimKey && n.dictIdx !== undefined) {
                    toggleFilterValue(n.dimKey, n.dictIdx);
                  }
                },
              }}
            />
          </div>
        </div>

        {/* Card E1: Share Shift Trajectory (2024 -> 2025 -> 2026) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>E1. Multi-Year Share Shift Trajectory (Aug 2024 → 2025 → 2026)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tracks 3-year market share progression for top 10 {scope.toUpperCase()}s in the current scope
            </p>
          </div>

          <div className="h-[400px] w-full">
            <ReactECharts option={slopeOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Row 2: Section E2 — Ranked Table of Share Gainers & Losers (pp) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          E2. Ranked Market Share Gainers &amp; Losers (Δ Share pp, 2026 vs 2025)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Share Gainers */}
          <div>
            <div className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" />
              <span>Top 10 Share Gainers (+pp)</span>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-2 text-right">Share 24</th>
                    <th className="py-2.5 px-2 text-right">Share 25</th>
                    <th className="py-2.5 px-2 text-right">Share 26</th>
                    <th className="py-2.5 px-3 text-right">Δ Share (pp)</th>
                    <th className="py-2.5 px-2 text-right">EI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {shareGainers.map((n) => (
                    <tr
                      key={n.id}
                      onClick={() =>
                        n.dimKey && n.dictIdx !== undefined && toggleFilterValue(n.dimKey, n.dictIdx)
                      }
                      className="hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-semibold max-w-[190px] truncate text-slate-800 dark:text-slate-200">
                        {n.name}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatSharePct(n.share24)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatSharePct(n.share25)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatSharePct(n.share26)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPp(n.deltaShare26_25Pp, 2)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-medium">
                        {formatEvolutionIndex(n.evolutionIndex26)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Share Losers */}
          <div>
            <div className="text-xs font-bold uppercase text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1">
              <ArrowDownRight className="w-4 h-4" />
              <span>Top 10 Share Losers (-pp)</span>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-900 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-2 text-right">Share 24</th>
                    <th className="py-2.5 px-2 text-right">Share 25</th>
                    <th className="py-2.5 px-2 text-right">Share 26</th>
                    <th className="py-2.5 px-3 text-right">Δ Share (pp)</th>
                    <th className="py-2.5 px-2 text-right">EI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {shareLosers.map((n) => (
                    <tr
                      key={n.id}
                      onClick={() =>
                        n.dimKey && n.dictIdx !== undefined && toggleFilterValue(n.dimKey, n.dictIdx)
                      }
                      className="hover:bg-rose-50/50 dark:hover:bg-rose-500/10 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 font-semibold max-w-[190px] truncate text-slate-800 dark:text-slate-200">
                        {n.name}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatSharePct(n.share24)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-500 dark:text-slate-400">
                        {formatSharePct(n.share25)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatSharePct(n.share26)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatPp(n.deltaShare26_25Pp, 2)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-medium">
                        {formatEvolutionIndex(n.evolutionIndex26)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Section G — CAGR vs Latest Growth Scatter & YTD-vs-MAT Momentum Bars */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card G1: CAGR vs Latest Growth Scatter */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>G1. 2-yr CAGR vs Latest 2026 Growth Scatter (Acceleration Diagonal)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Above 1:1 diagonal (Green) = Accelerating in 2026 vs 2-yr CAGR • Below diagonal (Red) = Decelerating
            </p>
          </div>
          <div className="h-[360px] w-full">
            <ReactECharts option={cagrScatterOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        {/* Card G2: YTD vs MAT Momentum Bars */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>G2. Short-Term Momentum: YTD Aug Growth minus MAT Aug Growth (pp)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Positive momentum (Green) = YTD 2026 growth is outpacing the 12-month MAT trend
            </p>
          </div>
          <div className="h-[360px] w-full">
            <ReactECharts option={momentumBarsOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
