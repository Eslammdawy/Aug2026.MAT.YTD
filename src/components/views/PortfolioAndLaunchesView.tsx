import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ArchiveRestore,
  ArrowRightLeft,
  Boxes,
  Compass,
  Crosshair,
  DollarSign,
  Filter,
  Layers,
  PackagePlus,
  Rocket,
  Sparkles,
  Table2,
} from 'lucide-react';
import type { ScopedAnalyticsBundle } from '../../lib/analyticsEngine';
import {
  formatCompactValue,
  formatExactValue,
  formatGrowthMetric,
  formatPp,
  formatPriceEgp,
  formatSharePct,
} from '../../lib/formatters';
import { calcPriceIndex, winsoriseForColorScale } from '../../lib/metrics';
import { useMarketStore } from '../../store/useMarketStore';
import { AnalyticsChartCard } from '../charts/AnalyticsChartCard';

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
  const [positioningScope, setPositioningScope] = useState<'product' | 'pack'>('product');
  const [tierMigrationMeasure, setTierMigrationMeasure] = useState<'value' | 'units'>('value');
  const [launchMinValue, setLaunchMinValue] = useState<number>(0);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#1e293b';
  const gridColor = isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0';

  // Map of ATC4 class average price in 2026 for relative price indexing
  const atc4AvgPriceMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of bundle.atc4Concentration) {
      if (c.avgPrice26 && c.avgPrice26 > 0) {
        map.set(c.atc4Idx, c.avgPrice26);
      }
    }
    return map;
  }, [bundle.atc4Concentration]);

  // 1. NFC1 Dosage Form Mix & Average Price Trend (2024 -> 2025 -> 2026)
  const nfc1Items = useMemo(() => bundle.nfc1Nodes.slice(0, 12), [bundle.nfc1Nodes]);

  const nfc1ChartOption = useMemo(() => {
    const items = nfc1Items;
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
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
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
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bar to filter by NFC1 dosage form</div>
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
          cursor: 'pointer',
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
  }, [nfc1Items, measure, isDark, textColor, gridColor]);

  // 2. Price-Tier Mix & Pack-Size Mix Option (Card I2)
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
        extraCssText:
          'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 8px;',
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
  }, [bundle.priceTierMix, isDark, textColor, gridColor]);

  // 3. NC-8 (Section I4): Price-Tier Migration (2025 vs 2026 Share Shift)
  const tierMigrationOption = useMemo(() => {
    const tiers = bundle.priceTierMix;
    const isVal = tierMigrationMeasure === 'value';
    const share25 = tiers.map((t) =>
      Number(((isVal ? t.valueShare25 : t.unitsShare25) * 100).toFixed(2))
    );
    const share26 = tiers.map((t) =>
      Number(((isVal ? t.valueShare26 : t.unitsShare26) * 100).toFixed(2))
    );
    const deltaPp = tiers.map((t) =>
      Number((isVal ? t.deltaValueSharePp : t.deltaUnitsSharePp).toFixed(2))
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
          const t = tiers[idx];
          if (!t) return '';
          const s25 = share25[idx];
          const s26 = share26[idx];
          const dPp = deltaPp[idx];
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${t.tier} (${t.rangeLabel})</div>
              <div>2025 ${isVal ? 'Value' : 'Units'} Share: <b>${s25.toFixed(2)}%</b></div>
              <div>2026 ${isVal ? 'Value' : 'Units'} Share: <b>${s26.toFixed(2)}%</b></div>
              <div>YoY Share Shift: <b style="color:${dPp >= 0 ? '#10b981' : '#f43f5e'}">${formatPp(dPp, 2)}</b></div>
              <div>Active 2026 Packs: <b>${t.packCount.toLocaleString()}</b></div>
            </div>
          `;
        },
      },
      legend: {
        data: ['2025 Share %', '2026 Share %', 'Δ Share Shift (pp)'],
        textStyle: { color: textColor, fontSize: 10 },
        top: 0,
      },
      grid: { left: 50, right: 50, top: 34, bottom: 42 },
      xAxis: {
        type: 'category',
        data: tiers.map((t) => `${t.tier}\n(${t.rangeLabel})`),
        axisLabel: { color: textColor, fontSize: 10 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Share (%)',
          nameTextStyle: { color: textColor, fontSize: 10 },
          axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}%` },
          splitLine: { lineStyle: { color: gridColor } },
        },
        {
          type: 'value',
          name: 'Δ Share (pp)',
          nameTextStyle: { color: textColor, fontSize: 10 },
          axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v} pp` },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '2025 Share %',
          type: 'bar',
          data: share25,
          itemStyle: { color: '#94a3b8', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '2026 Share %',
          type: 'bar',
          data: share26,
          itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Δ Share Shift (pp)',
          type: 'line',
          yAxisIndex: 1,
          symbolSize: 8,
          data: deltaPp,
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 2.5, color: '#10b981' },
        },
      ],
    };
  }, [bundle.priceTierMix, tierMigrationMeasure, isDark, textColor, gridColor]);

  // 4. NC-7 (Section O): Price-Positioning Map (Price Index vs Units Share)
  const { positioningPoints, posQuadCounts, avgUnitsSharePct, scopeAvgPrice26 } = useMemo(() => {
    const benchmarkPrice = bundle.scopeTotalNode.avgPrice26 ?? 100;
    const totalScopeUnits26 = Math.max(1, bundle.scopeTotalNode.units2026);
    const src = positioningScope === 'product' ? bundle.productNodes : bundle.packNodes;

    const candidates = src
      .filter((n) => n.value2026 > 0 && n.units2026 > 0 && n.avgPrice26 !== null)
      .slice(0, 80);

    const avgUShare =
      candidates.length > 0
        ? candidates.reduce(
            (acc, n) => acc + (n.units2026 / totalScopeUnits26) * 100,
            0
          ) / candidates.length
        : 0.5;

    let premiumVol = 0,
      premiumNiche = 0,
      economyVol = 0,
      economyNiche = 0;

    const pts = candidates.map((n) => {
      const pIdx = calcPriceIndex(n.avgPrice26, benchmarkPrice) ?? 1;
      const winPIdx = Number(Math.max(0.15, Math.min(8, pIdx)).toFixed(2));
      const uSharePct = Number(((n.units2026 / totalScopeUnits26) * 100).toFixed(3));

      if (pIdx >= 1.0 && uSharePct >= avgUShare) premiumVol++;
      else if (pIdx >= 1.0 && uSharePct < avgUShare) premiumNiche++;
      else if (pIdx < 1.0 && uSharePct >= avgUShare) economyVol++;
      else economyNiche++;

      return {
        node: n,
        rawPriceIndex: Number(pIdx.toFixed(2)),
        winPriceIndex: winPIdx,
        unitsSharePct: uSharePct,
      };
    });

    return {
      positioningPoints: pts,
      posQuadCounts: { premiumVol, premiumNiche, economyVol, economyNiche },
      avgUnitsSharePct: Number(avgUShare.toFixed(2)),
      scopeAvgPrice26: benchmarkPrice,
    };
  }, [
    bundle.productNodes,
    bundle.packNodes,
    bundle.scopeTotalNode.avgPrice26,
    bundle.scopeTotalNode.units2026,
    positioningScope,
  ]);

  const pricePositioningOption = useMemo(() => {
    const maxVal = Math.max(...positioningPoints.map((p) => p.node.value2026), 1);

    const data = positioningPoints.map((p) => {
      const n = p.node;
      const isLaunch = n.v2025 <= 0 && n.v2026 > 0;
      const g = n.valueGrowth26.raw ?? 0;
      let color = '#10b981';
      if (isLaunch) color = '#8b5cf6';
      else if (g < 0) color = '#f43f5e';
      else if (g < 0.15) color = '#f59e0b';

      return {
        value: [p.winPriceIndex, p.unitsSharePct, n.value2026, p.rawPriceIndex],
        name: n.name,
        node: n,
        rawPriceIndex: p.rawPriceIndex,
        symbolSize: Math.max(9, Math.min(44, Math.sqrt(n.value2026 / maxVal) * 42)),
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
        formatter: (param: any) => {
          const d = param.data;
          const n = d?.node;
          if (!n) return '';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${n.name}</div>
              <div>Price Index vs Scope Avg: <b>${d.rawPriceIndex}x</b> (${formatPriceEgp(n.avgPrice26)} vs ${formatPriceEgp(scopeAvgPrice26)})</div>
              <div>Scope Units Share: <b>${d.value[1].toFixed(2)}%</b></div>
              <div>2026 Value: <b>${formatExactValue(n.value2026, 'value')}</b> (${formatGrowthMetric(n.valueGrowth26)})</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bubble to filter scope</div>
            </div>
          `;
        },
      },
      grid: { left: 55, right: 35, top: 28, bottom: 45 },
      xAxis: {
        type: 'log',
        name: 'Price Index vs Scope Average (Log Scale, 1.0x = Parity)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}x` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        name: '2026 Units Volume Share (%)',
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}%` },
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
              { xAxis: 1.0, name: 'Scope Price Parity (1.0x)' },
              { yAxis: avgUnitsSharePct, name: `Avg Units Share (${avgUnitsSharePct}%)` },
            ],
          },
        },
      ],
    };
  }, [positioningPoints, avgUnitsSharePct, scopeAvgPrice26, isDark, textColor, gridColor]);

  // 5. NC-9 (Section I5): Portfolio Architecture Map (Breadth vs Depth)
  const architecturePoints = useMemo(() => {
    return bundle.productNodes
      .filter((p) => p.v2026 > 0)
      .slice(0, 80)
      .map((p) => {
        const children = p.children || [];
        const packCount = Math.max(1, children.length || p.packCount || 1);
        const leadPack = children[0];
        const leadSharePct =
          packCount === 1
            ? 100
            : leadPack && p.v2026 > 0
            ? Number(((leadPack.v2026 / p.v2026) * 100).toFixed(1))
            : 100;
        return {
          node: p,
          packCount,
          leadSharePct,
          leadPackName: leadPack ? leadPack.name : p.name,
        };
      });
  }, [bundle.productNodes]);

  const architectureOption = useMemo(() => {
    const maxVal = Math.max(...architecturePoints.map((p) => p.node.v2026), 1);

    const data = architecturePoints.map((p) => {
      const g = p.node.growth26.raw ?? 0;
      const color =
        p.packCount === 1
          ? '#f59e0b'
          : g >= 0.15
          ? '#10b981'
          : g >= 0
          ? '#3b82f6'
          : '#f43f5e';

      return {
        value: [p.packCount, p.leadSharePct, p.node.v2026],
        name: p.node.name,
        item: p,
        symbolSize: Math.max(9, Math.min(44, Math.sqrt(p.node.v2026 / maxVal) * 42)),
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
        formatter: (param: any) => {
          const item = param.data?.item;
          if (!item) return '';
          const archType =
            item.packCount === 1
              ? 'Single-Pack Mono-Brand (100% Hero SKU Dependency)'
              : item.leadSharePct >= 75
              ? 'Hero-Pack Anchored Multi-SKU Brand'
              : 'Balanced Multi-Pack Franchise';
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${item.node.name}</div>
              <div style="color:#818cf8;font-size:11px;margin-bottom:4px">${archType}</div>
              <div>Active Pack Count: <b>${item.packCount} packs</b></div>
              <div>Lead Pack Share of Brand: <b>${item.leadSharePct}%</b> (${item.leadPackName})</div>
              <div>2026 Brand Sales: <b>${formatExactValue(item.node.v2026, measure)}</b> (${formatGrowthMetric(item.node.growth26)})</div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click bubble to inspect packs in Main Table</div>
            </div>
          `;
        },
      },
      grid: { left: 55, right: 35, top: 28, bottom: 45 },
      xAxis: {
        type: 'value',
        name: 'Portfolio Breadth — Active Pack Count (# SKUs)',
        nameLocation: 'middle',
        nameGap: 28,
        min: 1,
        minInterval: 1,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'value',
        name: 'Lead Pack Share of Brand (%)',
        min: 0,
        max: 105,
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}%` },
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
              { xAxis: 2.5, name: 'Multi-Pack Threshold' },
              { yAxis: 70, name: '70% Hero-SKU Concentration' },
            ],
          },
        },
      ],
    };
  }, [architecturePoints, measure, isDark, textColor, gridColor]);

  // 6. NC-10 (Section J2): Launch Entry Positioning (Entry Price Index vs First-Year Value)
  const activeNewList =
    launchLevel === 'product' ? bundle.newProducts : bundle.newPacks;
  const activeDiscList =
    launchLevel === 'product'
      ? bundle.discontinuedProducts
      : bundle.discontinuedPacks;

  const launchPositioningPoints = useMemo(() => {
    const fallbackBench = bundle.scopeTotalNode.avgPrice26 ?? 100;
    return activeNewList
      .filter((n) => n.value2026 >= launchMinValue && n.avgPrice26 !== null && n.avgPrice26 > 0)
      .slice(0, 80)
      .map((n) => {
        const classBench = atc4AvgPriceMap.get(n.atc4Idx) ?? fallbackBench;
        const pIdx = calcPriceIndex(n.avgPrice26, classBench) ?? 1;
        return {
          node: n,
          rawPriceIndex: Number(pIdx.toFixed(2)),
          winPriceIndex: Number(Math.max(0.15, Math.min(8, pIdx)).toFixed(2)),
          classBenchPrice: classBench,
        };
      });
  }, [activeNewList, launchMinValue, atc4AvgPriceMap, bundle.scopeTotalNode.avgPrice26]);

  const launchPositioningOption = useMemo(() => {
    const data = launchPositioningPoints.map((p) => {
      const n = p.node;
      const isPremiumEntry = p.rawPriceIndex >= 1.1;
      const isDiscountEntry = p.rawPriceIndex <= 0.9;
      const color = isPremiumEntry
        ? '#8b5cf6'
        : isDiscountEntry
        ? '#10b981'
        : '#0ea5e9';

      return {
        value: [p.winPriceIndex, Math.max(1, n.value2026), p.rawPriceIndex],
        name: n.name,
        item: p,
        symbolSize: 12,
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
        formatter: (param: any) => {
          const item = param.data?.item;
          if (!item) return '';
          const n = item.node;
          return `
            <div style="font-size:12px;line-height:1.5">
              <div style="font-weight:700">${n.name}</div>
              <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">${n.atc4Name} • ${n.nfc1Name}</div>
              <div>Entry Price Index vs ATC4 Class: <b>${item.rawPriceIndex}x</b> (${formatPriceEgp(n.avgPrice26)} vs ${formatPriceEgp(item.classBenchPrice)})</div>
              <div>2026 First-Year Revenue: <b>${formatExactValue(n.value2026, 'value')}</b></div>
              <div>2026 Units Sold: <b>${formatExactValue(n.units2026, 'units')}</b></div>
              <div style="font-size:10px;color:#94a3b8;margin-top:3px">Click point to filter scope</div>
            </div>
          `;
        },
      },
      grid: { left: 62, right: 30, top: 25, bottom: 45 },
      xAxis: {
        type: 'log',
        name: 'Entry Price Index vs ATC4 Class Average (1.0x = Class Parity)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: { color: textColor, fontSize: 10, formatter: (v: number) => `${v}x` },
        splitLine: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: 'log',
        name: '2026 First-Year Value (EGP, Log)',
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          formatter: (v: number) => formatCompactValue(v, 'value'),
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
            formatter: (p: any) => p.data.name.slice(0, 12),
            fontSize: 9,
            color: textColor,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#6366f1', type: 'dashed', width: 1.5 },
            data: [{ xAxis: 1.0, name: 'Class Price Parity (1.0x)' }],
          },
        },
      ],
    };
  }, [launchPositioningPoints, isDark, textColor, gridColor]);

  const displayedExtensions = useMemo(() => {
    const list = onlyShowExtensions
      ? bundle.packExtensions.filter((e) => e.newExtensionPackCount > 0)
      : bundle.packExtensions;
    return list.slice(0, 45);
  }, [bundle.packExtensions, onlyShowExtensions]);

  const totalLaunchValue26 = useMemo(
    () => activeNewList.reduce((s, n) => s + n.v2026, 0),
    [activeNewList]
  );
  const totalDiscValue25 = useMemo(
    () => activeDiscList.reduce((s, n) => s + n.v2025, 0),
    [activeDiscList]
  );

  const topAtc4Class = bundle.atc4Nodes[0];

  return (
    <div className="space-y-6">
      {/* Row 1: Section I1 — NFC1 Dosage Form Mix + Section I4 (NC-8) — Price-Tier Migration */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card I1: NFC1 Mix & Average Price Trajectory */}
        <AnalyticsChartCard
          title="I1. Dosage Form (NFC1) Mix & Average Price Trend (2024 → 2026)"
          subtitle="Click any NFC1 bar to filter Products & Packs by dosage form"
          icon={<Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
          exportFilename="nfc1-dosage-form-mix"
          csvRows={nfc1Items.map((n) => ({
            NFC1_DosageForm: n.name,
            Sales2026: n.v2026,
            Share2026Pct: Number(((n.share26 || 0) * 100).toFixed(2)),
            AvgPrice2024: n.avgPrice24 !== null ? Number(n.avgPrice24.toFixed(2)) : '—',
            AvgPrice2025: n.avgPrice25 !== null ? Number(n.avgPrice25.toFixed(2)) : '—',
            AvgPrice2026: n.avgPrice26 !== null ? Number(n.avgPrice26.toFixed(2)) : '—',
          }))}
        >
          <div className="h-[340px] w-full">
            <ReactECharts
              option={nfc1ChartOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const n = nfc1Items[p.dataIndex];
                  if (n && n.nfc1Idx >= 0) {
                    toggleFilterValue('nfc1', n.nfc1Idx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>

        {/* Card I2: Price-Tier Mix & Pack-Size Architecture */}
        <AnalyticsChartCard
          title="I2. Price-Tier Value vs Volume Share & Pack-Size Mix"
          subtitle="Compares EGP revenue concentration vs unit volume across pack price tiers and pack sizes"
          icon={<DollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
          exportFilename="price-tier-and-pack-size-mix"
          measureBadge="Value & Units Dual"
          csvRows={bundle.priceTierMix.map((t) => ({
            Tier: t.tier,
            Range: t.rangeLabel,
            ActivePacks2026: t.packCount,
            ValueShare25Pct: Number((t.valueShare25 * 100).toFixed(2)),
            ValueShare26Pct: Number((t.valueShare26 * 100).toFixed(2)),
            UnitsShare25Pct: Number((t.unitsShare25 * 100).toFixed(2)),
            UnitsShare26Pct: Number((t.unitsShare26 * 100).toFixed(2)),
          }))}
        >
          <div className="h-[210px] w-full">
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
                  <tr
                    key={b.bucket}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
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
        </AnalyticsChartCard>
      </div>

      {/* Row 2: NC-7 (Section O) Price-Positioning Map & NC-8 (Section I4) Price-Tier Migration */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card O (NC-7): Price-Positioning Map (Price Index vs Units Share) */}
        <AnalyticsChartCard
          title="O. Price-Positioning Map (Price Index vs Units Volume Share)"
          subtitle="X = Price Index vs Scope Avg (1.0x = Parity) • Y = Units Share % • Size = 2026 Value • Colour = Value Growth"
          icon={<Crosshair className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          exportFilename={`price-positioning-map-${positioningScope}`}
          measureBadge="Price × Units × Value"
          controls={
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setPositioningScope('product')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  positioningScope === 'product'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Products
              </button>
              <button
                type="button"
                onClick={() => setPositioningScope('pack')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  positioningScope === 'pack'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Packs
              </button>
            </div>
          }
          alertBanner={
            bundle.atc4Nodes.length > 1 && topAtc4Class ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>Cross-class price dispersion notice:</b> Current scope spans{' '}
                  {bundle.atc4Nodes.length} ATC4 classes (scope avg pack price:{' '}
                  {formatPriceEgp(scopeAvgPrice26)}). Refine to a single therapeutic class for
                  homogeneous price-index benchmarking.
                </span>
                <button
                  type="button"
                  onClick={() => toggleFilterValue('atc4', topAtc4Class.atc4Idx)}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-600 text-white font-semibold text-[10px] hover:bg-amber-500"
                >
                  <Filter className="w-3 h-3" />
                  <span>Filter #1 ATC4 ({topAtc4Class.name.slice(0, 18)}…)</span>
                </button>
              </div>
            ) : undefined
          }
          csvRows={positioningPoints.map((p) => ({
            Name: p.node.name,
            AvgPrice2026: p.node.avgPrice26 !== null ? Number(p.node.avgPrice26.toFixed(2)) : 0,
            PriceIndexVsScope: p.rawPriceIndex,
            UnitsShare26Pct: p.unitsSharePct,
            Value2026: p.node.value2026,
          }))}
        >
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/25">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                ★ Premium Volume
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {posQuadCounts.premiumVol}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-500/25">
              <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">
                ◆ Premium Niche
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {posQuadCounts.premiumNiche}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-500/25">
              <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase">
                ▲ Economy Volume
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {posQuadCounts.economyVol}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                ● Economy Niche
              </div>
              <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                {posQuadCounts.economyNiche}
              </div>
            </div>
          </div>

          <div className="h-[320px] w-full">
            <ReactECharts
              option={pricePositioningOption}
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

        {/* Card I4 (NC-8): Price-Tier Migration (2025 vs 2026 Share Shift) */}
        <AnalyticsChartCard
          title="I4. Price-Tier Migration (2025 vs 2026 Share Shift & Δ pp)"
          subtitle="Tracks structural migration of revenue and unit volume across Economy, Standard, Premium, and Specialty tiers"
          icon={<ArrowRightLeft className="w-4 h-4 text-indigo-500" />}
          exportFilename={`price-tier-migration-${tierMigrationMeasure}`}
          measureBadge={tierMigrationMeasure === 'value' ? 'LC Value Share' : 'Units Share'}
          controls={
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setTierMigrationMeasure('value')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  tierMigrationMeasure === 'value'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Value Share
              </button>
              <button
                type="button"
                onClick={() => setTierMigrationMeasure('units')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                  tierMigrationMeasure === 'units'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Units Share
              </button>
            </div>
          }
          csvRows={bundle.priceTierMix.map((t) => ({
            PriceTier: t.tier,
            Range: t.rangeLabel,
            ValueShare25Pct: Number((t.valueShare25 * 100).toFixed(2)),
            ValueShare26Pct: Number((t.valueShare26 * 100).toFixed(2)),
            DeltaValueSharePp: Number(t.deltaValueSharePp.toFixed(2)),
            UnitsShare25Pct: Number((t.unitsShare25 * 100).toFixed(2)),
            UnitsShare26Pct: Number((t.unitsShare26 * 100).toFixed(2)),
            DeltaUnitsSharePp: Number(t.deltaUnitsSharePp.toFixed(2)),
          }))}
          footnote="Note:Packs are classified by active 2026 pack price (EGP <50, 50–150, 150–500, >500) so YoY share shift reflects demand/growth across price brackets."
        >
          <div className="h-[385px] w-full">
            <ReactECharts option={tierMigrationOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </AnalyticsChartCard>
      </div>

      {/* Row 3: NC-9 (Section I5) Portfolio Architecture Map & NC-10 (Section J2) Launch Entry Positioning */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card I5 (NC-9): Portfolio Architecture Map (Breadth vs Depth) */}
        <AnalyticsChartCard
          title="I5. Brand Portfolio Architecture Map (SKU Breadth vs Hero-Pack Dependency)"
          subtitle="X = Active Pack Count (# SKUs) • Y = Lead Pack % of Brand Sales (100% = Single-SKU Brand) • Click bubble to inspect in table"
          icon={<Compass className="w-4 h-4 text-amber-500" />}
          exportFilename="portfolio-architecture-breadth-depth"
          csvRows={architecturePoints.map((p) => ({
            Brand: p.node.name,
            PackCount: p.packCount,
            LeadPackName: p.leadPackName,
            LeadPackShareOfBrandPct: p.leadSharePct,
            Sales2026: p.node.v2026,
            Growth26Pct:
              p.node.growth26.raw !== null ? Number((p.node.growth26.raw * 100).toFixed(2)) : 'New',
          }))}
          footnote="Amber bubbles at Y = 100% represent single-pack brands; green/blue bubbles with ≥3 packs and <70% lead-pack dependency represent diversified multi-pack franchises."
        >
          <div className="h-[350px] w-full">
            <ReactECharts
              option={architectureOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const prodIdx = p.data?.item?.node?.prodIdx;
                  if (typeof prodIdx === 'number' && prodIdx >= 0) {
                    drillToProductsInTable('product', prodIdx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>

        {/* Card J2 (NC-10): Launch Entry Positioning (Entry Price Index vs First-Year Value) */}
        <AnalyticsChartCard
          title={`J2. 2026 Launch Entry Positioning (${launchLevel === 'product' ? 'New Products' : 'New Packs'})`}
          subtitle="X = Entry Price Index vs ATC4 Class Average (1.0x = Parity) • Y = First-Year 2026 Revenue (Log Scale)"
          icon={<Rocket className="w-4 h-4 text-violet-500" />}
          exportFilename={`launch-entry-positioning-${launchLevel}`}
          measureBadge="Price Index × EGP Value"
          controls={
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px]">
              {(
                [
                  [0, 'All Launches'],
                  [100000, '≥ EGP 100k'],
                  [1000000, '≥ EGP 1mn'],
                ] as const
              ).map(([minVal, label]) => (
                <button
                  key={minVal}
                  type="button"
                  onClick={() => setLaunchMinValue(minVal)}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    launchMinValue === minVal
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
          csvRows={launchPositioningPoints.map((p) => ({
            LaunchName: p.node.name,
            ATC4_Class: p.node.atc4Name,
            NFC1_DosageForm: p.node.nfc1Name,
            EntryAvgPriceEGP: p.node.avgPrice26 !== null ? Number(p.node.avgPrice26.toFixed(2)) : 0,
            ClassAvgPriceEGP: Number(p.classBenchPrice.toFixed(2)),
            EntryPriceIndexVsClass: p.rawPriceIndex,
            FirstYearValue2026: p.node.value2026,
            FirstYearUnits2026: p.node.units2026,
          }))}
          footnote="Violet (>1.1x) = Premium-priced entry vs ATC4 class average; Emerald (<0.9x) = Value/Penetration pricing entry; Sky (0.9–1.1x) = In-line parity entry."
        >
          <div className="h-[350px] w-full">
            <ReactECharts
              option={launchPositioningOption}
              style={{ height: '100%', width: '100%' }}
              onEvents={{
                click: (p: any) => {
                  const n = p.data?.item?.node;
                  if (n?.dimKey && n.dictIdx !== undefined) {
                    toggleFilterValue(n.dimKey, n.dictIdx);
                  }
                },
              }}
            />
          </div>
        </AnalyticsChartCard>
      </div>

      {/* Row 4: Section I3 — Pack Extensions vs Product Total */}
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
                  <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">
                    {ext.packCount} pks
                  </td>
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
                        +{ext.newExtensionPackCount} new (
                        {formatCompactValue(ext.extensionValue26, measure)} •{' '}
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

      {/* Row 5: Section J — New Launches (2025=0, 2026>0) & Discontinued (2025>0, 2026=0) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200/90 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-500" />
              <span>
                J1. New 2026 Launches &amp; Discontinued / Dormant Portfolio Analysis
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
