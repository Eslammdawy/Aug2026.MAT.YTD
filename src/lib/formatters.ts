import type { MeasureType } from '../types/market';
import type { GrowthMetric } from './metrics';

/**
 * Formats an EGP value or Units value in compact form (bn / mn / k) with 1 decimal place
 * as specified in Section 3 ("Values in EGP mn/bn with 1 decimal").
 */
export function formatCompactValue(
  val: number | null | undefined,
  measure: MeasureType = 'value',
  includeCurrency = false
): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  const prefix = includeCurrency && measure === 'value' ? 'EGP ' : '';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (abs === 0) return `${prefix}0.0`;
  if (abs >= 1e9) {
    return `${sign}${prefix}${(abs / 1e9).toFixed(1)}bn`;
  }
  if (abs >= 1e6) {
    return `${sign}${prefix}${(abs / 1e6).toFixed(1)}mn`;
  }
  if (abs >= 1e3) {
    return `${sign}${prefix}${(abs / 1e3).toFixed(1)}k`;
  }
  return `${sign}${prefix}${abs.toFixed(measure === 'value' ? 1 : 0)}`;
}

/**
 * Formats an exact value for rich tooltips (e.g. "EGP 3,015,493,773" or "26,909,839 units").
 */
export function formatExactValue(
  val: number | null | undefined,
  measure: MeasureType = 'value'
): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  if (measure === 'value') {
    return `EGP ${val.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }
  return `${val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} units`;
}

/**
 * Formats a GrowthMetric object with 1 decimal %, handling 'New', 'null', and '+999.0%+' capped flags.
 */
export function formatGrowthMetric(g: GrowthMetric | null | undefined): string {
  if (!g || g.status === 'null') return '—';
  if (g.status === 'new' || g.isNew) return 'New';
  if (g.display === null) return '—';
  const pct = g.display * 100;
  const sign = pct > 0 ? '+' : '';
  if (g.isCapped) {
    return `+999.0%+`;
  }
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Formats a raw decimal growth/ratio value with 1 decimal %.
 */
export function formatDecimalPct(
  val: number | null | undefined,
  decimals = 1,
  showPlus = true
): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  const pct = val * 100;
  const sign = showPlus && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

/**
 * Formats Market Share (decimal 0..1) as % with 2 decimals.
 */
export function formatSharePct(shareDecimal: number | null | undefined): string {
  if (shareDecimal === null || shareDecimal === undefined || Number.isNaN(shareDecimal)) {
    return '—';
  }
  return `${(shareDecimal * 100).toFixed(2)}%`;
}

/**
 * Formats percentage point (pp) change or contribution with 2 decimals.
 */
export function formatPp(ppVal: number | null | undefined, decimals = 2): string {
  if (ppVal === null || ppVal === undefined || Number.isNaN(ppVal)) return '—';
  const sign = ppVal > 0 ? '+' : '';
  return `${sign}${ppVal.toFixed(decimals)} pp`;
}

/**
 * Formats Evolution Index (centered at 100).
 */
export function formatEvolutionIndex(ei: number | null | undefined): string {
  if (ei === null || ei === undefined || Number.isNaN(ei)) return '—';
  if (ei > 999) return '999+';
  return ei.toFixed(1);
}

/**
 * Formats Average Price in EGP.
 */
export function formatPriceEgp(price: number | null | undefined): string {
  if (price === null || price === undefined || Number.isNaN(price)) return '—';
  if (price >= 1000) {
    return `EGP ${price.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }
  return `EGP ${price.toFixed(1)}`;
}
