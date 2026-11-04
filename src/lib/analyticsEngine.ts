import type { MeasureType, PeriodType } from '../types/market';
import { buildTableViewData, type TableNode } from './aggregationEngine';
import type { FacetedFilterStateResult, IndexedMarketData } from './filterEngine';
import {
  calcAveragePrice,
  calcCagr24To26,
  calcGrowth,
  calcHHI,
  calcMarketShare,
  calcPriceMixGrowth,
  type GrowthMetric,
  winsoriseForColorScale,
} from './metrics';

export interface PeriodKpiSummary {
  value24: number;
  value25: number;
  value26: number;
  units24: number;
  units25: number;
  units26: number;
  valueGrowth25: GrowthMetric;
  valueGrowth26: GrowthMetric;
  unitsGrowth25: GrowthMetric;
  unitsGrowth26: GrowthMetric;
  valueCagr24_26: GrowthMetric;
  unitsCagr24_26: GrowthMetric;
  priceMixGrowth26: number | null;
  avgPrice24: number | null;
  avgPrice25: number | null;
  avgPrice26: number | null;
  activeProductsCount: number;
  activePacksCount: number;
  top5ProductSharePct: number;
  top10ProductSharePct: number;
  productHHI: number | null;
  shareOfGrandTotalValue: number | null;
  shareOfGrandTotalUnits: number | null;
}

export interface ExecutiveSummaryData {
  mat: PeriodKpiSummary;
  ytd: PeriodKpiSummary;
  insights: string[];
}

export interface ParetoPoint {
  rank: number;
  name: string;
  prodIdx: number;
  value26: number;
  sharePct: number;
  cumSharePct: number;
}

export interface Atc4ConcentrationRow {
  atc4Idx: number;
  atc4Name: string;
  atc1Name: string;
  v2026: number;
  growth26: GrowthMetric;
  productCount: number;
  packCount: number;
  top5SharePct: number;
  top10SharePct: number;
  hhi: number | null;
  topProductName: string;
  topProductSharePct: number;
}

export interface PriceTierBucket {
  tier: string;
  rangeLabel: string;
  packCount: number;
  value25: number;
  value26: number;
  units25: number;
  units26: number;
  valueShare26: number;
  unitsShare26: number;
  valueGrowth26: GrowthMetric;
  unitsGrowth26: GrowthMetric;
}

export interface PackSizeBucket {
  bucket: string;
  packCount: number;
  value25: number;
  value26: number;
  units25: number;
  units26: number;
  valueShare26: number;
  valueGrowth26: GrowthMetric;
  avgPrice26: number | null;
}

export interface PackExtensionSummary {
  prodIdx: number;
  productName: string;
  atc4Name: string;
  nfc1Name: string;
  totalValue25: number;
  totalValue26: number;
  productGrowth26: GrowthMetric;
  packCount: number;
  newExtensionPackCount: number;
  extensionValue26: number;
  extensionShareOfProductPct: number;
  leadPackName: string;
  leadPackSharePct: number;
  packs: TableNode[];
}

export interface ScopedAnalyticsBundle {
  executive: ExecutiveSummaryData;
  productNodes: TableNode[];
  packNodes: TableNode[];
  nfc1Nodes: TableNode[];
  atc4Nodes: TableNode[];
  atc1Nodes: TableNode[];
  scopeTotalNode: TableNode;
  pareto: {
    points: ParetoPoint[];
    countFor50Pct: number;
    countFor80Pct: number;
    totalActiveProducts: number;
    top5SharePct: number;
    top10SharePct: number;
    hhi: number | null;
  };
  atc4Concentration: Atc4ConcentrationRow[];
  priceTierMix: PriceTierBucket[];
  packSizeMix: PackSizeBucket[];
  packExtensions: PackExtensionSummary[];
  newProducts: TableNode[];
  discontinuedProducts: TableNode[];
  newPacks: TableNode[];
  discontinuedPacks: TableNode[];
}

function formatCompactEgp(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1e9) return `EGP ${(val / 1e9).toFixed(1)}bn`;
  if (abs >= 1e6) return `EGP ${(val / 1e6).toFixed(1)}mn`;
  if (abs >= 1e3) return `EGP ${(val / 1e3).toFixed(1)}k`;
  return `EGP ${val.toFixed(0)}`;
}

function formatPct1(decimalVal: number | null | undefined): string {
  if (decimalVal === null || decimalVal === undefined || Number.isNaN(decimalVal)) return '—';
  const pct = decimalVal * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/**
 * Extracts pack unit count from IQVIA pack description (trailing integer like "GASTROR.TABS 40MG 14" -> 14)
 */
export function classifyPackSizeBucket(packDesc: string, nfc1Desc: string): string {
  const upperNfc = nfc1Desc.toUpperCase();
  if (
    upperNfc.includes('LIQUID') ||
    upperNfc.includes('SYRUP') ||
    upperNfc.includes('TOPICAL') ||
    upperNfc.includes('DROP') ||
    upperNfc.includes('INHAL') ||
    /\b\d+\s*(ML|GM|G|L|MCG\/DOSE|DOSE)\b/i.test(packDesc)
  ) {
    // Check if trailing number is just 1 bottle/tube/inhaler
    const matchTrailing = packDesc.trim().match(/\s+(\d+)$/);
    if (!matchTrailing || Number(matchTrailing[1]) <= 1) {
      return 'Single Bottle / Tube / Device';
    }
  }

  const trailingMatch = packDesc.trim().match(/\s+(\d+)$/);
  if (!trailingMatch) {
    return 'Single Bottle / Tube / Device';
  }
  const count = Number(trailingMatch[1]);
  if (count <= 10) return 'Small Pack (1–10 units)';
  if (count <= 20) return 'Medium Pack (11–20 units)';
  if (count <= 30) return 'Standard Monthly (21–30 units)';
  return 'Large / Chronic (31+ units)';
}

/**
 * Computes the complete analytics bundle for Sections A–J given the current filter state.
 */
export function computeScopedAnalyticsBundle(
  indexed: IndexedMarketData,
  filterState: FacetedFilterStateResult,
  period: PeriodType,
  measure: MeasureType
): ScopedAnalyticsBundle {
  // Build tree_product_pack (gives us both Product nodes and their child Pack nodes!)
  const prodPackTree = buildTableViewData(
    indexed,
    filterState,
    period,
    measure,
    'tree_product_pack'
  );
  const productNodes = prodPackTree.nodes;
  const scopeTotalNode = prodPackTree.totalNode;

  // Extract flat Pack nodes from product children
  const packNodes: TableNode[] = [];
  for (const p of productNodes) {
    if (p.children) {
      for (const c of p.children) {
        packNodes.push({
          ...c,
          name: `${p.name} — ${c.name}`,
          packName: c.name,
          productName: p.name,
        });
      }
    }
  }
  packNodes.sort((a, b) => b.v2026 - a.v2026);

  const nfc1View = buildTableViewData(indexed, filterState, period, measure, 'NFC1');
  const atc4View = buildTableViewData(indexed, filterState, period, measure, 'ATC4');
  const atc1View = buildTableViewData(indexed, filterState, period, measure, 'ATC1');

  // Compute MAT and YTD KPI summaries
  const gt = indexed.dataset.meta.grandTotals;
  let matV24 = 0,
    matV25 = 0,
    matV26 = 0,
    matU24 = 0,
    matU25 = 0,
    matU26 = 0;
  let ytdV24 = 0,
    ytdV25 = 0,
    ytdV26 = 0,
    ytdU24 = 0,
    ytdU25 = 0,
    ytdU26 = 0;

  for (const r of filterState.scopeRows) {
    ytdU24 += r[7];
    ytdU25 += r[8];
    ytdU26 += r[9];
    ytdV24 += r[10];
    ytdV25 += r[11];
    ytdV26 += r[12];
    matU24 += r[13];
    matU25 += r[14];
    matU26 += r[15];
    matV24 += r[16];
    matV25 += r[17];
    matV26 += r[18];
  }

  // Product-level MAT & YTD values for concentration & active counts
  const rows = indexed.dataset.rows;
  const prodMatValMap = new Map<number, number>();
  const prodYtdValMap = new Map<number, number>();
  let activePacksMat = 0;
  let activePacksYtd = 0;

  for (const rowIdx of filterState.matchingPackRowIndices) {
    const r = rows[rowIdx];
    const pIdx = r[5];
    if (r[18] > 0) {
      activePacksMat++;
      prodMatValMap.set(pIdx, (prodMatValMap.get(pIdx) || 0) + r[18]);
    }
    if (r[12] > 0) {
      activePacksYtd++;
      prodYtdValMap.set(pIdx, (prodYtdValMap.get(pIdx) || 0) + r[12]);
    }
  }

  const matProdVals = Array.from(prodMatValMap.values()).sort((a, b) => b - a);
  const ytdProdVals = Array.from(prodYtdValMap.values()).sort((a, b) => b - a);

  const topNSharePct = (sortedVals: number[], n: number, total: number): number => {
    if (total <= 0) return 0;
    const sum = sortedVals.slice(0, n).reduce((a, b) => a + b, 0);
    return (sum / total) * 100;
  };

  const matValueGrowth26 = calcGrowth(matV26, matV25);
  const matUnitsGrowth26 = calcGrowth(matU26, matU25);
  const ytdValueGrowth26 = calcGrowth(ytdV26, ytdV25);
  const ytdUnitsGrowth26 = calcGrowth(ytdU26, ytdU25);

  const matSummary: PeriodKpiSummary = {
    value24: matV24,
    value25: matV25,
    value26: matV26,
    units24: matU24,
    units25: matU25,
    units26: matU26,
    valueGrowth25: calcGrowth(matV25, matV24),
    valueGrowth26: matValueGrowth26,
    unitsGrowth25: calcGrowth(matU25, matU24),
    unitsGrowth26: matUnitsGrowth26,
    valueCagr24_26: calcCagr24To26(matV26, matV24),
    unitsCagr24_26: calcCagr24To26(matU26, matU24),
    priceMixGrowth26: calcPriceMixGrowth(matValueGrowth26.raw, matUnitsGrowth26.raw),
    avgPrice24: calcAveragePrice(matV24, matU24),
    avgPrice25: calcAveragePrice(matV25, matU25),
    avgPrice26: calcAveragePrice(matV26, matU26),
    activeProductsCount: matProdVals.length,
    activePacksCount: activePacksMat,
    top5ProductSharePct: topNSharePct(matProdVals, 5, matV26),
    top10ProductSharePct: topNSharePct(matProdVals, 10, matV26),
    productHHI: calcHHI(matProdVals),
    shareOfGrandTotalValue: calcMarketShare(matV26, gt.mat_2026_value),
    shareOfGrandTotalUnits: calcMarketShare(matU26, gt.mat_2026_units),
  };

  const ytdSummary: PeriodKpiSummary = {
    value24: ytdV24,
    value25: ytdV25,
    value26: ytdV26,
    units24: ytdU24,
    units25: ytdU25,
    units26: ytdU26,
    valueGrowth25: calcGrowth(ytdV25, ytdV24),
    valueGrowth26: ytdValueGrowth26,
    unitsGrowth25: calcGrowth(ytdU25, ytdU24),
    unitsGrowth26: ytdUnitsGrowth26,
    valueCagr24_26: calcCagr24To26(ytdV26, ytdV24),
    unitsCagr24_26: calcCagr24To26(ytdU26, ytdU24),
    priceMixGrowth26: calcPriceMixGrowth(ytdValueGrowth26.raw, ytdUnitsGrowth26.raw),
    avgPrice24: calcAveragePrice(ytdV24, ytdU24),
    avgPrice25: calcAveragePrice(ytdV25, ytdU25),
    avgPrice26: calcAveragePrice(ytdV26, ytdU26),
    activeProductsCount: ytdProdVals.length,
    activePacksCount: activePacksYtd,
    top5ProductSharePct: topNSharePct(ytdProdVals, 5, ytdV26),
    top10ProductSharePct: topNSharePct(ytdProdVals, 10, ytdV26),
    productHHI: calcHHI(ytdProdVals),
    shareOfGrandTotalValue: calcMarketShare(ytdV26, gt.ytd_2026_value),
    shareOfGrandTotalUnits: calcMarketShare(ytdU26, gt.ytd_2026_units),
  };

  // Pareto 80/20 on active Products
  const activeProducts = productNodes.filter((p) => p.v2026 > 0);
  const totalScope26 = scopeTotalNode.v2026;
  let cumVal = 0;
  let countFor50Pct = 0;
  let countFor80Pct = 0;
  const paretoPoints: ParetoPoint[] = [];

  for (let i = 0; i < activeProducts.length; i++) {
    const p = activeProducts[i];
    cumVal += p.v2026;
    const sharePct = totalScope26 > 0 ? (p.v2026 / totalScope26) * 100 : 0;
    const cumSharePct = totalScope26 > 0 ? (cumVal / totalScope26) * 100 : 0;
    if (countFor50Pct === 0 && cumSharePct >= 50) countFor50Pct = i + 1;
    if (countFor80Pct === 0 && cumSharePct >= 80) countFor80Pct = i + 1;
    if (i < 250 || i === activeProducts.length - 1 || i % 10 === 0) {
      paretoPoints.push({
        rank: i + 1,
        name: p.name,
        prodIdx: p.prodIdx,
        value26: p.v2026,
        sharePct,
        cumSharePct,
      });
    }
  }

  // Per-ATC4 Concentration
  const prodsByAtc4 = new Map<number, TableNode[]>();
  for (const p of activeProducts) {
    let list = prodsByAtc4.get(p.atc4Idx);
    if (!list) {
      list = [];
      prodsByAtc4.set(p.atc4Idx, list);
    }
    list.push(p);
  }

  const atc4Concentration: Atc4ConcentrationRow[] = atc4View.nodes
    .filter((a) => a.v2026 > 0)
    .map((a) => {
      const pList = (prodsByAtc4.get(a.atc4Idx) || []).sort((x, y) => y.v2026 - x.v2026);
      const vals = pList.map((x) => x.v2026);
      const topProd = pList[0];
      return {
        atc4Idx: a.atc4Idx,
        atc4Name: a.name,
        atc1Name: a.atc1Name,
        v2026: a.v2026,
        growth26: a.growth26,
        productCount: pList.length,
        packCount: a.packCount || 0,
        top5SharePct: topNSharePct(vals, 5, a.v2026),
        top10SharePct: topNSharePct(vals, 10, a.v2026),
        hhi: calcHHI(vals),
        topProductName: topProd ? topProd.name : '—',
        topProductSharePct:
          topProd && a.v2026 > 0 ? (topProd.v2026 / a.v2026) * 100 : 0,
      };
    });

  // Price-Tier Mix & Pack-Size Mix (evaluated on Pack nodes)
  const tierDefs = [
    { tier: 'Economy', rangeLabel: '< EGP 50', min: 0, max: 50 },
    { tier: 'Standard', rangeLabel: 'EGP 50 – 150', min: 50, max: 150 },
    { tier: 'Premium', rangeLabel: 'EGP 150 – 500', min: 150, max: 500 },
    { tier: 'Specialty / High-Cost', rangeLabel: '> EGP 500', min: 500, max: Infinity },
  ];

  const tierAccs = tierDefs.map((d) => ({
    ...d,
    packCount: 0,
    value25: 0,
    value26: 0,
    units25: 0,
    units26: 0,
  }));

  const sizeOrder = [
    'Small Pack (1–10 units)',
    'Medium Pack (11–20 units)',
    'Standard Monthly (21–30 units)',
    'Large / Chronic (31+ units)',
    'Single Bottle / Tube / Device',
  ];
  const sizeAccMap = new Map<
    string,
    { packCount: number; value25: number; value26: number; units25: number; units26: number }
  >();
  for (const s of sizeOrder) {
    sizeAccMap.set(s, { packCount: 0, value25: 0, value26: 0, units25: 0, units26: 0 });
  }

  for (const pk of packNodes) {
    if (pk.value2026 <= 0 && pk.value2025 <= 0) continue;
    const price = pk.avgPrice26 ?? pk.avgPrice25 ?? 0;
    const tAcc =
      tierAccs.find((t) => price >= t.min && price < t.max) || tierAccs[tierAccs.length - 1];
    if (pk.value2026 > 0) tAcc.packCount++;
    tAcc.value25 += pk.value2025;
    tAcc.value26 += pk.value2026;
    tAcc.units25 += pk.units2025;
    tAcc.units26 += pk.units2026;

    const bucketName = classifyPackSizeBucket(pk.packName, pk.nfc1Name);
    const sAcc = sizeAccMap.get(bucketName) || sizeAccMap.get('Single Bottle / Tube / Device')!;
    if (pk.value2026 > 0) sAcc.packCount++;
    sAcc.value25 += pk.value2025;
    sAcc.value26 += pk.value2026;
    sAcc.units25 += pk.units2025;
    sAcc.units26 += pk.units2026;
  }

  const totalVal26 = scopeTotalNode.value2026;
  const totalUnits26 = scopeTotalNode.units2026;

  const priceTierMix: PriceTierBucket[] = tierAccs.map((t) => ({
    tier: t.tier,
    rangeLabel: t.rangeLabel,
    packCount: t.packCount,
    value25: t.value25,
    value26: t.value26,
    units25: t.units25,
    units26: t.units26,
    valueShare26: totalVal26 > 0 ? t.value26 / totalVal26 : 0,
    unitsShare26: totalUnits26 > 0 ? t.units26 / totalUnits26 : 0,
    valueGrowth26: calcGrowth(t.value26, t.value25),
    unitsGrowth26: calcGrowth(t.units26, t.units25),
  }));

  const packSizeMix: PackSizeBucket[] = sizeOrder.map((bucket) => {
    const s = sizeAccMap.get(bucket)!;
    return {
      bucket,
      packCount: s.packCount,
      value25: s.value25,
      value26: s.value26,
      units25: s.units25,
      units26: s.units26,
      valueShare26: totalVal26 > 0 ? s.value26 / totalVal26 : 0,
      valueGrowth26: calcGrowth(s.value26, s.value25),
      avgPrice26: calcAveragePrice(s.value26, s.units26),
    };
  });

  // Pack Extensions vs Product Total (multi-pack products or products with new pack extensions)
  const packExtensions: PackExtensionSummary[] = [];
  for (const p of productNodes) {
    const children = p.children || [];
    if (children.length < 2 && p.v2026 <= 0) continue;
    // If product existed in 2025 (v2025 > 0), any pack with v2025 === 0 and v2026 > 0 is a pack extension!
    const hadBrandIn25 = p.v2025 > 0;
    const extPacks = hadBrandIn25
      ? children.filter((c) => c.v2025 <= 0 && c.v2026 > 0)
      : [];
    const extVal26 = extPacks.reduce((s, c) => s + c.v2026, 0);
    const leadPack = children[0];

    if (children.length >= 2 || extPacks.length > 0) {
      packExtensions.push({
        prodIdx: p.prodIdx,
        productName: p.name,
        atc4Name: p.atc4Name,
        nfc1Name: p.nfc1Name,
        totalValue25: p.v2025,
        totalValue26: p.v2026,
        productGrowth26: p.growth26,
        packCount: children.length,
        newExtensionPackCount: extPacks.length,
        extensionValue26: extVal26,
        extensionShareOfProductPct: p.v2026 > 0 ? (extVal26 / p.v2026) * 100 : 0,
        leadPackName: leadPack ? leadPack.name : '—',
        leadPackSharePct:
          leadPack && p.v2026 > 0 ? (leadPack.v2026 / p.v2026) * 100 : 0,
        packs: children,
      });
    }
  }

  // New & Discontinued Products and Packs (Section J: 0 in 2025 and >0 in 2026, and reverse)
  const newProducts = productNodes
    .filter((p) => p.v2025 <= 0 && p.v2026 > 0)
    .sort((a, b) => b.v2026 - a.v2026);
  const discontinuedProducts = productNodes
    .filter((p) => p.v2025 > 0 && p.v2026 <= 0)
    .sort((a, b) => b.v2025 - a.v2025);

  const newPacks = packNodes
    .filter((pk) => pk.v2025 <= 0 && pk.v2026 > 0)
    .sort((a, b) => b.v2026 - a.v2026);
  const discontinuedPacks = packNodes
    .filter((pk) => pk.v2025 > 0 && pk.v2026 <= 0)
    .sort((a, b) => b.v2025 - a.v2025);

  // Plain-language Executive Insights (Section 5A)
  const activeKpi = period === 'mat' ? matSummary : ytdSummary;
  const periodLabel = period === 'mat' ? 'MAT Aug 2026' : 'YTD Aug 2026';
  const insights: string[] = [];

  if (activeKpi.value26 > 0) {
    const valG = formatPct1(activeKpi.valueGrowth26.raw);
    const unitG = formatPct1(activeKpi.unitsGrowth26.raw);
    const pmG = formatPct1(activeKpi.priceMixGrowth26);
    insights.push(
      `${periodLabel} reached ${formatCompactEgp(activeKpi.value26)} (${valG} YoY in value vs ${unitG} in units) — a ${pmG} price/mix effect remains the primary revenue driver across ${activeKpi.activeProductsCount.toLocaleString()} products and ${activeKpi.activePacksCount.toLocaleString()} packs.`
    );
  }

  // Top Product & Lead Pack insight
  const topProd = activeProducts[0];
  if (topProd) {
    const leadPk = topProd.children?.[0];
    const pkText = leadPk
      ? `, anchored by pack "${leadPk.name}" (${((leadPk.v2026 / topProd.v2026) * 100).toFixed(0)}% of brand)`
      : '';
    insights.push(
      `Leading product ${topProd.name}${pkText} generated ${formatCompactEgp(topProd.value2026)} (${((topProd.share26 || 0) * 100).toFixed(2)}% scope share, ${formatPct1(topProd.valueGrowth26.raw)} value / ${formatPct1(topProd.unitsGrowth26.raw)} units).`
    );
  }

  // Top absolute growth driver Product
  const topGrowerProd = [...productNodes].sort((a, b) => b.absGrowth26 - a.absGrowth26)[0];
  if (topGrowerProd && topGrowerProd.absGrowth26 > 0) {
    const contrib =
      topGrowerProd.contribGrowthPp !== null
        ? `+${topGrowerProd.contribGrowthPp.toFixed(2)} pp`
        : '—';
    insights.push(
      `${topGrowerProd.name} was the #1 growth contributor, adding ${
        measure === 'value'
          ? formatCompactEgp(topGrowerProd.absGrowth26)
          : `${(topGrowerProd.absGrowth26 / 1e6).toFixed(1)}mn units`
      } (${contrib} contribution to total scope growth, EI = ${topGrowerProd.evolutionIndex26?.toFixed(0) ?? 'New'}).`
    );
  }

  // Top share gainer Product + Therapeutic price/mix highlight
  const topShareGainer = [...productNodes]
    .filter((p) => p.deltaShare26_25Pp !== null)
    .sort((a, b) => (b.deltaShare26_25Pp || 0) - (a.deltaShare26_25Pp || 0))[0];
  if (topShareGainer && (topShareGainer.deltaShare26_25Pp || 0) > 0) {
    insights.push(
      `${topShareGainer.name} captured the largest share gain (+${topShareGainer.deltaShare26_25Pp!.toFixed(2)} pp YoY to ${((topShareGainer.share26 || 0) * 100).toFixed(2)}%). Meanwhile, ${countFor80Pct.toLocaleString()} products (${activeProducts.length > 0 ? ((countFor80Pct / activeProducts.length) * 100).toFixed(1) : 0}% of active brands) account for 80% of market sales.`
    );
  }

  const topAtc1 = atc1View.nodes[0];
  if (topAtc1 && atc1View.nodes.length > 1) {
    insights.push(
      `Class highlight: ${topAtc1.name} grew ${formatPct1(topAtc1.valueGrowth26.raw)} in value vs ${formatPct1(topAtc1.unitsGrowth26.raw)} in units (price/mix ${formatPct1(topAtc1.priceMixGrowth26)}). New 2026 launches added ${newProducts.length.toLocaleString()} products and ${newPacks.length.toLocaleString()} packs.`
    );
  }

  return {
    executive: {
      mat: matSummary,
      ytd: ytdSummary,
      insights,
    },
    productNodes,
    packNodes,
    nfc1Nodes: nfc1View.nodes,
    atc4Nodes: atc4View.nodes,
    atc1Nodes: atc1View.nodes,
    scopeTotalNode,
    pareto: {
      points: paretoPoints,
      countFor50Pct,
      countFor80Pct,
      totalActiveProducts: activeProducts.length,
      top5SharePct: activeKpi.top5ProductSharePct,
      top10SharePct: activeKpi.top10ProductSharePct,
      hhi: activeKpi.productHHI,
    },
    atc4Concentration,
    priceTierMix,
    packSizeMix,
    packExtensions,
    newProducts,
    discontinuedProducts,
    newPacks,
    discontinuedPacks,
  };
}

export { winsoriseForColorScale };
