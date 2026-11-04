import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ArrowRight,
  BarChart2,
  Calendar,
  Compass,
  Filter,
  Grid,
  Layers,
  PieChart,
  ShieldAlert,
  Table2,
  Thermometer,
} from 'lucide-react';
import type { ScopedAnalyticsBundle } from '../../lib/analyticsEngine';
import {
  formatCompactValue,
  formatExactValue,
  formatGrowthMetric,
  formatPp,
  formatSharePct,
} from '../../lib/formatters';
import { winsoriseForColorScale } from '../../lib/metrics';
import { useMarketStore } from '../../store/useMarketStore';
import type { DimensionKey } from '../../types/market';
import { AnalyticsChartCard } from '../charts/AnalyticsChartCard';

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
  const [attractivenessAxis, setAttractivenessAxis] = useState<'growth26' | 'cagr'>('growth26');
  const [seasonalityDim, setSeasonalityDim] = useState<'atc4' | 'nfc1'>('atc4');

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
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
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
          cursor: 'pointer',
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
  }, [barChartItems, measure, isDark, textColor, gridColor]);

  // 2. Hierarchical Treemap: Product > Pack (Top 45 Products & their Packs) OR ATC1 > ATC4
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
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
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

  // 3. Product Pareto 80/20 Curve Option (Section H1)
  const paretoOption = useMemo(() => {
    const pts = bundle.pareto.points;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
        borderColor: isDark ? '#334155' : '#cbd5e1',
        textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
        formatter: (params: any[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const pt = pts[idx];
          if (!pt) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">Rank #${pt.rank}: ${pt.name}</div>
              <div>2026 Sales: <b>${formatExactValue(pt.value26, measure)}</b> (${pt.sharePct.toFixed(2)}%)</div>
              <div>Cumulative Share (Top ${pt.rank} Products): <b>${pt.cumSharePct.toFixed(1)}%</b></div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bar to filter by product</div>
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
          cursor: 'pointer',
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
  }, [bundle.pareto.points, measure, isDark, textColor, gridColor]);

  // 4. NC-1 (Section K): Class Attractiveness Matrix ("Where to Play" Grid)
  const { attractivenessRows, mktGrowthPct, medianClassSize, classQuadCounts } = useMemo(() => {
    const candidates = bundle.atc4Concentration
      .filter((r) => {
        const g = attractivenessAxis === 'growth26' ? r.growth26.raw : r.cagr24_26.raw;
        return r.v2026 > 0 && g !== null;
      })
      .slice(0, 80);

    const mktG =
      ((attractivenessAxis === 'growth26'
        ? bundle.scopeTotalNode.growth26.raw
        : bundle.scopeTotalNode.cagr24_26.raw) ?? 0) * 100;

    const sortedSizes = [...candidates.map((c) => c.v2026)].sort((a, b) => a - b);
    const medSize =
      sortedSizes.length > 0
        ? sortedSizes[Math.floor(sortedSizes.length / 2)]
        : 1e6;

    let scaleWinners = 0,
      cashCores = 0,
      selectiveBets = 0,
      structuralDrag = 0;

    for (const c of candidates) {
      const g =
        ((attractivenessAxis === 'growth26' ? c.growth26.raw : c.cagr24_26.raw) || 0) *
        100;
      if (c.v2026 >= medSize && g >= mktG) scaleWinners++;
      else if (c.v2026 >= medSize && g < mktG) cashCores++;
      else if (c.v2026 < medSize && g >= mktG) selectiveBets++;
      else structuralDrag++;
    }

    return {
      attractivenessRows: candidates,
      mktGrowthPct: Number(mktG.toFixed(1)),
      medianClassSize: medSize,
      classQuadCounts: { scaleWinners, cashCores, selectiveBets, structuralDrag },
    };
  }, [
    bundle.atc4Concentration,
    bundle.scopeTotalNode.growth26.raw,
    bundle.scopeTotalNode.cagr24_26.raw,
    attractivenessAxis,
  ]);

  const classAttractivenessOption = useMemo(() => {
    const maxVal = Math.max(...attractivenessRows.map((r) => r.v2026), 1);

    const data = attractivenessRows.map((r) => {
      const rawG =
        ((attractivenessAxis === 'growth26' ? r.growth26.raw : r.cagr24_26.raw) || 0) *
        100;
      const winG = Number((winsoriseForColorScale(rawG, -25, 80) ?? 0).toFixed(1));
      const hhiVal = r.hhi ? Math.round(r.hhi) : 0;

      // Color by HHI Concentration: Green (<1500 Contestable), Amber (1500-2500 Moderate), Rose (>=2500 Defended)
      const color =
        hhiVal >= 2500 ? '#f43f5e' : hhiVal >= 1500 ? '#f59e0b' : '#10b981';

      return {
        value: [winG, Math.max(1, r.v2026), hhiVal, rawG],
        name: r.atc4Name,
        row: r,
        symbolSize: Math.max(10, Math.min(46, Math.sqrt(r.v2026 / maxVal) * 44)),
        itemStyle: {
          color,
          opacity: 0.85,
          borderColor: isDark ? '#0f172a' : '#fff',
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
        formatter: (p: any) => {
          const r = p.data?.row;
          if (!r) return '';
          const hhiVal = r.hhi ? Math.round(r.hhi) : 0;
          const hhiTier =
            hhiVal >= 2500
              ? 'High Concentration / Defended (HHI ≥ 2,500)'
              : hhiVal >= 1500
              ? 'Moderate Concentration (HHI 1,500–2,500)'
              : 'Fragmented / Contestable (HHI < 1,500)';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${r.atc4Name}</div>
              <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${r.atc1Name}</div>
              <div>2026 Scale: <b>${formatExactValue(r.v2026, measure)}</b> (${r.productCount} brands)</div>
              <div>2026 YoY Growth: <b>${formatGrowthMetric(r.growth26)}</b></div>
              <div>2-yr CAGR (24→26): <b>${formatGrowthMetric(r.cagr24_26)}</b></div>
              <div>Class HHI: <b>${hhiVal.toLocaleString()}</b> — ${hhiTier}</div>
              <div>#1 Leader: <b>${r.topProductName}</b> (${r.topProductSharePct.toFixed(1)}%)</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bubble to filter by ATC4</div>
            </div>
          `;
        },
      },
      grid: { left: 64, right: 35, top: 28, bottom: 45 },
      xAxis: {
        type: 'value',
        name:
          attractivenessAxis === 'growth26'
            ? '2026 Class Growth % (Winsorised [-25%, +80%])'
            : '2-yr Class CAGR 24→26 % (Winsorised [-25%, +80%])',
        nameLocation: 'middle',
        nameGap: 28,
        min: -25,
        max: 80,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'log',
        name: `2026 Class ${measure === 'value' ? 'Sales (EGP, Log)' : 'Units (Log)'}`,
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => formatCompactValue(v, measure),
        },
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
              p.data.symbolSize >= 18 ? p.data.name.slice(0, 14) : '',
            fontSize: 9,
            color: textColor,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#6366f1', type: 'dashed', width: 1.5 },
            data: [
              { xAxis: mktGrowthPct, name: `Scope Benchmark (${mktGrowthPct}%)` },
              {
                yAxis: Math.max(1, medianClassSize),
                name: 'Median ATC4 Scale',
              },
            ],
          },
        },
      ],
    };
  }, [attractivenessRows, attractivenessAxis, mktGrowthPct, medianClassSize, measure, isDark, textColor, gridColor]);

  // 5. NC-3 (Section M): Market Health Heatmap (ATC1 × 6 Metrics)
  const { heatmapOption, heatmapCsvRows } = useMemo(() => {
    const rows = [...bundle.atc1Nodes].filter((n) => n.v2026 > 0);
    const colLabels = [
      'Val Growth 26',
      'Units Growth 26',
      'Price/Mix 26',
      'Δ Share (pp)',
      'Momentum (pp)',
      '2-yr Units CAGR',
    ];

    // Extract raw matrix [rowIdx][colIdx]
    const rawMatrix = rows.map((n) => [
      (n.valueGrowth26.raw ?? 0) * 100,
      (n.unitsGrowth26.raw ?? 0) * 100,
      (n.priceMixGrowth26 ?? 0) * 100,
      n.deltaShare26_25Pp ?? 0,
      (n.momentum26 ?? 0) * 100,
      (n.unitsCagr24_26.raw ?? 0) * 100,
    ]);

    const fmtMatrix = rows.map((n) => [
      formatGrowthMetric(n.valueGrowth26),
      formatGrowthMetric(n.unitsGrowth26),
      n.priceMixGrowth26 !== null
        ? `${n.priceMixGrowth26 >= 0 ? '+' : ''}${(n.priceMixGrowth26 * 100).toFixed(1)}%`
        : '—',
      formatPp(n.deltaShare26_25Pp, 2),
      n.momentum26 !== null ? formatPp(n.momentum26 * 100, 1) : '—',
      formatGrowthMetric(n.unitsCagr24_26),
    ]);

    // Column-wise normalization to [-1, +1] so each column's color gradient is self-scaled
    const colMinMax = colLabels.map((_, cIdx) => {
      const vals = rawMatrix.map((r) => r[cIdx]);
      const min = Math.min(...vals, 0);
      const max = Math.max(...vals, 0.01);
      return { min, max };
    });

    const cellData: any[] = [];
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      for (let cIdx = 0; cIdx < colLabels.length; cIdx++) {
        const rawVal = rawMatrix[rIdx][cIdx];
        const { min, max } = colMinMax[cIdx];
        let norm = 0;
        if (rawVal >= 0 && max > 0) norm = Math.min(1, rawVal / max);
        else if (rawVal < 0 && min < 0) norm = -Math.min(1, Math.abs(rawVal / min));

        cellData.push({
          value: [cIdx, rIdx, Number(norm.toFixed(3))],
          rawVal,
          displayStr: fmtMatrix[rIdx][cIdx],
          node: rows[rIdx],
          colName: colLabels[cIdx],
        });
      }
    }

    const csv = rows.map((n, rIdx) => ({
      ATC1_Class: n.name,
      Sales2026: n.v2026,
      ValueGrowth26Pct: Number(rawMatrix[rIdx][0].toFixed(2)),
      UnitsGrowth26Pct: Number(rawMatrix[rIdx][1].toFixed(2)),
      PriceMix26Pct: Number(rawMatrix[rIdx][2].toFixed(2)),
      DeltaSharePp: Number(rawMatrix[rIdx][3].toFixed(2)),
      MomentumPp: Number(rawMatrix[rIdx][4].toFixed(2)),
      UnitsCagr24_26Pct: Number(rawMatrix[rIdx][5].toFixed(2)),
    }));

    return {
      heatmapCsvRows: csv,
      heatmapOption: {
        backgroundColor: 'transparent',
        tooltip: {
          backgroundColor: isDark ? 'rgba(15,23,42,0.96)' : '#ffffff',
          borderColor: isDark ? '#334155' : '#cbd5e1',
          textStyle: { color: isDark ? '#f8fafc' : '#0f172a' },
          formatter: (p: any) => {
            const d = p.data;
            if (!d?.node) return '';
            return `
              <div style="font-size:12px;line-height:1.5">
                <div style="font-weight:700">${d.node.name}</div>
                <div>${d.colName}: <b>${d.displayStr}</b></div>
                <div>2026 Scale: <b>${formatExactValue(d.node.v2026, measure)}</b> (${formatSharePct(d.node.share26)})</div>
                <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click cell to filter report by this ATC1 class</div>
              </div>
            `;
          },
        },
        grid: { left: 210, right: 20, top: 32, bottom: 25 },
        xAxis: {
          type: 'category',
          position: 'top',
          data: colLabels,
          splitArea: { show: true },
          axisLabel: { color: textColor, fontSize: 10, fontWeight: 'bold' },
        },
        yAxis: {
          type: 'category',
          inverse: true,
          data: rows.map((r) => (r.name.length > 29 ? `${r.name.slice(0, 27)}…` : r.name)),
          axisLabel: { color: textColor, fontSize: 10 },
        },
        visualMap: {
          min: -1,
          max: 1,
          calculable: false,
          show: false,
          inRange: {
            color: isDark
              ? ['#881337', '#4c0519', '#1e293b', '#064e3b', '#059669']
              : ['#fecdd3', '#ffe4e6', '#f8fafc', '#d1fae5', '#6ee7b7'],
          },
        },
        series: [
          {
            name: 'ATC1 Health Matrix',
            type: 'heatmap',
            cursor: 'pointer',
            data: cellData,
            label: {
              show: true,
              formatter: (p: any) => p.data?.displayStr || '',
              color: isDark ? '#f8fafc' : '#0f172a',
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 600,
            },
            itemStyle: {
              borderColor: isDark ? '#0f172a' : '#ffffff',
              borderWidth: 2,
              borderRadius: 4,
            },
          },
        ],
      },
    };
  }, [bundle.atc1Nodes, measure, isDark, textColor]);

  // 6. NC-12 (Section P): Seasonality / Front-Load Index by Class
  const seasonalityRows = useMemo(() => {
    const src =
      seasonalityDim === 'atc4'
        ? bundle.seasonalityByAtc4.slice(0, 22)
        : bundle.seasonalityByNfc1;
    return [...src].filter((r) => r.index26 !== null).reverse();
  }, [bundle.seasonalityByAtc4, bundle.seasonalityByNfc1, seasonalityDim]);

  const seasonalityOption = useMemo(() => {
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
          const r = seasonalityRows[idx];
          if (!r) return '';
          const idx26 = r.index26 ?? 1;
          const idx25 = r.index25;
          const pacingLabel =
            idx26 >= 1.08
              ? '▲ Jan–Aug Front-Loaded Demand (≥ 1.08)'
              : idx26 <= 0.92
              ? '▼ Sep–Dec Q4 Back-Loaded Demand (≤ 0.92)'
              : '● Balanced Year-Round Pacing (0.92–1.08)';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${r.name}</div>
              <div style="color:#818cf8;font-size:11px;margin-bottom:4px">${pacingLabel}</div>
              <div>2026 Seasonality Index: <b>${idx26.toFixed(2)}x</b> (YTD = ${((r.ytd26 / Math.max(1, r.mat26)) * 100).toFixed(1)}% of MAT)</div>
              <div>2025 Seasonality Index: <b>${idx25 !== null ? `${idx25.toFixed(2)}x` : '—'}</b></div>
              <div>Implied Sep–Dec Tail Share: <b>${r.sepDecShare26 !== null ? `${(r.sepDecShare26 * 100).toFixed(1)}%` : '—'}</b></div>
              ${
                r.isUnstable
                  ? `<div style="color:#f59e0b;font-weight:700;margin-top:2px">⚠ High YoY Pacing Shift (${r.instabilitySwing! >= 0 ? '+' : ''}${r.instabilitySwing!.toFixed(2)}x vs 2025)</div>`
                  : ''
              }
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bar to filter report</div>
            </div>
          `;
        },
      },
      legend: {
        data: ['2026 Seasonality Index (Bar)', '2025 Index Benchmark (◆)'],
        textStyle: { color: textColor, fontSize: 10 },
        top: 0,
      },
      grid: { left: 185, right: 35, top: 28, bottom: 35 },
      xAxis: {
        type: 'value',
        name: 'Seasonality Index = (YTD / MAT) ÷ (8/12)  [1.00 = Even Pacing]',
        nameLocation: 'middle',
        nameGap: 24,
        min: 0.5,
        max: 1.4,
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v.toFixed(2)}x` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'category',
        data: seasonalityRows.map((r) =>
          `${r.isUnstable ? '⚠ ' : ''}${r.name.length > 24 ? `${r.name.slice(0, 22)}…` : r.name}`
        ),
        axisLabel: { color: textColor, fontSize: 10 },
      },
      series: [
        {
          name: '2026 Seasonality Index (Bar)',
          type: 'bar',
          cursor: 'pointer',
          data: seasonalityRows.map((r) => {
            const val = Number((r.index26 ?? 1).toFixed(2));
            const color =
              val >= 1.08 ? '#10b981' : val <= 0.92 ? '#f59e0b' : '#6366f1';
            return {
              value: val,
              row: r,
              itemStyle: { color, borderRadius: [0, 4, 4, 0] },
            };
          }),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 },
            data: [{ xAxis: 1.0, name: 'Neutral Pacing (1.00x)' }],
          },
        },
        {
          name: '2025 Index Benchmark (◆)',
          type: 'scatter',
          symbol: 'diamond',
          symbolSize: 9,
          itemStyle: {
            color: isDark ? '#f8fafc' : '#0f172a',
            borderColor: '#f59e0b',
            borderWidth: 1.5,
          },
          data: seasonalityRows.map((r) =>
            r.index25 !== null ? Number(r.index25.toFixed(2)) : null
          ),
        },
      ],
    };
  }, [seasonalityRows, isDark, textColor, gridColor]);

  const frag = bundle.revenueFragility;

  return (
    <div className="space-y-6">
      {/* NC-11 (Section H3): Revenue Fragility & Structural Concentration Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>
                H3. Revenue Fragility &amp; Structural Dependency Strip ({period.toUpperCase()} Aug 2026)
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Non-overlapping decomposition of 2026 scope revenue across multi-pack leaders, single-SKU brands, and zero-base launches
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            100% Scope Total = {formatCompactValue(frag.totalValue26, measure)}
          </span>
        </div>

        {/* 4 Stat Chips */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5">
          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-500/25">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Top-3 Multi-Pack Incumbents
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {frag.top3SharePct.toFixed(1)}%
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                ({frag.top3Count} brands)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Overall Top-3 raw share: {frag.rawTop3SharePct.toFixed(1)}%
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/25">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Single-Pack Incumbents
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {frag.singlePackSharePct.toFixed(1)}%
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                ({frag.singlePackCount.toLocaleString()} brands)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              100% reliant on a single presentation SKU
            </div>
          </div>

          <div className="p-3 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/80 dark:border-violet-500/25">
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              2026 New Brand Launches
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {frag.launchSharePct.toFixed(1)}%
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                ({frag.launchCount.toLocaleString()} launches)
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Zero 2025 base ({formatCompactValue(frag.launchValue26, measure)})
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/25">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              80% Pareto Concentration
            </div>
            <div className="text-lg font-mono font-bold text-slate-900 dark:text-white mt-0.5">
              {bundle.pareto.countFor80Pct.toLocaleString()}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                of {bundle.pareto.totalActiveProducts.toLocaleString()} brands
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Generate 80% of total scope volume/value
            </div>
          </div>
        </div>

        {/* 100% Stacked Horizontal Bar */}
        <div className="w-full h-5 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          {frag.top3SharePct > 0 && (
            <div
              style={{ width: `${frag.top3SharePct}%` }}
              className="bg-indigo-600 h-full transition-all"
              title={`Top-3 Multi-Pack Incumbents: ${frag.top3SharePct.toFixed(1)}% (${formatCompactValue(frag.top3Value26, measure)})`}
            />
          )}
          {frag.singlePackSharePct > 0 && (
            <div
              style={{ width: `${frag.singlePackSharePct}%` }}
              className="bg-amber-500 h-full transition-all"
              title={`Single-Pack Incumbents: ${frag.singlePackSharePct.toFixed(1)}% (${formatCompactValue(frag.singlePackValue26, measure)})`}
            />
          )}
          {frag.launchSharePct > 0 && (
            <div
              style={{ width: `${frag.launchSharePct}%` }}
              className="bg-violet-500 h-full transition-all"
              title={`2026 New Brand Launches: ${frag.launchSharePct.toFixed(1)}% (${formatCompactValue(frag.launchValue26, measure)})`}
            />
          )}
          {frag.otherSharePct > 0 && (
            <div
              style={{ width: `${frag.otherSharePct}%` }}
              className="bg-emerald-500/80 h-full transition-all"
              title={`All Other Multi-Pack Incumbents (${frag.otherCount.toLocaleString()} brands): ${frag.otherSharePct.toFixed(1)}%`}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 text-[11px] text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" />
              Top-3 Multi-Pack ({frag.top3SharePct.toFixed(1)}%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              Single-Pack Incumbents ({frag.singlePackSharePct.toFixed(1)}%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
              2026 Launches ({frag.launchSharePct.toFixed(1)}%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              Broad Multi-Pack Base ({frag.otherSharePct.toFixed(1)}%)
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            Precedence: Launch → Single-Pack → Top-3 Multi-Pack → Broad Base (Σ = 100.0%)
          </span>
        </div>
      </div>

      {/* Row 1: Market Structure Bar Chart + Growth Overlay & Hierarchical Treemap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card B1: Size Bar Chart with Value & Units Growth Overlay */}
        <AnalyticsChartCard
          title={`B1. Market Structure — Size & Dual Growth Overlay (${period.toUpperCase()} Aug 2026)`}
          subtitle="Compares 2026 scale against both LC Value Growth % and Units Growth % • Click bar to cross-filter"
          icon={<BarChart2 className="w-4 h-4 text-indigo-500" />}
          exportFilename={`market-structure-bars-${barScope}`}
          controls={
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
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    barScope === key
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
          csvRows={barChartItems.map((n) => ({
            Name: n.name,
            Sales2026: n.v2026,
            Share2026Pct: Number(((n.share26 || 0) * 100).toFixed(2)),
            ValueGrowth26Pct:
              n.valueGrowth26.raw !== null ? Number((n.valueGrowth26.raw * 100).toFixed(2)) : 'New',
            UnitsGrowth26Pct:
              n.unitsGrowth26.raw !== null ? Number((n.unitsGrowth26.raw * 100).toFixed(2)) : 'New',
          }))}
          footnote={
            <div className="flex items-center justify-between">
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
          }
        >
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
        </AnalyticsChartCard>

        {/* Card B2: Hierarchical Treemap (Product > Pack or ATC1 > ATC4) */}
        <AnalyticsChartCard
          title="B2. Hierarchical Market Treemap (Colored by Winsorised Growth)"
          subtitle={`Area = 2026 ${measure === 'value' ? 'LC Value' : 'Units'} • Colour = YoY Growth (Red <0%, Amber 0–10%, Green >10%)`}
          icon={<Grid className="w-4 h-4 text-emerald-500" />}
          exportFilename={`market-treemap-${treemapMode}`}
          controls={
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setTreemapMode('product_pack')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
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
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  treemapMode === 'atc1_atc4'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                ATC1 &gt; ATC4
              </button>
            </div>
          }
          csvRows={(treemapMode === 'product_pack' ? bundle.productNodes.slice(0, 45) : bundle.atc4Nodes).map(
            (n) => ({
              Name: n.name,
              Level: n.level,
              Sales2026: n.v2026,
              Share2026Pct: Number(((n.share26 || 0) * 100).toFixed(2)),
              Growth2026Pct: n.growth26.raw !== null ? Number((n.growth26.raw * 100).toFixed(2)) : 'New',
            })
          )}
          footnote="Click any tile to filter globally • Winsorised colour scale [-30%, +60%]."
        >
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
        </AnalyticsChartCard>
      </div>

      {/* Row 2: NC-1 (Section K) Class Attractiveness Matrix & NC-12 (Section P) Seasonality / Front-Load Index */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card K (NC-1): Class Attractiveness Matrix ("Where to Play" Grid) */}
        <AnalyticsChartCard
          title='K. Therapeutic Class Attractiveness Matrix ("Where to Play" Grid)'
          subtitle="X = Class Growth / CAGR • Y = 2026 Class Scale (Log) • Colour = HHI Concentration (Green <1,500 Contestable, Rose ≥2,500 Defended)"
          icon={<Compass className="w-4 h-4 text-emerald-500" />}
          exportFilename={`class-attractiveness-matrix-${attractivenessAxis}`}
          controls={
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setAttractivenessAxis('growth26')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  attractivenessAxis === 'growth26'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                2026 YoY Growth
              </button>
              <button
                type="button"
                onClick={() => setAttractivenessAxis('cagr')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  attractivenessAxis === 'cagr'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                2-yr CAGR (24→26)
              </button>
            </div>
          }
          csvRows={attractivenessRows.map((r) => ({
            ATC4_Class: r.atc4Name,
            ATC1_Parent: r.atc1Name,
            Sales2026: r.v2026,
            Growth26Pct: r.growth26.raw !== null ? Number((r.growth26.raw * 100).toFixed(2)) : '—',
            CAGR_24_26_Pct: r.cagr24_26.raw !== null ? Number((r.cagr24_26.raw * 100).toFixed(2)) : '—',
            HHI_Index: r.hhi ? Math.round(r.hhi) : 0,
            Top5SharePct: Number(r.top5SharePct.toFixed(1)),
            LeadBrand: r.topProductName,
          }))}
          footnote="Green bubbles (HHI < 1,500) indicate fragmented, contestable classes; Rose bubbles (HHI ≥ 2,500) indicate entrenched monopolies/oligopolies."
        >
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/25">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                ★ Scale Winners
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {classQuadCounts.scaleWinners}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/25">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">
                ● Cash Cores
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {classQuadCounts.cashCores}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-500/25">
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase">
                ▲ Selective Bets
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {classQuadCounts.selectiveBets}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-500/25">
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase">
                ▼ Structural Drag
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {classQuadCounts.structuralDrag}
              </div>
            </div>
          </div>

          <div className="h-[340px] w-full">
            <ReactECharts
              option={classAttractivenessOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const r = p.data?.row;
                  if (r && r.atc4Idx >= 0) {
                    toggleFilterValue('atc4', r.atc4Idx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>

        {/* Card P (NC-12): Seasonality / Front-Load Index by Class */}
        <AnalyticsChartCard
          title="P. Seasonality & Jan–Aug Front-Load Pacing Index"
          subtitle="Index = (YTD Aug / MAT Aug) ÷ (8/12) • >1.08x = H1/Summer Front-Loaded • <0.92x = Sep–Dec Q4 Back-Loaded"
          icon={<Calendar className="w-4 h-4 text-cyan-500" />}
          exportFilename={`seasonality-pacing-index-${seasonalityDim}`}
          periodBadge="YTD ÷ MAT Pacing"
          controls={
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setSeasonalityDim('atc4')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  seasonalityDim === 'atc4'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Top ATC4 Subclasses
              </button>
              <button
                type="button"
                onClick={() => setSeasonalityDim('nfc1')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  seasonalityDim === 'nfc1'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                NFC1 Dosage Forms
              </button>
            </div>
          }
          csvRows={seasonalityRows.map((r) => ({
            Name: r.name,
            Dimension: r.dimKey.toUpperCase(),
            SeasonalityIndex2026: r.index26 !== null ? Number(r.index26.toFixed(3)) : '—',
            SeasonalityIndex2025: r.index25 !== null ? Number(r.index25.toFixed(3)) : '—',
            SepDecTailShare26Pct:
              r.sepDecShare26 !== null ? Number((r.sepDecShare26 * 100).toFixed(1)) : '—',
            IsUnstableSwing: r.isUnstable,
            YTD_2026: r.ytd26,
            MAT_2026: r.mat26,
          }))}
          footnote="◆ Diamond markers show 2025 pacing benchmark; ⚠ flags classes with >0.15x YoY pacing swing (e.g., tender timing, repricing, or stock-outs)."
        >
          <div className="h-[395px] w-full">
            <ReactECharts
              option={seasonalityOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const r = p.data?.row || seasonalityRows[p.dataIndex];
                  if (r && r.dictIdx >= 0) {
                    toggleFilterValue(r.dimKey, r.dictIdx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>
      </div>

      {/* Row 3: NC-3 (Section M) — Market Health Heatmap (ATC1 × 6 Metrics) */}
      <AnalyticsChartCard
        title="M. Therapeutic Class Health Scorecard Heatmap (ATC1 × 6 Core Metrics)"
        subtitle="Column-normalized thermal matrix across all active ATC1 anatomical classes • Click any row/cell to filter"
        icon={<Thermometer className="w-4 h-4 text-rose-500" />}
        exportFilename="atc1-market-health-heatmap"
        csvRows={heatmapCsvRows}
        footnote="Each metric column is independently normalized so class leaders (emerald) and laggards (rose) stand out clearly despite different units (% vs pp)."
      >
        <div className="h-[430px] w-full">
          <ReactECharts
            option={heatmapOption}
            style={{ height: '100%', width: '100%' }}
            onEvents={{
              click: (p: any) => {
                const n = p.data?.node;
                if (n && n.atc1Idx >= 0) {
                  toggleFilterValue('atc1', n.atc1Idx);
                }
              },
            }}
          />
        </div>
      </AnalyticsChartCard>

      {/* Row 4: Section H — Product Pareto 80/20 Curve + ATC4 Concentration & HHI Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Card H1: Product Pareto (80/20) Curve */}
        <div className="xl:col-span-5 flex flex-col">
          <AnalyticsChartCard
            title="H1. Product Pareto (80/20) Concentration Curve"
            subtitle={`Top ${bundle.pareto.countFor50Pct.toLocaleString()} products generate 50% of sales; Top ${bundle.pareto.countFor80Pct.toLocaleString()} generate 80%`}
            icon={<PieChart className="w-4 h-4 text-amber-500" />}
            exportFilename="product-pareto-curve"
            csvRows={bundle.pareto.points.map((pt) => ({
              Rank: pt.rank,
              Product: pt.name,
              Sales2026: pt.value26,
              SharePct: Number(pt.sharePct.toFixed(3)),
              CumulativeSharePct: Number(pt.cumSharePct.toFixed(2)),
            }))}
          >
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
          </AnalyticsChartCard>
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

          <div className="h-[390px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
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
                      ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30'
                      : hhiVal >= 1500
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

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
