import { describe, expect, it } from 'vitest';
import {
  calcAbsoluteGrowth,
  calcAveragePrice,
  calcCagr24To26,
  calcContributionToGrowthPp,
  calcDeltaSharePp,
  calcEvolutionIndex,
  calcGrowth,
  calcHHI,
  calcMarketShare,
  calcMomentum,
  calcPriceIndex,
  calcPriceMixGrowth,
  calcRelativeShareChange,
  calcSeasonalityIndex,
  calcShareOfGrowthPct,
  computeRevenueFragilitySegments,
  computeScopeRanks,
  GROWTH_CAP_DECIMAL,
  normalizeSourceGrowth2024,
  normalizeSourceRank,
  winsoriseForColorScale,
} from './metrics';

describe('metrics.ts pure calculation utilities', () => {
  it('computes normal YoY growth accurately', () => {
    const res = calcGrowth(125, 100);
    expect(res.status).toBe('ok');
    expect(res.raw).toBeCloseTo(0.25, 6);
    expect(res.display).toBeCloseTo(0.25, 6);
    expect(res.isNew).toBe(false);
    expect(res.isCapped).toBe(false);
  });

  it('returns status="new" when prior period is 0 or null and current > 0', () => {
    const fromZero = calcGrowth(500, 0);
    expect(fromZero.status).toBe('new');
    expect(fromZero.isNew).toBe(true);
    expect(fromZero.raw).toBeNull();
    expect(fromZero.display).toBeNull();

    const fromNull = calcGrowth(500, null);
    expect(fromNull.status).toBe('new');
    expect(fromNull.isNew).toBe(true);
  });

  it('returns status="null" when both prior and current are 0 or null', () => {
    expect(calcGrowth(0, 0).status).toBe('null');
    expect(calcGrowth(null, null).status).toBe('null');
    expect(calcGrowth(0, null).status).toBe('null');
  });

  it('returns -100% (-1.0) when prior > 0 and current is 0 or null (discontinued)', () => {
    const disc = calcGrowth(0, 250);
    expect(disc.status).toBe('ok');
    expect(disc.raw).toBeCloseTo(-1, 6);
    expect(calcGrowth(null, 250).raw).toBeCloseTo(-1, 6);
  });

  it('caps displayed growth at +999% (9.99) and flags isCapped=true', () => {
    const extreme = calcGrowth(1500, 100); // +1400% (14.0)
    expect(extreme.status).toBe('capped');
    expect(extreme.isCapped).toBe(true);
    expect(extreme.raw).toBeCloseTo(14.0, 6);
    expect(extreme.display).toBeCloseTo(GROWTH_CAP_DECIMAL, 6);
  });

  it('computes 2-year CAGR (2024 to 2026) and handles invalid bases', () => {
    const cagr = calcCagr24To26(144, 100); // (1.44)^0.5 - 1 = 0.20 (+20%)
    expect(cagr.status).toBe('ok');
    expect(cagr.raw).toBeCloseTo(0.2, 6);

    expect(calcCagr24To26(100, 0).status).toBe('null');
    expect(calcCagr24To26(100, null).status).toBe('null');
    expect(calcCagr24To26(-10, 100).status).toBe('null');
  });

  it('computes absolute growth and contribution to growth (pp)', () => {
    expect(calcAbsoluteGrowth(150, 100)).toBe(50);
    expect(calcAbsoluteGrowth(null, 100)).toBe(-100);
    // Row grew by 50 on a scope 2025 base of 1000 -> +5.0 pp contribution
    expect(calcContributionToGrowthPp(150, 100, 1000)).toBeCloseTo(5.0, 6);
    expect(calcContributionToGrowthPp(150, 100, 0)).toBeNull();
  });

  it('computes market share, delta-share (pp), and relative share change', () => {
    const s25 = calcMarketShare(200, 1000); // 0.20
    const s26 = calcMarketShare(250, 1000); // 0.25
    expect(s25).toBeCloseTo(0.2, 6);
    expect(s26).toBeCloseTo(0.25, 6);
    expect(calcDeltaSharePp(s26, s25)).toBeCloseTo(5.0, 6); // +5.00 pp
    expect(calcRelativeShareChange(s26, s25)).toBeCloseTo(0.25, 6); // +25%
    expect(calcMarketShare(100, 0)).toBeNull();
  });

  it('computes Evolution Index = (1 + rowGrowth) / (1 + marketGrowth) * 100', () => {
    // Row grew 26.5%, market grew 15.0% -> (1.265 / 1.15) * 100 = 110.0
    expect(calcEvolutionIndex(0.265, 0.15)).toBeCloseTo(110.0, 5);
    expect(calcEvolutionIndex(null, 0.15)).toBeNull();
    expect(calcEvolutionIndex(0.2, -1)).toBeNull();
  });

  it('computes average price and price/mix growth', () => {
    expect(calcAveragePrice(1000, 10)).toBeCloseTo(100, 6);
    expect(calcAveragePrice(1000, 0)).toBeNull();
    // Value grew 21%, units grew 10% -> price/mix = 1.21 / 1.10 - 1 = +10% (0.10)
    expect(calcPriceMixGrowth(0.21, 0.1)).toBeCloseTo(0.1, 6);
  });

  it('computes momentum, source rank normalization, competition ranks, Winsorisation, and HHI', () => {
    expect(calcMomentum(0.25, 0.18)).toBeCloseTo(0.07, 6);
    expect(normalizeSourceRank(-1)).toBeNull();
    expect(normalizeSourceRank(0)).toBeNull();
    expect(normalizeSourceRank(5)).toBe(5);

    const ranks = computeScopeRanks([100, 300, 300, 0, 50]);
    expect(ranks).toEqual([3, 1, 1, null, 4]);

    expect(winsoriseForColorScale(250, 50, 150)).toBe(150);
    expect(winsoriseForColorScale(20, 50, 150)).toBe(50);

    // Two equal players (50% each) -> HHI = 50^2 + 50^2 = 5000
    expect(calcHHI([500, 500])).toBeCloseTo(5000, 5);

    // Source 2024 growth normalization: -1 with 0 sales -> null
    expect(normalizeSourceGrowth2024(-1, 0).status).toBe('null');
    expect(normalizeSourceGrowth2024(12.5, 100).isCapped).toBe(true);
  });

  it('computes Share of Growth (SOG %) across expanding and contracting scopes', () => {
    expect(calcShareOfGrowthPct(250, 1000)).toBeCloseTo(25.0, 5);
    // When scope is contracting (-500), denominator uses |scopeAbsGrowth| = 500
    expect(calcShareOfGrowthPct(100, -500)).toBeCloseTo(20.0, 5);
    expect(calcShareOfGrowthPct(-150, -500)).toBeCloseTo(-30.0, 5);
    expect(calcShareOfGrowthPct(100, 0)).toBeNull();
  });

  it('computes Price Index and Seasonality Index with zero-base guards', () => {
    expect(calcPriceIndex(150, 100)).toBeCloseTo(1.5, 5);
    expect(calcPriceIndex(null, 100)).toBeNull();
    expect(calcPriceIndex(150, 0)).toBeNull();

    // Expected uniform 8-month share is 8/12 = 0.6667. If YTD = 80 and MAT = 100 -> 0.8 / (8/12) = 1.20
    expect(calcSeasonalityIndex(80, 100)).toBeCloseTo(1.2, 5);
    expect(calcSeasonalityIndex(50, 0)).toBeNull();
  });

  it('computes non-overlapping Revenue Fragility segments summing to 100%', () => {
    const items = [
      { v2025: 0, v2026: 100, packCount: 1 }, // Launch (100) — must not double-count in single-pack
      { v2025: 200, v2026: 300, packCount: 1 }, // Single-pack incumbent (300) — must not enter top-3 multi-pack
      { v2025: 150, v2026: 250, packCount: 3 }, // Multi-pack #1 (250)
      { v2025: 120, v2026: 150, packCount: 2 }, // Multi-pack #2 (150)
      { v2025: 90, v2026: 100, packCount: 4 }, // Multi-pack #3 (100)
      { v2025: 80, v2026: 100, packCount: 2 }, // Multi-pack #4 -> Other (100)
    ];
    const res = computeRevenueFragilitySegments(items);
    expect(res.launchSharePct).toBeCloseTo(10.0, 5);
    expect(res.singlePackSharePct).toBeCloseTo(30.0, 5);
    expect(res.top3SharePct).toBeCloseTo(50.0, 5);
    expect(res.otherSharePct).toBeCloseTo(10.0, 5);
    const totalPct =
      res.launchSharePct +
      res.singlePackSharePct +
      res.top3SharePct +
      res.otherSharePct;
    expect(totalPct).toBeCloseTo(100.0, 5);
  });
});
