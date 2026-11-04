export type SourceLevel = 'NFC1' | 'Product' | 'Pack';
export type HierarchyLevel = 'GrandTotal' | 'ATC1' | 'ATC4' | 'NFC1' | 'Product' | 'Pack';

export type PeriodType = 'mat' | 'ytd';
export type MeasureType = 'value' | 'units';
export type DimensionKey = 'atc1' | 'atc4' | 'nfc1' | 'product' | 'pack';

export type GroupByMode =
  | 'tree_product_pack'
  | 'tree_full'
  | 'Product'
  | 'Pack'
  | 'NFC1'
  | 'ATC4'
  | 'ATC1';

export type ShareBasis = 'scope' | 'parent' | 'total';

/**
 * Tuple representation of a source or pre-aggregated row in compact JSON:
 * [
 *   0: id (number),
 *   1: levelCode (0=NFC1, 1=Product, 2=Pack, 3=ATC4, 4=ATC1, 5=GrandTotal),
 *   2: atc1Idx (number, -1 if N/A),
 *   3: atc4Idx (number, -1 if N/A),
 *   4: nfc1Idx (number, -1 if N/A),
 *   5: prodIdx (number, -1 if N/A),
 *   6: packIdx (number, -1 if N/A),
 *   7: ytd_2024_units (number),
 *   8: ytd_2025_units (number),
 *   9: ytd_2026_units (number),
 *   10: ytd_2024_value (number),
 *   11: ytd_2025_value (number),
 *   12: ytd_2026_value (number),
 *   13: mat_2024_units (number),
 *   14: mat_2025_units (number),
 *   15: mat_2026_units (number),
 *   16: mat_2024_value (number),
 *   17: mat_2025_value (number),
 *   18: mat_2026_value (number),
 *   19: ytd_2024_units_growth_src (number | null),
 *   20: ytd_2024_value_growth_src (number | null),
 *   21: mat_2024_units_growth_src (number | null),
 *   22: mat_2024_value_growth_src (number | null)
 * ]
 */
export type CompactRowTuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number | null
];

export interface MarketDatasetMeta {
  generatedAt: string;
  currency: string;
  sourceSheet: string;
  sourceRowCount: number;
  levelCounts: {
    GrandTotal: number;
    ATC1: number;
    ATC4: number;
    NFC1: number;
    Product: number;
    Pack: number;
  };
  uniqueCounts: {
    atc1: number;
    atc4: number;
    nfc1: number;
    product: number;
    pack: number;
  };
  flaggedSourceGrowthOver1000: {
    mat_2026_value: number;
    mat_2026_units: number;
    ytd_2026_value: number;
    ytd_2026_units: number;
    allGrowthColumnsTotal: number;
  };
  grandTotals: {
    ytd_2024_units: number;
    ytd_2025_units: number;
    ytd_2026_units: number;
    ytd_2024_value: number;
    ytd_2025_value: number;
    ytd_2026_value: number;
    mat_2024_units: number;
    mat_2025_units: number;
    mat_2026_units: number;
    mat_2024_value: number;
    mat_2025_value: number;
    mat_2026_value: number;
  };
}

export interface MarketDatasetJSON {
  meta: MarketDatasetMeta;
  dicts: {
    atc1: string[];
    atc4: string[];
    nfc1: string[];
    product: string[];
    pack: string[];
  };
  /** 28,410 source rows (NFC1=851, Product=11,067, Pack=16,492) */
  rows: CompactRowTuple[];
  /** Pre-built higher-level rows summed strictly from NFC1 rows (ATC4=507, ATC1=16, GrandTotal=1) */
  aggregates: {
    atc4: CompactRowTuple[];
    atc1: CompactRowTuple[];
    grandTotal: CompactRowTuple;
  };
}

export interface HydratedRow {
  id: number;
  level: HierarchyLevel;
  atc1Idx: number;
  atc4Idx: number;
  nfc1Idx: number;
  prodIdx: number;
  packIdx: number;
  atc1: string;
  atc4: string;
  nfc1: string;
  product: string;
  pack: string;
  ytd_2024_units: number;
  ytd_2025_units: number;
  ytd_2026_units: number;
  ytd_2024_value: number;
  ytd_2025_value: number;
  ytd_2026_value: number;
  mat_2024_units: number;
  mat_2025_units: number;
  mat_2026_units: number;
  mat_2024_value: number;
  mat_2025_value: number;
  mat_2026_value: number;
  ytd_2024_units_growth_src: number | null;
  ytd_2024_value_growth_src: number | null;
  mat_2024_units_growth_src: number | null;
  mat_2024_value_growth_src: number | null;
}
