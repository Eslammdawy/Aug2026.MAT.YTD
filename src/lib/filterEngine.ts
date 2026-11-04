import type {
  CompactRowTuple,
  DimensionKey,
  MarketDatasetJSON,
  MeasureType,
  PeriodType,
  SourceLevel,
} from '../types/market';

export const DIMENSION_KEYS: DimensionKey[] = ['atc1', 'atc4', 'nfc1', 'product', 'pack'];

export type FilterSelections = Record<DimensionKey, number[]>;

export interface FilterOptionStat {
  idx: number;
  label: string;
  /** Number of matching leaf rows when this option is active alongside all OTHER filters */
  rowCount: number;
  /** Total metric value (e.g. MAT 2026 EGP Value) for this option given all OTHER filters */
  metricValue: number;
  /** True if currently selected in this dimension's filter */
  selected: boolean;
  /** True if rowCount > 0 */
  available: boolean;
}

export interface FacetedFilterStateResult {
  optionsByDim: Record<DimensionKey, FilterOptionStat[]>;
  availableSetByDim: Record<DimensionKey, Set<number>>;
  /** Leaf Pack-level row indices (within dataset.rows) matching all active filters */
  matchingPackRowIndices: number[];
  /** Product-level row indices (within dataset.rows) matching active ATC1/ATC4/NFC1/Product filters */
  matchingProductRowIndices: number[];
  /** NFC1-level row indices (within dataset.rows) matching active ATC1/ATC4/NFC1 filters */
  matchingNfc1RowIndices: number[];
  /** Which hierarchy level is used to compute the non-double-counted scope total */
  scopeAggregationLevel: SourceLevel;
  /** The exact rows (all at `scopeAggregationLevel`, never mixing levels) used for scope totals */
  scopeRows: CompactRowTuple[];
}

export interface IndexedMarketData {
  dataset: MarketDatasetJSON;
  /** Indices in `dataset.rows` where levelCode === 0 (851 rows) */
  nfc1RowIndices: number[];
  /** Indices in `dataset.rows` where levelCode === 1 (11,067 rows) */
  productRowIndices: number[];
  /** Indices in `dataset.rows` where levelCode === 2 (16,492 rows) */
  packRowIndices: number[];
  /** Inverted index mapping dimension -> dictIdx -> array of Pack-level row indices */
  packRowsByDimValue: Record<DimensionKey, number[][]>;
}

/**
 * Tuple column offset for a given period, year, and measure.
 * Tuple indices:
 * 7: ytd_2024_units, 8: ytd_2025_units, 9: ytd_2026_units
 * 10: ytd_2024_value, 11: ytd_2025_value, 12: ytd_2026_value
 * 13: mat_2024_units, 14: mat_2025_units, 15: mat_2026_units
 * 16: mat_2024_value, 17: mat_2025_value, 18: mat_2026_value
 */
export function getMetricTupleIndex(
  period: PeriodType,
  measure: MeasureType,
  year: 2024 | 2025 | 2026
): number {
  const yearOffset = year - 2024; // 0, 1, 2
  if (period === 'ytd') {
    return (measure === 'units' ? 7 : 10) + yearOffset;
  }
  return (measure === 'units' ? 13 : 16) + yearOffset;
}

export function getSourceGrowth2024TupleIndex(
  period: PeriodType,
  measure: MeasureType
): number {
  if (period === 'ytd') {
    return measure === 'units' ? 19 : 20;
  }
  return measure === 'units' ? 21 : 22;
}

export function getDimTupleIndex(dim: DimensionKey): 2 | 3 | 4 | 5 | 6 {
  switch (dim) {
    case 'atc1':
      return 2;
    case 'atc4':
      return 3;
    case 'nfc1':
      return 4;
    case 'product':
      return 5;
    case 'pack':
      return 6;
  }
}

/**
 * Builds fast inverted indexes over the 28,410 rows in < 15ms.
 */
export function buildIndexedMarketData(dataset: MarketDatasetJSON): IndexedMarketData {
  const nfc1RowIndices: number[] = [];
  const productRowIndices: number[] = [];
  const packRowIndices: number[] = [];

  const packRowsByDimValue: Record<DimensionKey, number[][]> = {
    atc1: Array.from({ length: dataset.dicts.atc1.length }, () => []),
    atc4: Array.from({ length: dataset.dicts.atc4.length }, () => []),
    nfc1: Array.from({ length: dataset.dicts.nfc1.length }, () => []),
    product: Array.from({ length: dataset.dicts.product.length }, () => []),
    pack: Array.from({ length: dataset.dicts.pack.length }, () => []),
  };

  const rows = dataset.rows;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const levelCode = r[1];
    if (levelCode === 0) {
      nfc1RowIndices.push(i);
    } else if (levelCode === 1) {
      productRowIndices.push(i);
    } else if (levelCode === 2) {
      packRowIndices.push(i);
      if (r[2] >= 0) packRowsByDimValue.atc1[r[2]].push(i);
      if (r[3] >= 0) packRowsByDimValue.atc4[r[3]].push(i);
      if (r[4] >= 0) packRowsByDimValue.nfc1[r[4]].push(i);
      if (r[5] >= 0) packRowsByDimValue.product[r[5]].push(i);
      if (r[6] >= 0) packRowsByDimValue.pack[r[6]].push(i);
    }
  }

  return {
    dataset,
    nfc1RowIndices,
    productRowIndices,
    packRowIndices,
    packRowsByDimValue,
  };
}

/**
 * Determines which single hierarchy level should be summed for scope totals so levels are NEVER mixed.
 * - When Pack filter has selections -> 'Pack'
 * - When Product filter has selections (and Pack does not) -> 'Product'
 * - When only ATC1/ATC4/NFC1 (or no filters) are active -> 'NFC1'
 */
export function determineScopeAggregationLevel(selections: FilterSelections): SourceLevel {
  if (selections.pack.length > 0) return 'Pack';
  if (selections.product.length > 0) return 'Product';
  return 'NFC1';
}

/**
 * Given a change in `changedDim` (or a set of selections), validates and auto-prunes any
 * selections in OTHER dimensions that no longer have any matching rows.
 * Returns the cleaned selections and the count of removed invalid selections.
 */
export function sanitizeAndPruneSelections(
  indexed: IndexedMarketData,
  nextSelections: FilterSelections,
  changedDim?: DimensionKey
): { selections: FilterSelections; removedCount: number; removedDetails: string[] } {
  const cleaned: FilterSelections = {
    atc1: Array.from(new Set(nextSelections.atc1)),
    atc4: Array.from(new Set(nextSelections.atc4)),
    nfc1: Array.from(new Set(nextSelections.nfc1)),
    product: Array.from(new Set(nextSelections.product)),
    pack: Array.from(new Set(nextSelections.pack)),
  };

  let removedCount = 0;
  const removedDetails: string[] = [];
  const rows = indexed.dataset.rows;

  // Helper to check which values of `targetDim` exist when filtering by a subset of dimensions
  const getValidValuesForDim = (
    targetDim: DimensionKey,
    constrainingDims: DimensionKey[]
  ): Set<number> => {
    const sets: Record<DimensionKey, Set<number> | null> = {
      atc1: null,
      atc4: null,
      nfc1: null,
      product: null,
      pack: null,
    };
    for (const d of constrainingDims) {
      if (d !== targetDim && cleaned[d].length > 0) {
        sets[d] = new Set(cleaned[d]);
      }
    }

    const valid = new Set<number>();
    const targetCol = getDimTupleIndex(targetDim);
    for (const rowIdx of indexed.packRowIndices) {
      const r = rows[rowIdx];
      if (sets.atc1 && !sets.atc1.has(r[2])) continue;
      if (sets.atc4 && !sets.atc4.has(r[3])) continue;
      if (sets.nfc1 && !sets.nfc1.has(r[4])) continue;
      if (sets.product && !sets.product.has(r[5])) continue;
      if (sets.pack && !sets.pack.has(r[6])) continue;
      valid.add(r[targetCol]);
    }
    return valid;
  };

  // If a specific dimension changed and has selections, first ensure other dimensions are compatible with it
  const orderedOtherDims = DIMENSION_KEYS.filter((d) => d !== changedDim);
  const activeConstraints: DimensionKey[] =
    changedDim && cleaned[changedDim].length > 0 ? [changedDim] : [];

  for (const dim of orderedOtherDims) {
    if (cleaned[dim].length === 0) continue;
    const constraintsToUse =
      activeConstraints.length > 0
        ? activeConstraints
        : DIMENSION_KEYS.filter((d) => d !== dim && cleaned[d].length > 0);

    const validSet = getValidValuesForDim(dim, constraintsToUse);
    const before = cleaned[dim];
    const after = before.filter((v) => validSet.has(v));
    if (after.length < before.length) {
      const diff = before.filter((v) => !validSet.has(v));
      removedCount += diff.length;
      for (const v of diff) {
        removedDetails.push(`${dim.toUpperCase()}: ${indexed.dataset.dicts[dim][v]}`);
      }
      cleaned[dim] = after;
    }
    if (cleaned[dim].length > 0) {
      activeConstraints.push(dim);
    }
  }

  return { selections: cleaned, removedCount, removedDetails };
}

/**
 * Computes bi-directional faceted filter options and matching row indices across all levels.
 * Each dimension's options are computed from rows matching ALL OTHER active filters
 * (excluding the dimension's own selection so users can still add values with OR logic).
 */
export function computeFacetedFilterState(
  indexed: IndexedMarketData,
  selections: FilterSelections,
  period: PeriodType = 'mat',
  measure: MeasureType = 'value'
): FacetedFilterStateResult {
  const { dataset, packRowIndices, productRowIndices, nfc1RowIndices } = indexed;
  const rows = dataset.rows;
  const metricCol = getMetricTupleIndex(period, measure, 2026);

  const selSets: Record<DimensionKey, Set<number> | null> = {
    atc1: selections.atc1.length > 0 ? new Set(selections.atc1) : null,
    atc4: selections.atc4.length > 0 ? new Set(selections.atc4) : null,
    nfc1: selections.nfc1.length > 0 ? new Set(selections.nfc1) : null,
    product: selections.product.length > 0 ? new Set(selections.product) : null,
    pack: selections.pack.length > 0 ? new Set(selections.pack) : null,
  };

  // Count and value accumulators per dimension
  const rowCounts: Record<DimensionKey, Int32Array> = {
    atc1: new Int32Array(dataset.dicts.atc1.length),
    atc4: new Int32Array(dataset.dicts.atc4.length),
    nfc1: new Int32Array(dataset.dicts.nfc1.length),
    product: new Int32Array(dataset.dicts.product.length),
    pack: new Int32Array(dataset.dicts.pack.length),
  };

  const metricSums: Record<DimensionKey, Float64Array> = {
    atc1: new Float64Array(dataset.dicts.atc1.length),
    atc4: new Float64Array(dataset.dicts.atc4.length),
    nfc1: new Float64Array(dataset.dicts.nfc1.length),
    product: new Float64Array(dataset.dicts.product.length),
    pack: new Float64Array(dataset.dicts.pack.length),
  };

  const matchingPackRowIndices: number[] = [];

  // Single pass over the 16,492 leaf Pack rows to compute:
  // 1) matchingPackRowIndices (matching all 5 filters)
  // 2) available options for each dimension (matching the OTHER 4 filters!)
  for (let i = 0; i < packRowIndices.length; i++) {
    const rowIdx = packRowIndices[i];
    const r = rows[rowIdx];

    const mAtc1 = !selSets.atc1 || selSets.atc1.has(r[2]);
    const mAtc4 = !selSets.atc4 || selSets.atc4.has(r[3]);
    const mNfc1 = !selSets.nfc1 || selSets.nfc1.has(r[4]);
    const mProd = !selSets.product || selSets.product.has(r[5]);
    const mPack = !selSets.pack || selSets.pack.has(r[6]);

    // Count how many filters fail
    const failCount =
      (mAtc1 ? 0 : 1) +
      (mAtc4 ? 0 : 1) +
      (mNfc1 ? 0 : 1) +
      (mProd ? 0 : 1) +
      (mPack ? 0 : 1);

    if (failCount > 1) continue;

    const val = (r[metricCol] as number) || 0;

    if (failCount === 0) {
      // Matches ALL 5 filters -> contributes to all 5 dimensions' option lists and to matchingPackRowIndices
      matchingPackRowIndices.push(rowIdx);
      rowCounts.atc1[r[2]]++;
      metricSums.atc1[r[2]] += val;
      rowCounts.atc4[r[3]]++;
      metricSums.atc4[r[3]] += val;
      rowCounts.nfc1[r[4]]++;
      metricSums.nfc1[r[4]] += val;
      rowCounts.product[r[5]]++;
      metricSums.product[r[5]] += val;
      rowCounts.pack[r[6]]++;
      metricSums.pack[r[6]] += val;
    } else {
      // Fails exactly ONE filter -> contributes to THAT single dimension's option list!
      if (!mAtc1) {
        rowCounts.atc1[r[2]]++;
        metricSums.atc1[r[2]] += val;
      } else if (!mAtc4) {
        rowCounts.atc4[r[3]]++;
        metricSums.atc4[r[3]] += val;
      } else if (!mNfc1) {
        rowCounts.nfc1[r[4]]++;
        metricSums.nfc1[r[4]] += val;
      } else if (!mProd) {
        rowCounts.product[r[5]]++;
        metricSums.product[r[5]] += val;
      } else if (!mPack) {
        rowCounts.pack[r[6]]++;
        metricSums.pack[r[6]] += val;
      }
    }
  }

  const optionsByDim = {} as Record<DimensionKey, FilterOptionStat[]>;
  const availableSetByDim = {} as Record<DimensionKey, Set<number>>;

  for (const dim of DIMENSION_KEYS) {
    const dict = dataset.dicts[dim];
    const counts = rowCounts[dim];
    const sums = metricSums[dim];
    const selSet = selSets[dim];
    const availSet = new Set<number>();
    const opts: FilterOptionStat[] = new Array(dict.length);

    for (let idx = 0; idx < dict.length; idx++) {
      const rc = counts[idx];
      const available = rc > 0;
      if (available) availSet.add(idx);
      opts[idx] = {
        idx,
        label: dict[idx],
        rowCount: rc,
        metricValue: sums[idx],
        selected: selSet ? selSet.has(idx) : false,
        available,
      };
    }
    optionsByDim[dim] = opts;
    availableSetByDim[dim] = availSet;
  }

  // Determine non-double-counted scope rows according to hierarchy-level rules
  const scopeAggregationLevel = determineScopeAggregationLevel(selections);

  const matchingNfc1RowIndices: number[] = [];
  if (scopeAggregationLevel === 'NFC1') {
    for (let i = 0; i < nfc1RowIndices.length; i++) {
      const rowIdx = nfc1RowIndices[i];
      const r = rows[rowIdx];
      if (selSets.atc1 && !selSets.atc1.has(r[2])) continue;
      if (selSets.atc4 && !selSets.atc4.has(r[3])) continue;
      if (selSets.nfc1 && !selSets.nfc1.has(r[4])) continue;
      matchingNfc1RowIndices.push(rowIdx);
    }
  }

  const matchingProductRowIndices: number[] = [];
  if (scopeAggregationLevel === 'Product' || scopeAggregationLevel === 'NFC1') {
    for (let i = 0; i < productRowIndices.length; i++) {
      const rowIdx = productRowIndices[i];
      const r = rows[rowIdx];
      if (selSets.atc1 && !selSets.atc1.has(r[2])) continue;
      if (selSets.atc4 && !selSets.atc4.has(r[3])) continue;
      if (selSets.nfc1 && !selSets.nfc1.has(r[4])) continue;
      if (selSets.product && !selSets.product.has(r[5])) continue;
      matchingProductRowIndices.push(rowIdx);
    }
  }

  let scopeRows: CompactRowTuple[];
  if (scopeAggregationLevel === 'Pack') {
    scopeRows = matchingPackRowIndices.map((idx) => rows[idx]);
  } else if (scopeAggregationLevel === 'Product') {
    scopeRows = matchingProductRowIndices.map((idx) => rows[idx]);
  } else {
    scopeRows = matchingNfc1RowIndices.map((idx) => rows[idx]);
  }

  return {
    optionsByDim,
    availableSetByDim,
    matchingPackRowIndices,
    matchingProductRowIndices,
    matchingNfc1RowIndices,
    scopeAggregationLevel,
    scopeRows,
  };
}
