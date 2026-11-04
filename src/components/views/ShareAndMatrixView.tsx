import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Compass,
  Crosshair,
  GitCommit,
  TrendingUp,
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
import { calcShareOfGrowthPct, winsoriseForColorScale } from '../../lib/metrics';
import { useMarketStore } from '../../store/useMarketStore';
import { AnalyticsChartCard } from '../charts/AnalyticsChartCard';

interface ShareAndMatrixViewProps {
  bundle: ScopedAnalyticsBundle;
}

export const ShareAndMatrixView: React.FC<ShareAndMatrixViewProps> = ({ bundle }) => {
  const { measure, theme, toggleFilterValue } = useMarketStore();

  const [scope, setScope] = useState<'product' | 'pack' | 'nfc1' | 'atc4'>('product');
  const [includeLaunchesInSog, setIncludeLaunchesInSog] = useState<boolean>(true);
  const [minShareFilterPct, setMinShareFilterPct] = useState<number>(0);

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
  const { matrixData, shareCutoffPct, mktGrowthPct, quadrantCounts, excludedDCount } = useMemo(() => {
    const activePositive = activeItems.filter((n) => n.v2026 > 0);
    const validGrowth = activePositive.filter(
      (n) => n.v2025 > 0 && n.growth26.raw !== null
    );
    const candidates = validGrowth.slice(0, 80);
    const excludedCount = activePositive.length - validGrowth.length;

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
      excludedDCount: excludedCount,
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
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
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
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bubble to filter scope</div>
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
          cursor: 'pointer',
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

  // NC-4 (Section N): Share of Market vs Share of Growth (SOM-SOG Matrix)
  const {
    sogPoints,
    sogAvgSharePct,
    sogQuadCounts,
    isScopeContracting,
    scopeAbsGrowth,
  } = useMemo(() => {
    const scopeAbs = bundle.scopeTotalNode.absGrowth26;
    const isContracting = scopeAbs <= 0;

    const filtered = activeItems
      .filter((n) => {
        if (n.v2026 <= 0) return false;
        const isLaunch = n.v2025 <= 0 && n.v2026 > 0;
        if (!includeLaunchesInSog && isLaunch) return false;
        const sharePct = (n.share26 || 0) * 100;
        if (sharePct < minShareFilterPct) return false;
        return true;
      })
      .slice(0, 80);

    const avgS =
      filtered.length > 0
        ? filtered.reduce((acc, n) => acc + (n.share26 || 0) * 100, 0) / filtered.length
        : 1;

    let growthThieves = 0,
      entitledLeaders = 0,
      underAttack = 0,
      bleeders = 0;

    const pts = filtered.map((n) => {
      const somPct = (n.share26 || 0) * 100;
      const rawSogPct = calcShareOfGrowthPct(n.absGrowth26, scopeAbs) ?? 0;
      const winSogPct = winsoriseForColorScale(rawSogPct, -80, 120) ?? 0;
      const isLaunch = n.v2025 <= 0 && n.v2026 > 0;

      if (rawSogPct < 0) bleeders++;
      else if (rawSogPct >= somPct && somPct >= avgS) entitledLeaders++;
      else if (rawSogPct >= somPct && somPct < avgS) growthThieves++;
      else underAttack++;

      return {
        node: n,
        somPct: Number(somPct.toFixed(3)),
        rawSogPct: Number(rawSogPct.toFixed(2)),
        winSogPct: Number(winSogPct.toFixed(2)),
        isLaunch,
      };
    });

    return {
      sogPoints: pts,
      sogAvgSharePct: Number(avgS.toFixed(2)),
      sogQuadCounts: { growthThieves, entitledLeaders, underAttack, bleeders },
      isScopeContracting: isContracting,
      scopeAbsGrowth: scopeAbs,
    };
  }, [activeItems, bundle.scopeTotalNode.absGrowth26, includeLaunchesInSog, minShareFilterPct]);

  const somSogOption = useMemo(() => {
    const maxVal = Math.max(...sogPoints.map((p) => p.node.v2026), 1);
    const maxSom = Math.max(...sogPoints.map((p) => p.somPct), 5);
    const diagMax = Math.min(Math.ceil(maxSom * 1.15), 100);

    const seriesData = sogPoints.map((p) => {
      const n = p.node;
      let color = '#64748b';
      if (p.isLaunch) {
        color = '#8b5cf6'; // Violet for new 2026 launches
      } else if (p.rawSogPct < 0) {
        color = '#f43f5e';
      } else if (p.rawSogPct >= p.somPct) {
        color = '#10b981';
      } else {
        color = '#f59e0b';
      }

      return {
        value: [p.somPct, p.winSogPct, n.v2026, p.rawSogPct],
        name: n.name,
        node: n,
        rawSogPct: p.rawSogPct,
        isLaunch: p.isLaunch,
        symbol: p.isLaunch ? 'diamond' : 'circle',
        symbolSize: Math.max(10, Math.min(46, Math.sqrt(n.v2026 / maxVal) * 44)),
        itemStyle: {
          color,
          opacity: 0.86,
          borderColor: isDark ? '#0f172a' : '#ffffff',
          borderWidth: 1.2,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
        formatter: (param: any) => {
          const d = param.data;
          const n = d?.node;
          if (!n) return '';
          const som = d.value[0];
          const rawSog = d.rawSogPct;
          const statusLabel = d.isLaunch
            ? '◆ 2026 New Launch (100% Incremental)'
            : rawSog < 0
            ? '▼ Value Bleeder (Negative Growth Contribution)'
            : rawSog >= som
            ? '★ Punching Above Weight (SOG ≥ SOM)'
            : '● Under-Indexing Growth (0% ≤ SOG < SOM)';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${n.name}</div>
              <div style="color:#818cf8;font-size:11px;margin-bottom:4px">${statusLabel}</div>
              <div>Share of Market (SOM 26): <b>${som.toFixed(2)}%</b></div>
              <div>Share of Growth (SOG 26): <b>${rawSog >= 0 ? '+' : ''}${rawSog.toFixed(2)}%</b></div>
              <div>Net Abs. Change: <b>${formatCompactValue(n.absGrowth26, measure)}</b></div>
              <div>2026 Sales: <b>${formatExactValue(n.v2026, measure)}</b></div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bubble to filter scope</div>
            </div>
          `;
        },
      },
      grid: { left: 58, right: 35, top: 30, bottom: 45 },
      xAxis: {
        type: 'value',
        name: 'Share of Market — SOM 2026 (%)',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        name: 'Share of Growth — SOG 2026 (%)',
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          type: 'scatter',
          cursor: 'pointer',
          data: seriesData,
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) =>
              p.data.symbolSize >= 17 ? p.data.name.slice(0, 14) : '',
            fontSize: 9,
            color: textColor,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#6366f1', type: 'dashed', width: 1.5 },
            data: [
              { yAxis: 0, name: 'Zero Growth Line (0%)' },
              [
                { coord: [0, 0], name: '1:1 Fair-Share Diagonal (SOG = SOM)' },
                { coord: [diagMax, diagMax] },
              ],
            ],
          },
        },
      ],
    };
  }, [sogPoints, measure, isDark, textColor, gridColor]);

  // 2. Section E1: Share Shift Slope Chart (2024 -> 2025 -> 2026)
  const top10ForSlope = useMemo(() => activeItems.slice(0, 10), [activeItems]);

  const slopeOption = useMemo(() => {
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
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
      },
      legend: {
        data: top10ForSlope.map((n) => n.name),
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
      series: top10ForSlope.map((n, idx) => ({
        name: n.name,
        type: 'line',
        cursor: 'pointer',
        smooth: 0.2,
        symbolSize: 8,
        lineStyle: { width: 2.5, color: palette[idx % palette.length] },
        itemStyle: { color: palette[idx % palette.length] },
        data: [
          { value: Number(((n.share24 || 0) * 100).toFixed(2)), node: n },
          { value: Number(((n.share25 || 0) * 100).toFixed(2)), node: n },
          { value: Number(((n.share26 || 0) * 100).toFixed(2)), node: n },
        ],
      })),
    };
  }, [top10ForSlope, isDark, textColor, gridColor]);

  // NC-6 (Section E3): Brand Ladder Bump Chart (Rank Flow 24 -> 25 -> 26)
  const top10ForBump = useMemo(() => activeItems.filter((n) => n.v2026 > 0).slice(0, 10), [activeItems]);

  const bumpChartOption = useMemo(() => {
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
    const maxDisplayRank = Math.max(12, top10ForBump.length + 2);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
        formatter: (p: any) => {
          const n = p.data?.node;
          if (!n) return '';
          const r24 = n.rank24 ? `#${n.rank24}` : 'Not Active (New)';
          const r25 = n.rank25 ? `#${n.rank25}` : 'Not Active (New)';
          const r26 = n.rank ? `#${n.rank}` : '—';
          const netClimb =
            n.rank24 !== null && n.rank !== null ? n.rank24 - n.rank : null;
          const climbBadge =
            netClimb === null
              ? '◆ New Entrant since 2024'
              : netClimb > 0
              ? `▲ Climbed +${netClimb} ranks since 2024`
              : netClimb < 0
              ? `▼ Slipped ${netClimb} ranks since 2024`
              : '● Unchanged rank vs 2024';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${n.name}</div>
              <div style="color:#818cf8;font-size:11px;margin-bottom:4px">${climbBadge}</div>
              <div>Rank Trajectory: <b>${r24} → ${r25} → ${r26}</b></div>
              <div>Share Trajectory: <b>${formatSharePct(n.share24)} → ${formatSharePct(n.share25)} → ${formatSharePct(n.share26)}</b></div>
              <div>2026 Sales: <b>${formatExactValue(n.v2026, measure)}</b></div>
            </div>
          `;
        },
      },
      grid: { left: 48, right: 135, top: 20, bottom: 35 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['Aug 2024', 'Aug 2025', 'Aug 2026'],
        axisLabel: { color: textColor, fontSize: 11, fontWeight: 'bold' },
      },
      yAxis: {
        type: 'value',
        name: 'Scope Rank (#)',
        inverse: true,
        min: 1,
        max: maxDisplayRank,
        interval: 1,
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => (v === maxDisplayRank ? `>${maxDisplayRank - 1}` : `#${v}`),
        },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: top10ForBump.map((n, idx) => {
        const capRank = (r: number | null) =>
          r === null ? null : Math.min(r, maxDisplayRank);
        const r24 = capRank(n.rank24);
        const r25 = capRank(n.rank25);
        const r26 = capRank(n.rank);
        const delta25_26 =
          n.rank25 !== null && n.rank !== null ? n.rank25 - n.rank : null;
        const deltaTag =
          delta25_26 === null
            ? 'NEW'
            : delta25_26 > 0
            ? `▲+${delta25_26}`
            : delta25_26 < 0
            ? `▼${delta25_26}`
            : '•';

        return {
          name: n.name,
          type: 'line',
          cursor: 'pointer',
          smooth: 0.25,
          symbolSize: 9,
          connectNulls: false,
          lineStyle: { width: 3, color: palette[idx % palette.length] },
          itemStyle: { color: palette[idx % palette.length] },
          endLabel: {
            show: true,
            formatter: () => `#${n.rank} ${n.name.slice(0, 12)} (${deltaTag})`,
            color: textColor,
            fontSize: 10,
            fontWeight: 600,
          },
          data: [
            { value: r24, node: n },
            { value: r25, node: n },
            { value: r26, node: n },
          ],
        };
      }),
    };
  }, [top10ForBump, measure, isDark, textColor, gridColor]);

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

  // 3. Section G1: 2-yr CAGR vs Latest Growth Scatter (with 1:1 diagonal)
  const { cagrPoints, excludedG1Count } = useMemo(() => {
    const activePositive = activeItems.filter((n) => n.v2026 > 0);
    const valid = activePositive.filter(
      (n) =>
        n.v2024 > 0 &&
        n.v2025 > 0 &&
        n.cagr24_26.raw !== null &&
        n.growth26.raw !== null
    );
    return {
      cagrPoints: valid.slice(0, 80),
      excludedG1Count: activePositive.length - valid.length,
    };
  }, [activeItems]);

  const cagrScatterOption = useMemo(() => {
    const data = cagrPoints.map((n) => {
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
          opacity: 0.82,
        },
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
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
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click point to filter scope</div>
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
          cursor: 'pointer',
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
  }, [cagrPoints, isDark, textColor, gridColor]);

  // NC-5 (Section G3): Competitiveness Trajectory Quadrant (EI'25 vs EI'26)
  const { eiTrajectoryPoints, eiQuadCounts, excludedEiCount } = useMemo(() => {
    const activePositive = activeItems.filter((n) => n.v2026 > 0);
    const valid = activePositive.filter(
      (n) => n.evolutionIndex25 !== null && n.evolutionIndex26 !== null
    );
    const pts = valid.slice(0, 80);

    let sustainedOutperformers = 0,
      turnarounds = 0,
      coolingLeaders = 0,
      compoundingLosers = 0;

    for (const n of pts) {
      const ei25 = n.evolutionIndex25 || 0;
      const ei26 = n.evolutionIndex26 || 0;
      if (ei25 >= 100 && ei26 >= 100) sustainedOutperformers++;
      else if (ei25 < 100 && ei26 >= 100) turnarounds++;
      else if (ei25 >= 100 && ei26 < 100) coolingLeaders++;
      else compoundingLosers++;
    }

    return {
      eiTrajectoryPoints: pts,
      eiQuadCounts: {
        sustainedOutperformers,
        turnarounds,
        coolingLeaders,
        compoundingLosers,
      },
      excludedEiCount: activePositive.length - valid.length,
    };
  }, [activeItems]);

  const eiTrajectoryOption = useMemo(() => {
    const maxVal = Math.max(...eiTrajectoryPoints.map((d) => d.v2026), 1);

    const data = eiTrajectoryPoints.map((n) => {
      const rawEi25 = n.evolutionIndex25 || 100;
      const rawEi26 = n.evolutionIndex26 || 100;
      const winEi25 = Number((winsoriseForColorScale(rawEi25, 40, 180) ?? 100).toFixed(1));
      const winEi26 = Number((winsoriseForColorScale(rawEi26, 40, 180) ?? 100).toFixed(1));

      let color = '#64748b';
      if (rawEi26 >= 100 && rawEi25 >= 100) color = '#10b981'; // Sustained Outperformer
      else if (rawEi26 >= 100 && rawEi25 < 100) color = '#0ea5e9'; // Turnaround Winner
      else if (rawEi26 < 100 && rawEi25 >= 100) color = '#f59e0b'; // Cooling Incumbent
      else color = '#f43f5e'; // Compounding Loser

      return {
        value: [winEi25, winEi26, n.v2026],
        name: n.name,
        node: n,
        symbolSize: Math.max(9, Math.min(44, Math.sqrt(n.v2026 / maxVal) * 42)),
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
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
        formatter: (p: any) => {
          const n = p.data?.node;
          if (!n) return '';
          const ei25 = n.evolutionIndex25 || 0;
          const ei26 = n.evolutionIndex26 || 0;
          const quad =
            ei25 >= 100 && ei26 >= 100
              ? '★ Sustained Outperformer (EI 25 ≥ 100 & EI 26 ≥ 100)'
              : ei25 < 100 && ei26 >= 100
              ? '▲ Turnaround Winner (Rebounded to EI 26 ≥ 100)'
              : ei25 >= 100 && ei26 < 100
              ? '● Cooling Leader (Slipped below EI 26 < 100)'
              : '▼ Compounding Share Loser (EI < 100 both years)';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${n.name}</div>
              <div style="color:#818cf8;font-size:11px;margin-bottom:4px">${quad}</div>
              <div>2025 Evolution Index (vs '24): <b>${formatEvolutionIndex(n.evolutionIndex25)}</b></div>
              <div>2026 Evolution Index (vs '25): <b>${formatEvolutionIndex(n.evolutionIndex26)}</b></div>
              <div>2026 Sales: <b>${formatExactValue(n.v2026, measure)}</b></div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bubble to filter scope</div>
            </div>
          `;
        },
      },
      grid: { left: 55, right: 30, top: 25, bottom: 45 },
      xAxis: {
        type: 'value',
        name: '2025 Evolution Index (EI 25)',
        nameLocation: 'middle',
        nameGap: 28,
        min: 40,
        max: 180,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        name: '2026 Evolution Index (EI 26)',
        min: 40,
        max: 180,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          type: 'scatter',
          cursor: 'pointer',
          data,
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) =>
              p.data.symbolSize >= 17 ? p.data.name.slice(0, 14) : '',
            fontSize: 9,
            color: textColor,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#6366f1', type: 'dashed', width: 1.5 },
            data: [
              { xAxis: 100, name: 'EI 25 Parity (100)' },
              { yAxis: 100, name: 'EI 26 Parity (100)' },
              [
                { coord: [40, 40], name: '1:1 Trajectory Diagonal' },
                { coord: [180, 180] },
              ],
            ],
          },
        },
      ],
    };
  }, [eiTrajectoryPoints, measure, isDark, textColor, gridColor]);

  // 4. Section G2: YTD-vs-MAT Momentum Bars
  const momentumItems = useMemo(() => {
    const top50 = activeItems
      .slice(0, 60)
      .filter((n) => n.momentum26 !== null && Math.abs(n.momentum26) < 2);
    const sorted = [...top50].sort(
      (a, b) => (b.momentum26 || 0) - (a.momentum26 || 0)
    );
    return [...sorted.slice(0, 8), ...sorted.slice(-8)].reverse();
  }, [activeItems]);

  const momentumBarsOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
        formatter: (params: any[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const item = momentumItems[idx];
          if (!item) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${item.name}</div>
              <div>YTD vs MAT Momentum: <b>${formatPp((item.momentum26 || 0) * 100, 1)}</b></div>
              <div>2026 Sales: <b>${formatExactValue(item.v2026, measure)}</b></div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bar to filter scope</div>
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
        data: momentumItems.map((n) =>
          n.name.length > 22 ? `${n.name.slice(0, 20)}…` : n.name
        ),
        axisLabel: { color: textColor, fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          cursor: 'pointer',
          data: momentumItems.map((n) => {
            const pp = Number(((n.momentum26 || 0) * 100).toFixed(1));
            return {
              value: pp,
              node: n,
              itemStyle: {
                color: pp >= 0 ? '#10b981' : '#f43f5e',
                borderRadius: pp >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
              },
            };
          }),
        },
      ],
    };
  }, [momentumItems, measure, isDark, textColor, gridColor]);

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

      {/* Row 1: Section D — Growth-Share Bubble Matrix & Section N — SOM vs SOG Matrix (NC-4) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card D: Growth-Share Bubble Matrix */}
        <AnalyticsChartCard
          title="D. Growth-Share Bubble Matrix (Colored by Evolution Index)"
          subtitle="X = Share 26 • Y = Growth 26 • Size = 2026 Value • Colour = Winsorised EI (Green >100, Red <100)"
          icon={<Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          exportFilename={`growth-share-matrix-${scope}`}
          csvRows={matrixData.map((n) => ({
            Name: n.name,
            Level: n.level,
            Sales2026: n.v2026,
            Share2026Pct: Number(((n.share26 || 0) * 100).toFixed(3)),
            Growth2026Pct: n.growth26.raw !== null ? Number((n.growth26.raw * 100).toFixed(2)) : 'New',
            EvolutionIndex26: n.evolutionIndex26 !== null ? Number(n.evolutionIndex26.toFixed(1)) : 'New',
          }))}
          footnote={
            excludedDCount > 0
              ? `Showing top ${matrixData.length} incumbents with prior-year base (${excludedDCount} zero-base 2026 launches excluded from YoY % growth axis — see SOM–SOG Matrix for launch impact).`
              : undefined
          }
        >
          <div className="grid grid-cols-4 gap-2.5 mb-3 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/25">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                ★ Stars
              </div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {quadrantCounts.stars}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/25">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                ● Cash Cows
              </div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {quadrantCounts.cashCows}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-500/25">
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
                ▲ Rising
              </div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {quadrantCounts.rising}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/25">
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
                ▼ Declining
              </div>
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
        </AnalyticsChartCard>

        {/* Card N (NC-4): Share of Market vs Share of Growth (SOM-SOG Matrix) */}
        <AnalyticsChartCard
          title="N. Share of Market vs Share of Growth (SOM–SOG Matrix)"
          subtitle="X = SOM 26 (%) • Y = SOG 26 (% of net market expansion) • Above 1:1 line = Punching above weight"
          icon={<Crosshair className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
          exportFilename={`som-sog-matrix-${scope}`}
          controls={
            <div className="flex items-center gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => setIncludeLaunchesInSog((v) => !v)}
                className={`px-2 py-0.5 rounded-md font-semibold border transition-colors ${
                  includeLaunchesInSog
                    ? 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
                title="Include 2026 zero-base launches (diamond markers)"
              >
                {includeLaunchesInSog ? '◆ Launches On' : 'Launches Off'}
              </button>
              <button
                type="button"
                onClick={() => setMinShareFilterPct((v) => (v === 0 ? 0.1 : 0))}
                className={`px-2 py-0.5 rounded-md font-semibold border transition-colors ${
                  minShareFilterPct > 0
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
                title="Filter out micro-entities below 0.10% scope share"
              >
                {minShareFilterPct > 0 ? '≥0.1% Share' : 'All Shares'}
              </button>
            </div>
          }
          alertBanner={
            isScopeContracting ? (
              <span>
                <b>Market in contraction ({formatCompactValue(scopeAbsGrowth, measure)} net change):</b>{' '}
                Share of Growth (SOG %) is normalized against |net scope change| so positive growth contributors
                remain above 0% and decliners appear below 0%.
              </span>
            ) : undefined
          }
          csvRows={sogPoints.map((p) => ({
            Name: p.node.name,
            Level: p.node.level,
            IsLaunch2026: p.isLaunch,
            SOM_2026_Pct: p.somPct,
            SOG_2026_Pct: p.rawSogPct,
            AbsGrowth2026: p.node.absGrowth26,
            Sales2026: p.node.v2026,
          }))}
          footnote={`Avg top-entity SOM cutoff: ${sogAvgSharePct}% • Y-axis winsorised to [-80%, +120%] for visual clarity (exact SOG % shown in tooltip & CSV).`}
        >
          <div className="grid grid-cols-4 gap-2.5 mb-3 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/25">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                ★ Entitled Leaders
              </div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {sogQuadCounts.entitledLeaders}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-500/25">
              <div className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide">
                ▲ Growth Thieves
              </div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {sogQuadCounts.growthThieves}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/25">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                ● Under-Attack
              </div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {sogQuadCounts.underAttack}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/25">
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">
                ▼ Value Bleeders
              </div>
              <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
                {sogQuadCounts.bleeders}
              </div>
            </div>
          </div>

          <div className="h-[340px] w-full">
            <ReactECharts
              option={somSogOption}
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
        </AnalyticsChartCard>
      </div>

      {/* Row 2: Section E1 — Share Shift Trajectory & Section E3 — Brand Ladder Bump Chart (NC-6) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card E1: Share Shift Trajectory (2024 -> 2025 -> 2026) */}
        <AnalyticsChartCard
          title="E1. Multi-Year Share Shift Trajectory (Aug 2024 → 2025 → 2026)"
          subtitle={`Tracks 3-year market share progression for top 10 ${scope.toUpperCase()}s in the current scope (click line/point to filter)`}
          icon={<GitCommit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
          exportFilename={`share-shift-trajectory-${scope}`}
          csvRows={top10ForSlope.map((n) => ({
            Name: n.name,
            Share2024Pct: Number(((n.share24 || 0) * 100).toFixed(2)),
            Share2025Pct: Number(((n.share25 || 0) * 100).toFixed(2)),
            Share2026Pct: Number(((n.share26 || 0) * 100).toFixed(2)),
            DeltaShare26_25Pp: n.deltaShare26_25Pp !== null ? Number(n.deltaShare26_25Pp.toFixed(2)) : 0,
          }))}
        >
          <div className="h-[380px] w-full">
            <ReactECharts
              option={slopeOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const n = p.data?.node || top10ForSlope[p.seriesIndex];
                  if (n?.dimKey && n.dictIdx !== undefined) {
                    toggleFilterValue(n.dimKey, n.dictIdx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>

        {/* Card E3 (NC-6): Brand Ladder Bump Chart (Rank Flow 24 -> 25 -> 26) */}
        <AnalyticsChartCard
          title="E3. Brand Ladder Bump Chart (Rank Flow: Aug 2024 → 2025 → 2026)"
          subtitle={`Competition rank progression (#1 at top) for current top 10 ${scope.toUpperCase()}s • Click line to filter`}
          icon={<Award className="w-4 h-4 text-amber-500" />}
          exportFilename={`rank-bump-ladder-${scope}`}
          csvRows={top10ForBump.map((n) => ({
            Name: n.name,
            Rank2024: n.rank24 ?? 'New',
            Rank2025: n.rank25 ?? 'New',
            Rank2026: n.rank ?? '—',
            Share2026Pct: Number(((n.share26 || 0) * 100).toFixed(2)),
            Sales2026: n.v2026,
          }))}
          footnote="Entities ranked outside the top ladder in 2024/2025 are pinned to the bottom threshold (>11) so multi-year rank climbs remain visually continuous."
        >
          <div className="h-[380px] w-full">
            <ReactECharts
              option={bumpChartOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const n = p.data?.node || top10ForBump[p.seriesIndex];
                  if (n?.dimKey && n.dictIdx !== undefined) {
                    toggleFilterValue(n.dimKey, n.dictIdx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>
      </div>

      {/* Row 3: Section E2 — Ranked Table of Share Gainers & Losers (pp) */}
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

      {/* Row 4: Section G3 (NC-5) — EI'25 vs EI'26 Trajectory Quadrant & Section G1 — CAGR vs Latest Growth */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card G3 (NC-5): Competitiveness Trajectory Quadrant (EI'25 vs EI'26) */}
        <AnalyticsChartCard
          title="G3. Competitiveness Trajectory Quadrant (EI 2025 vs EI 2026)"
          subtitle="X = 2025 Evolution Index • Y = 2026 Evolution Index • Separates multi-year outperformers from turnarounds & faders"
          icon={<TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          exportFilename={`ei-trajectory-quadrant-${scope}`}
          csvRows={eiTrajectoryPoints.map((n) => ({
            Name: n.name,
            EI_2025: n.evolutionIndex25 !== null ? Number(n.evolutionIndex25.toFixed(1)) : 'New',
            EI_2026: n.evolutionIndex26 !== null ? Number(n.evolutionIndex26.toFixed(1)) : 'New',
            Sales2026: n.v2026,
            Share2026Pct: Number(((n.share26 || 0) * 100).toFixed(2)),
          }))}
          footnote={
            excludedEiCount > 0
              ? `Requires active sales in 2024, 2025, and 2026 (${excludedEiCount} newer launches excluded). Axes winsorised to [40, 180].`
              : 'Axes winsorised to [40, 180] for visual clarity.'
          }
        >
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/25">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                ★ Sustained (≥100)
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {eiQuadCounts.sustainedOutperformers}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-500/25">
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase">
                ▲ Turnaround
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {eiQuadCounts.turnarounds}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/25">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                ● Cooling
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {eiQuadCounts.coolingLeaders}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/25">
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">
                ▼ Compounding Drag
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {eiQuadCounts.compoundingLosers}
              </div>
            </div>
          </div>

          <div className="h-[340px] w-full">
            <ReactECharts
              option={eiTrajectoryOption}
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
        </AnalyticsChartCard>

        {/* Card G1: CAGR vs Latest Growth Scatter */}
        <AnalyticsChartCard
          title="G1. 2-yr CAGR vs Latest 2026 Growth Scatter (Acceleration Diagonal)"
          subtitle="Above 1:1 diagonal (Green) = Accelerating in 2026 vs 2-yr CAGR • Below diagonal (Red) = Decelerating"
          icon={<Zap className="w-4 h-4 text-amber-500" />}
          exportFilename={`cagr-vs-latest-growth-${scope}`}
          csvRows={cagrPoints.map((n) => ({
            Name: n.name,
            CAGR_24_26_Pct: n.cagr24_26.raw !== null ? Number((n.cagr24_26.raw * 100).toFixed(2)) : '—',
            Growth_2026_Pct: n.growth26.raw !== null ? Number((n.growth26.raw * 100).toFixed(2)) : '—',
            Momentum_YTD_vs_MAT_Pp: n.momentum26 !== null ? Number((n.momentum26 * 100).toFixed(2)) : '—',
            Sales2026: n.v2026,
          }))}
          footnote={
            excludedG1Count > 0
              ? `Showing top ${cagrPoints.length} 3-year incumbents (${excludedG1Count} entities without 2024/2025 base excluded).`
              : undefined
          }
        >
          <div className="h-[395px] w-full">
            <ReactECharts
              option={cagrScatterOption}
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
        </AnalyticsChartCard>
      </div>

      {/* Row 5: Card G2: YTD vs MAT Momentum Bars */}
      <AnalyticsChartCard
        title="G2. Short-Term Momentum: YTD Aug Growth minus MAT Aug Growth (pp)"
        subtitle="Positive momentum (Green) = YTD 2026 growth is outpacing the 12-month MAT trend • Click bar to filter"
        icon={<Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
        exportFilename={`short-term-momentum-${scope}`}
        periodBadge="YTD − MAT Δ"
        csvRows={momentumItems.map((n) => ({
          Name: n.name,
          Momentum_Pp: n.momentum26 !== null ? Number((n.momentum26 * 100).toFixed(2)) : 0,
          Sales2026: n.v2026,
        }))}
      >
        <div className="h-[340px] w-full">
          <ReactECharts
            option={momentumBarsOption}
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
      </AnalyticsChartCard>
    </div>
  );
};
