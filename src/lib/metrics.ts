/**
 * Pure, unit-tested pharmaceutical market calculation utilities for IQVIA Egypt Report.
 *
 * Conventions:
 * - Ratios (growth, CAGR, price/mix, relative share change) are represented in decimal form
 *   (e.g., 0.163 = +16.3%, 9.99 = +999.0%).
 * - Market shares are represented in decimal form (e.g., 0.2154 = 21.54%) and displayed as % with 2 decimals.
 * - Percentage-point (pp) metrics (contribution to growth, delta-share) are in percentage points
 *   (e.g., +1.25 pp means +0.0125 share shift * 100).
 * - Evolution Index (EI) is centered at 100 (e.g., 105.2 means outgrowing the scope market by 5.2%).
 */

export const GROWTH_CAP_DECIMAL = 9.99; // +999.0% display cap
export const EXTREME_SOURCE_GROWTH_DECIMAL = 10.0; // +1000.0% threshold mentioned in data quality spec

export type GrowthStatus = 'ok' | 'new' | 'capped' | 'null';

export interface GrowthMetric {
  status: GrowthStatus;
  /** Uncapped decimal growth (e.g. 0.25 for +25%), or null when status is 'new' or 'null' */
  raw: number | null;
  /** Capped decimal growth (capped at +9.99 = +999%), or null when status is 'new' or 'null' */
  display: number | null;
  /** True when prior period was 0/null and current period > 0 */
  isNew: boolean;
  /** True when raw growth exceeds +999% (9.99) */
  isCapped: boolean;
}

/**
 * Normalizes a raw numeric cell: blank/null/undefined/NaN becomes 0 for sums.
 */
export function toSumValue(val: number | null | undefined): number {
  if (val === null || val === undefined || Number.isNaN(val)) return 0;
  return val;
}

/**
 * Normalizes a source rank cell: Rank -1, 0, null, undefined -> null.
 */
export function normalizeSourceRank(rank: number | null | undefined): number | null {
  if (rank === null || rank === undefined || Number.isNaN(rank) || rank <= 0) {
    return null;
  }
  return Math.round(rank);
}

/**
 * Computes period-over-period growth: X_t / X_{t-1} - 1.
 * - If prior <= 0 (or null) and current > 0 -> status = 'new' ("New", not Infinity)
 * - If both prior <= 0 and current <= 0 -> status = 'null' (null)
 * - If prior > 0 and current <= 0 (or null) -> -1 (-100%, discontinued)
 * - Caps display value at +999% (9.99 decimal) and flags `isCapped = true`.
 */
export function calcGrowth(
  current: number | null | undefined,
  prior: number | null | undefined
): GrowthMetric {
  const c = toSumValue(current);
  const p = toSumValue(prior);

  if (p <= 0) {
    if (c > 0) {
      return {
        status: 'new',
        raw: null,
        display: null,
        isNew: true,
        isCapped: false,
      };
    }
    return {
      status: 'null',
      raw: null,
      display: null,
      isNew: false,
      isCapped: false,
    };
  }

  if (c < 0) {
    return {
      status: 'null',
      raw: null,
      display: null,
      isNew: false,
      isCapped: false,
    };
  }

  const raw = c / p - 1;
  const isCapped = raw > GROWTH_CAP_DECIMAL;
  const display = isCapped ? GROWTH_CAP_DECIMAL : raw;

  return {
    status: isCapped ? 'capped' : 'ok',
    raw,
    display,
    isNew: false,
    isCapped,
  };
}

/**
 * Computes 2-year CAGR from Aug-24 to Aug-26: (v2026 / v2024)^(1/2) - 1.
 * Null if v2024 <= 0 or v2026 < 0 (or if both are 0).
 */
export function calcCagr24To26(
  v2026: number | null | undefined,
  v2024: number | null | undefined
): GrowthMetric {
  if (v2024 === null || v2024 === undefined || v2024 <= 0) {
    return {
      status: 'null',
      raw: null,
      display: null,
      isNew: false,
      isCapped: false,
    };
  }
  const c26 = toSumValue(v2026);
  if (c26 < 0) {
    return {
      status: 'null',
      raw: null,
      display: null,
      isNew: false,
      isCapped: false,
    };
  }

  const raw = Math.pow(c26 / v2024, 0.5) - 1;
  const isCapped = raw > GROWTH_CAP_DECIMAL;
  return {
    status: isCapped ? 'capped' : 'ok',
    raw,
    display: isCapped ? GROWTH_CAP_DECIMAL : raw,
    isNew: false,
    isCapped,
  };
}

/**
 * Absolute growth = v2026 - v2025.
 */
export function calcAbsoluteGrowth(
  v2026: number | null | undefined,
  v2025: number | null | undefined
): number {
  return toSumValue(v2026) - toSumValue(v2025);
}

/**
 * Contribution to growth (pp) = (row absolute growth / scope total of v2025) * 100.
 * Returns null if scopeTotal2025 <= 0.
 */
export function calcContributionToGrowthPp(
  rowV2026: number | null | undefined,
  rowV2025: number | null | undefined,
  scopeTotalV2025: number | null | undefined
): number | null {
  const denom = toSumValue(scopeTotalV2025);
  if (denom <= 0) return null;
  const absGrowth = calcAbsoluteGrowth(rowV2026, rowV2025);
  return (absGrowth / denom) * 100;
}

/**
 * Market share (decimal 0..1) = rowValue / scopeTotal.
 * Returns null if scopeTotal <= 0 or rowValue < 0.
 * If rowValue is 0/null and scopeTotal > 0, returns 0.
 */
export function calcMarketShare(
  rowValue: number | null | undefined,
  scopeTotal: number | null | undefined
): number | null {
  const denom = toSumValue(scopeTotal);
  if (denom <= 0) return null;
  const num = toSumValue(rowValue);
  if (num < 0) return null;
  return num / denom;
}

/**
 * Share change in percentage points (pp) = (shareCurr - sharePrev) * 100.
 * Expects shareCurr and sharePrev in decimal (0..1).
 */
export function calcDeltaSharePp(
  shareCurr: number | null | undefined,
  sharePrev: number | null | undefined
): number | null {
  if (shareCurr === null || shareCurr === undefined || sharePrev === null || sharePrev === undefined) {
    return null;
  }
  return (shareCurr - sharePrev) * 100;
}

/**
 * Relative share change (decimal) = shareCurr / sharePrev - 1.
 * Returns null if sharePrev <= 0 or shareCurr is null.
 */
export function calcRelativeShareChange(
  shareCurr: number | null | undefined,
  sharePrev: number | null | undefined
): number | null {
  if (
    shareCurr === null ||
    shareCurr === undefined ||
    sharePrev === null ||
    sharePrev === undefined ||
    sharePrev <= 0
  ) {
    return null;
  }
  return shareCurr / sharePrev - 1;
}

/**
 * Evolution Index (EI) = ((1 + rowGrowth) / (1 + scopeMarketGrowth)) * 100.
 * > 100 indicates outgrowing the market.
 * Returns null if rowGrowth is null ('New' or no data), or if scopeMarketGrowth <= -1.
 */
export function calcEvolutionIndex(
  rowGrowthDecimal: number | null | undefined,
  scopeMarketGrowthDecimal: number | null | undefined
): number | null {
  if (
    rowGrowthDecimal === null ||
    rowGrowthDecimal === undefined ||
    Number.isNaN(rowGrowthDecimal) ||
    scopeMarketGrowthDecimal === null ||
    scopeMarketGrowthDecimal === undefined ||
    Number.isNaN(scopeMarketGrowthDecimal)
  ) {
    return null;
  }
  const denom = 1 + scopeMarketGrowthDecimal;
  if (denom <= 0) return null;
  return ((1 + rowGrowthDecimal) / denom) * 100;
}

/**
 * Average price = LC Value / Units.
 * Returns null if units <= 0 or value <= 0.
 */
export function calcAveragePrice(
  lcValue: number | null | undefined,
  units: number | null | undefined
): number | null {
  const u = toSumValue(units);
  const v = toSumValue(lcValue);
  if (u <= 0 || v <= 0) return null;
  return v / u;
}

/**
 * Price/Mix growth = (1 + valueGrowth) / (1 + unitsGrowth) - 1.
 * Volume effect = unitsGrowth.
 * Note: (1 + volumeEffect) * (1 + priceMixGrowth) = 1 + valueGrowth.
 */
export function calcPriceMixGrowth(
  valueGrowthDecimal: number | null | undefined,
  unitsGrowthDecimal: number | null | undefined
): number | null {
  if (
    valueGrowthDecimal === null ||
    valueGrowthDecimal === undefined ||
    unitsGrowthDecimal === null ||
    unitsGrowthDecimal === undefined
  ) {
    return null;
  }
  const denom = 1 + unitsGrowthDecimal;
  if (denom <= 0) return null;
  return (1 + valueGrowthDecimal) / denom - 1;
}

/**
 * Momentum = YTD growth minus MAT growth (in decimal; positive = accelerating).
 */
export function calcMomentum(
  ytdGrowthDecimal: number | null | undefined,
  matGrowthDecimal: number | null | undefined
): number | null {
  if (
    ytdGrowthDecimal === null ||
    ytdGrowthDecimal === undefined ||
    matGrowthDecimal === null ||
    matGrowthDecimal === undefined
  ) {
    return null;
  }
  return ytdGrowthDecimal - matGrowthDecimal;
}

/**
 * Winsorises a value strictly for chart colour scales (never for totals).
 */
export function winsoriseForColorScale(
  value: number | null | undefined,
  min: number,
  max: number
): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.max(min, Math.min(max, value));
}

/**
 * Recomputes competition ranks (1-based) within a scope.
 * Rows with value <= 0 receive rank = null (no sales -> no rank).
 * Ties receive the same standard competition rank (1, 2, 2, 4).
 */
export function computeScopeRanks(values: (number | null | undefined)[]): (number | null)[] {
  const indexed = values.map((v, idx) => ({
    idx,
    val: toSumValue(v),
  }));

  const positive = indexed.filter((item) => item.val > 0);
  positive.sort((a, b) => b.val - a.val);

  const ranks: (number | null)[] = new Array(values.length).fill(null);
  let currentRank = 1;
  for (let i = 0; i < positive.length; i++) {
    if (i > 0 && positive[i].val < positive[i - 1].val) {
      currentRank = i + 1;
    }
    ranks[positive[i].idx] = currentRank;
  }
  return ranks;
}

/**
 * Computes Herfindahl-Hirschman Index (HHI) on a 0..10,000 scale from row values within a scope.
 * HHI = sum((share_i * 100)^2).
 */
export function calcHHI(values: (number | null | undefined)[]): number | null {
  const positive = values.map(toSumValue).filter((v) => v > 0);
  const total = positive.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  return positive.reduce((sum, v) => {
    const pct = (v / total) * 100;
    return sum + pct * pct;
  }, 0);
}

export interface ComputedRowMetrics {
  v2024: number;
  v2025: number;
  v2026: number;
  growth24Source: GrowthMetric;
  growth25: GrowthMetric;
  growth26: GrowthMetric;
  cagr24_26: GrowthMetric;
  absGrowth26: number;
  contribGrowthPp: number | null;
  share24: number | null;
  share25: number | null;
  share26: number | null;
  totalMarketShare26: number | null;
  parentShare26: number | null;
  deltaShare26_25Pp: number | null;
  deltaShare25_24Pp: number | null;
  relShareChange26_25: number | null;
  evolutionIndex26: number | null;
  avgPrice24: number | null;
  avgPrice25: number | null;
  avgPrice26: number | null;
  priceMixGrowth26: number | null;
  volumeGrowth26: GrowthMetric;
  valueGrowth26: GrowthMetric;
  momentum26: number | null;
  rank: number | null;
}

/**
 * Formats a source 2024 growth value ("vs 2023 (source)").
 * In the raw workbook, -1 when 2024 value is 0/null means no data;
 * values > 9.99 are capped at +999% and flagged.
 */
export function normalizeSourceGrowth2024(
  sourceGrowth: number | null | undefined,
  val2024: number | null | undefined
): GrowthMetric {
  const v24 = toSumValue(val2024);
  if (sourceGrowth === null || sourceGrowth === undefined || Number.isNaN(sourceGrowth)) {
    return { status: 'null', raw: null, display: null, isNew: false, isCapped: false };
  }
  if (v24 <= 0 && sourceGrowth === -1) {
    return { status: 'null', raw: null, display: null, isNew: false, isCapped: false };
  }
  const isCapped = sourceGrowth > GROWTH_CAP_DECIMAL;
  return {
    status: isCapped ? 'capped' : 'ok',
    raw: sourceGrowth,
    display: isCapped ? GROWTH_CAP_DECIMAL : sourceGrowth,
    isNew: false,
    isCapped,
  };
}

/**
 * Share of Growth (SOG %) = (rowAbsGrowth / |scopeAbsGrowth|) * 100.
 * When scopeAbsGrowth > 0, positive SOG means contributing to market expansion.
 * When scopeAbsGrowth < 0 (contracting scope), dividing by |scopeAbsGrowth| preserves sign
 * so positive growers still show positive growth capture while decliners show negative drag.
 * Returns null if scopeAbsGrowth === 0.
 */
export function calcShareOfGrowthPct(
  rowAbsGrowth: number | null | undefined,
  scopeAbsGrowth: number | null | undefined
): number | null {
  if (
    rowAbsGrowth === null ||
    rowAbsGrowth === undefined ||
    Number.isNaN(rowAbsGrowth) ||
    scopeAbsGrowth === null ||
    scopeAbsGrowth === undefined ||
    Number.isNaN(scopeAbsGrowth) ||
    scopeAbsGrowth === 0
  ) {
    return null;
  }
  return (rowAbsGrowth / Math.abs(scopeAbsGrowth)) * 100;
}

/**
 * Price Index = entityAvgPrice / benchmarkAvgPrice (1.0 = parity with benchmark).
 * Returns null if either price is null, NaN, or <= 0.
 */
export function calcPriceIndex(
  entityAvgPrice: number | null | undefined,
  benchmarkAvgPrice: number | null | undefined
): number | null {
  if (
    entityAvgPrice === null ||
    entityAvgPrice === undefined ||
    Number.isNaN(entityAvgPrice) ||
    entityAvgPrice <= 0 ||
    benchmarkAvgPrice === null ||
    benchmarkAvgPrice === undefined ||
    Number.isNaN(benchmarkAvgPrice) ||
    benchmarkAvgPrice <= 0
  ) {
    return null;
  }
  return entityAvgPrice / benchmarkAvgPrice;
}

/**
 * Seasonality / Front-Load Index = (YTD / MAT) / (8 / 12) = (YTD / MAT) * 1.5.
 * Neutral (even 8-of-12 month pacing) = 1.00.
 * >= 1.10 indicates front-loaded Jan–Aug demand; <= 0.90 indicates back-loaded Sep–Dec demand.
 * Returns null if matValue <= 0 or ytdValue <= 0 or ytdValue > matValue * 1.5.
 */
export function calcSeasonalityIndex(
  ytdValue: number | null | undefined,
  matValue: number | null | undefined
): number | null {
  const ytd = toSumValue(ytdValue);
  const mat = toSumValue(matValue);
  if (mat <= 0 || ytd <= 0) return null;
  return (ytd / mat) / (8 / 12);
}

export interface FragilityInputItem {
  id?: string;
  name?: string;
  v2025: number;
  v2026: number;
  packCount: number;
}

export interface RevenueFragilityBreakdown {
  totalValue26: number;
  launchValue26: number;
  launchSharePct: number;
  launchCount: number;
  singlePackValue26: number;
  singlePackSharePct: number;
  singlePackCount: number;
  top3Value26: number;
  top3SharePct: number;
  top3Count: number;
  otherValue26: number;
  otherSharePct: number;
  otherCount: number;
  rawTop3SharePct: number;
  rawSinglePackSharePct: number;
}

/**
 * Decomposes 2026 scope revenue into 4 mutually exclusive segments with strict precedence:
 *   1. 2026 New Launches (v2025 <= 0 && v2026 > 0)
 *   2. Single-Pack Incumbents (not a launch, packCount === 1)
 *   3. Top-3 Multi-Pack Incumbents (top 3 by v2026 among non-launch multi-pack brands)
 *   4. All Other Brands
 * Guarantees the 4 segments sum to 100% of totalValue26 without double-counting.
 */
export function computeRevenueFragilitySegments(
  items: FragilityInputItem[]
): RevenueFragilityBreakdown {
  const active = items
    .filter((x) => x.v2026 > 0)
    .map((x, idx) => ({ ...x, _uid: x.id ?? `item_${idx}` }))
    .sort((a, b) => b.v2026 - a.v2026);

  const totalValue26 = active.reduce((s, x) => s + x.v2026, 0);
  if (totalValue26 <= 0) {
    return {
      totalValue26: 0,
      launchValue26: 0,
      launchSharePct: 0,
      launchCount: 0,
      singlePackValue26: 0,
      singlePackSharePct: 0,
      singlePackCount: 0,
      top3Value26: 0,
      top3SharePct: 0,
      top3Count: 0,
      otherValue26: 0,
      otherSharePct: 0,
      otherCount: 0,
      rawTop3SharePct: 0,
      rawSinglePackSharePct: 0,
    };
  }

  const rawTop3Val = active.slice(0, 3).reduce((s, x) => s + x.v2026, 0);
  const rawSinglePackVal = active
    .filter((x) => x.packCount === 1)
    .reduce((s, x) => s + x.v2026, 0);

  const top3MultiPackIds = new Set(
    active
      .filter((x) => !(x.v2025 <= 0 && x.v2026 > 0) && x.packCount > 1)
      .slice(0, 3)
      .map((x) => x._uid)
  );

  let launchValue26 = 0,
    launchCount = 0;
  let singlePackValue26 = 0,
    singlePackCount = 0;
  let top3Value26 = 0,
    top3Count = 0;
  let otherValue26 = 0,
    otherCount = 0;

  for (const item of active) {
    const isLaunch = item.v2025 <= 0 && item.v2026 > 0;
    if (isLaunch) {
      launchValue26 += item.v2026;
      launchCount++;
    } else if (item.packCount === 1) {
      singlePackValue26 += item.v2026;
      singlePackCount++;
    } else if (top3MultiPackIds.has(item._uid)) {
      top3Value26 += item.v2026;
      top3Count++;
    } else {
      otherValue26 += item.v2026;
      otherCount++;
    }
  }

  return {
    totalValue26,
    launchValue26,
    launchSharePct: (launchValue26 / totalValue26) * 100,
    launchCount,
    singlePackValue26,
    singlePackSharePct: (singlePackValue26 / totalValue26) * 100,
    singlePackCount,
    top3Value26,
    top3SharePct: (top3Value26 / totalValue26) * 100,
    top3Count,
    otherValue26,
    otherSharePct: (otherValue26 / totalValue26) * 100,
    otherCount,
    rawTop3SharePct: (rawTop3Val / totalValue26) * 100,
    rawSinglePackSharePct: (rawSinglePackVal / totalValue26) * 100,
  };
}
