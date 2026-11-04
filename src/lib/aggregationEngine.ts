import type {
  CompactRowTuple,
  DimensionKey,
  GroupByMode,
  HierarchyLevel,
  MeasureType,
  PeriodType,
} from '../types/market';
import type { FacetedFilterStateResult, IndexedMarketData } from './filterEngine';
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
  calcPriceMixGrowth,
  calcRelativeShareChange,
  computeScopeRanks,
  type GrowthMetric,
  normalizeSourceGrowth2024,
} from './metrics';

export interface Raw12Metrics {
  ytd24U: number;
  ytd25U: number;
  ytd26U: number;
  ytd24V: number;
  ytd25V: number;
  ytd26V: number;
  mat24U: number;
  mat25U: number;
  mat26U: number;
  mat24V: number;
  mat25V: number;
  mat26V: number;
  impYtd23U: number;
  impYtd23V: number;
  impMat23U: number;
  impMat23V: number;
}

export interface TableNode {
  id: string;
  name: string;
  subtitle?: string;
  level: HierarchyLevel;
  depth: number;
  dimKey?: DimensionKey;
  dictIdx?: number;
  atc1Idx: number;
  atc4Idx: number;
  nfc1Idx: number;
  prodIdx: number;
  packIdx: number;
  atc1Name: string;
  atc4Name: string;
  nfc1Name: string;
  productName: string;
  packName: string;
  // Active Period + Measure values
  v2024: number;
  v2025: number;
  v2026: number;
  // Complementary measure values (so Units growth is always available next to Value growth)
  units2024: number;
  units2025: number;
  units2026: number;
  value2024: number;
  value2025: number;
  value2026: number;
  // Growth & CAGR for active measure
  growth24Source: GrowthMetric;
  growth25: GrowthMetric;
  growth26: GrowthMetric;
  cagr24_26: GrowthMetric;
  // Dual Value & Units growth & CAGR for active period
  valueGrowth26: GrowthMetric;
  unitsGrowth26: GrowthMetric;
  valueCagr24_26: GrowthMetric;
  unitsCagr24_26: GrowthMetric;
  // Absolute & contribution
  absGrowth26: number;
  contribGrowthPp: number | null;
  // Market share (scope-based) + secondary total market share + parent share
  share24: number | null;
  share25: number | null;
  share26: number | null;
  totalMarketShare25: number | null;
  totalMarketShare26: number | null;
  deltaTotalShare26_25Pp: number | null;
  parentShare26: number | null;
  deltaShare26_25Pp: number | null;
  deltaShare25_24Pp: number | null;
  relShareChange26_25: number | null;
  // Indices & Price/Mix & Momentum
  evolutionIndex25: number | null;
  evolutionIndex26: number | null;
  avgPrice24: number | null;
  avgPrice25: number | null;
  avgPrice26: number | null;
  priceMixGrowth26: number | null;
  momentum26: number | null;
  rank: number | null;
  rank24: number | null;
  rank25: number | null;
  children?: TableNode[];
  packCount?: number;
}

interface RawAccumulator {
  key: string;
  name: string;
  subtitle?: string;
  level: HierarchyLevel;
  dimKey?: DimensionKey;
  dictIdx?: number;
  atc1Idx: number;
  atc4Idx: number;
  nfc1Idx: number;
  prodIdx: number;
  packIdx: number;
  m: Float64Array; // 12 metrics (0..11)
  imp23: Float64Array; // 4 implied 2023 metrics (0..3)
  explicitGrowth24: (number | null)[]; // if single tuple
  tupleCount: number;
  packSet: Set<number>;
  childrenMap?: Map<string, RawAccumulator>;
}

function createRawAcc(
  key: string,
  name: string,
  level: HierarchyLevel,
  atc1Idx: number,
  atc4Idx: number,
  nfc1Idx: number,
  prodIdx: number,
  packIdx: number,
  dimKey?: DimensionKey,
  dictIdx?: number,
  subtitle?: string
): RawAccumulator {
  return {
    key,
    name,
    subtitle,
    level,
    dimKey,
    dictIdx,
    atc1Idx,
    atc4Idx,
    nfc1Idx,
    prodIdx,
    packIdx,
    m: new Float64Array(12),
    imp23: new Float64Array(4),
    explicitGrowth24: [null, null, null, null],
    tupleCount: 0,
    packSet: new Set<number>(),
  };
}

function addTupleToRawAcc(acc: RawAccumulator, t: CompactRowTuple) {
  for (let k = 0; k < 12; k++) {
    acc.m[k] += (t[7 + k] as number) || 0;
  }
  // Implied 2023 for 2024 source growth
  const v24s = [t[7], t[10], t[13], t[16]];
  const g24s = [t[19], t[20], t[21], t[22]];
  for (let k = 0; k < 4; k++) {
    const v = v24s[k];
    const g = g24s[k];
    if (v > 0 && g !== null && g > -1) {
      acc.imp23[k] += v / (1 + g);
    }
    if (acc.tupleCount === 0) {
      acc.explicitGrowth24[k] = g;
    }
  }
  acc.tupleCount++;
  if (t[6] >= 0) acc.packSet.add(t[6]);
}

function finalizeNodeFromAcc(
  acc: RawAccumulator,
  indexed: IndexedMarketData,
  period: PeriodType,
  measure: MeasureType,
  scopeTotals: Float64Array,
  grandTotals: Float64Array,
  parentTotals: Float64Array | null,
  depth: number
): TableNode {
  const { dicts } = indexed.dataset;
  const m = acc.m;

  // Offsets in `m` (0..11):
  // YTD Units: 0,1,2 | YTD Value: 3,4,5 | MAT Units: 6,7,8 | MAT Value: 9,10,11
  const uOffset = period === 'ytd' ? 0 : 6;
  const vOffset = period === 'ytd' ? 3 : 9;
  const activeOffset = measure === 'units' ? uOffset : vOffset;

  const v2024 = m[activeOffset];
  const v2025 = m[activeOffset + 1];
  const v2026 = m[activeOffset + 2];

  const units2024 = m[uOffset];
  const units2025 = m[uOffset + 1];
  const units2026 = m[uOffset + 2];

  const value2024 = m[vOffset];
  const value2025 = m[vOffset + 1];
  const value2026 = m[vOffset + 2];

  // 2024 source growth
  const g24Idx = (period === 'ytd' ? 0 : 2) + (measure === 'units' ? 0 : 1);
  let rawG24: number | null = null;
  if (acc.tupleCount === 1) {
    rawG24 = acc.explicitGrowth24[g24Idx];
  } else if (v2024 > 0 && acc.imp23[g24Idx] > 0) {
    rawG24 = v2024 / acc.imp23[g24Idx] - 1;
  }
  const growth24Source = normalizeSourceGrowth2024(rawG24, v2024);

  const growth25 = calcGrowth(v2025, v2024);
  const growth26 = calcGrowth(v2026, v2025);
  const cagr24_26 = calcCagr24To26(v2026, v2024);

  const valueGrowth26 = calcGrowth(value2026, value2025);
  const unitsGrowth26 = calcGrowth(units2026, units2025);
  const valueCagr24_26 = calcCagr24To26(value2026, value2024);
  const unitsCagr24_26 = calcCagr24To26(units2026, units2024);

  const absGrowth26 = calcAbsoluteGrowth(v2026, v2025);
  const scope24 = scopeTotals[activeOffset];
  const scope25 = scopeTotals[activeOffset + 1];
  const scope26 = scopeTotals[activeOffset + 2];

  const contribGrowthPp = calcContributionToGrowthPp(v2026, v2025, scope25);

  const share24 = calcMarketShare(v2024, scope24);
  const share25 = calcMarketShare(v2025, scope25);
  const share26 = calcMarketShare(v2026, scope26);

  const totalMarketShare25 = calcMarketShare(v2025, grandTotals[activeOffset + 1]);
  const totalMarketShare26 = calcMarketShare(v2026, grandTotals[activeOffset + 2]);
  const deltaTotalShare26_25Pp = calcDeltaSharePp(totalMarketShare26, totalMarketShare25);
  const parentShare26 = parentTotals
    ? calcMarketShare(v2026, parentTotals[activeOffset + 2])
    : share26;

  const deltaShare26_25Pp = calcDeltaSharePp(share26, share25);
  const deltaShare25_24Pp = calcDeltaSharePp(share25, share24);
  const relShareChange26_25 = calcRelativeShareChange(share26, share25);

  const scopeGrowth25 = calcGrowth(scope25, scope24);
  const scopeGrowth26 = calcGrowth(scope26, scope25);
  const evolutionIndex25 = calcEvolutionIndex(growth25.raw, scopeGrowth25.raw);
  const evolutionIndex26 = calcEvolutionIndex(growth26.raw, scopeGrowth26.raw);

  const avgPrice24 = calcAveragePrice(value2024, units2024);
  const avgPrice25 = calcAveragePrice(value2025, units2025);
  const avgPrice26 = calcAveragePrice(value2026, units2026);
  const priceMixGrowth26 = calcPriceMixGrowth(valueGrowth26.raw, unitsGrowth26.raw);

  // Momentum: YTD growth 26 minus MAT growth 26 for active measure
  const ytdActiveOffset = measure === 'units' ? 0 : 3;
  const matActiveOffset = measure === 'units' ? 6 : 9;
  const ytdG26 = calcGrowth(m[ytdActiveOffset + 2], m[ytdActiveOffset + 1]);
  const matG26 = calcGrowth(m[matActiveOffset + 2], m[matActiveOffset + 1]);
  const momentum26 = calcMomentum(ytdG26.raw, matG26.raw);

  const node: TableNode = {
    id: acc.key,
    name: acc.name,
    subtitle: acc.subtitle,
    level: acc.level,
    depth,
    dimKey: acc.dimKey,
    dictIdx: acc.dictIdx,
    atc1Idx: acc.atc1Idx,
    atc4Idx: acc.atc4Idx,
    nfc1Idx: acc.nfc1Idx,
    prodIdx: acc.prodIdx,
    packIdx: acc.packIdx,
    atc1Name: acc.atc1Idx >= 0 ? dicts.atc1[acc.atc1Idx] : '',
    atc4Name: acc.atc4Idx >= 0 ? dicts.atc4[acc.atc4Idx] : '',
    nfc1Name: acc.nfc1Idx >= 0 ? dicts.nfc1[acc.nfc1Idx] : '',
    productName: acc.prodIdx >= 0 ? dicts.product[acc.prodIdx] : '',
    packName: acc.packIdx >= 0 ? dicts.pack[acc.packIdx] : '',
    v2024,
    v2025,
    v2026,
    units2024,
    units2025,
    units2026,
    value2024,
    value2025,
    value2026,
    growth24Source,
    growth25,
    growth26,
    cagr24_26,
    valueGrowth26,
    unitsGrowth26,
    valueCagr24_26,
    unitsCagr24_26,
    absGrowth26,
    contribGrowthPp,
    share24,
    share25,
    share26,
    totalMarketShare25,
    totalMarketShare26,
    deltaTotalShare26_25Pp,
    parentShare26,
    deltaShare26_25Pp,
    deltaShare25_24Pp,
    relShareChange26_25,
    evolutionIndex25,
    evolutionIndex26,
    avgPrice24,
    avgPrice25,
    avgPrice26,
    priceMixGrowth26,
    momentum26,
    rank: null,
    rank24: null,
    rank25: null,
    packCount: acc.packSet.size > 0 ? acc.packSet.size : undefined,
  };

  if (acc.childrenMap && acc.childrenMap.size > 0) {
    const childAccs = Array.from(acc.childrenMap.values());
    const children = childAccs.map((cAcc) =>
      finalizeNodeFromAcc(
        cAcc,
        indexed,
        period,
        measure,
        scopeTotals,
        grandTotals,
        acc.m,
        depth + 1
      )
    );
    // Assign competition ranks among siblings
    const childRanks24 = computeScopeRanks(children.map((c) => c.v2024));
    const childRanks25 = computeScopeRanks(children.map((c) => c.v2025));
    const childRanks26 = computeScopeRanks(children.map((c) => c.v2026));
    for (let i = 0; i < children.length; i++) {
      children[i].rank24 = childRanks24[i];
      children[i].rank25 = childRanks25[i];
      children[i].rank = childRanks26[i];
    }
    children.sort((a, b) => b.v2026 - a.v2026);
    node.children = children;
  }

  return node;
}

export interface TableViewData {
  nodes: TableNode[];
  totalNode: TableNode;
  flaggedCappedCount: number;
  newCount: number;
}

/**
 * Builds the hierarchical or flat TableViewData for the Main Explorer Table.
 * Supports:
 * - 'tree_product_pack': Product > Pack expandable tree (default, focused on Products & Packs)
 * - 'tree_full': ATC1 > ATC4 > NFC1 > Product > Pack full 5-level expandable tree
 * - Flat modes: 'Product', 'Pack', 'NFC1', 'ATC4', 'ATC1'
 */
export function buildTableViewData(
  indexed: IndexedMarketData,
  filterState: FacetedFilterStateResult,
  period: PeriodType,
  measure: MeasureType,
  groupBy: GroupByMode
): TableViewData {
  const { dataset } = indexed;
  const { dicts } = dataset;

  // Grand totals from dataset.aggregates.grandTotal
  const gtTuple = dataset.aggregates.grandTotal;
  const grandTotals = new Float64Array(12);
  for (let k = 0; k < 12; k++) grandTotals[k] = (gtTuple[7 + k] as number) || 0;

  // Scope total accumulator built strictly from `filterState.scopeRows` (never mixing levels!)
  const scopeAcc = createRawAcc(
    'scope-total',
    'Filtered Market Total',
    'GrandTotal',
    -1,
    -1,
    -1,
    -1,
    -1
  );
  for (const r of filterState.scopeRows) {
    addTupleToRawAcc(scopeAcc, r);
  }

  const rootMap = new Map<string, RawAccumulator>();
  const packRowIndices = filterState.matchingPackRowIndices;
  const rows = dataset.rows;

  if (groupBy === 'tree_product_pack') {
    // 2-level tree: Product -> Pack
    for (let i = 0; i < packRowIndices.length; i++) {
      const t = rows[packRowIndices[i]];
      const prodIdx = t[5];
      const packIdx = t[6];
      const prodKey = `prod:${prodIdx}`;

      let prodAcc = rootMap.get(prodKey);
      if (!prodAcc) {
        prodAcc = createRawAcc(
          prodKey,
          dicts.product[prodIdx],
          'Product',
          t[2],
          t[3],
          t[4],
          prodIdx,
          -1,
          'product',
          prodIdx,
          `${dicts.atc4[t[3]]} • ${dicts.nfc1[t[4]]}`
        );
        prodAcc.childrenMap = new Map();
        rootMap.set(prodKey, prodAcc);
      }
      addTupleToRawAcc(prodAcc, t);

      const packKey = `prod:${prodIdx}:pack:${packIdx}:${t[3]}:${t[4]}`;
      let packAcc = prodAcc.childrenMap!.get(packKey);
      if (!packAcc) {
        packAcc = createRawAcc(
          packKey,
          dicts.pack[packIdx],
          'Pack',
          t[2],
          t[3],
          t[4],
          prodIdx,
          packIdx,
          'pack',
          packIdx,
          dicts.nfc1[t[4]]
        );
        prodAcc.childrenMap!.set(packKey, packAcc);
      }
      addTupleToRawAcc(packAcc, t);
    }
  } else if (groupBy === 'tree_full') {
    // 5-level tree: ATC1 -> ATC4 -> NFC1 -> Product -> Pack
    for (let i = 0; i < packRowIndices.length; i++) {
      const t = rows[packRowIndices[i]];
      const [atc1Idx, atc4Idx, nfc1Idx, prodIdx, packIdx] = [t[2], t[3], t[4], t[5], t[6]];

      const k1 = `atc1:${atc1Idx}`;
      let a1 = rootMap.get(k1);
      if (!a1) {
        a1 = createRawAcc(k1, dicts.atc1[atc1Idx], 'ATC1', atc1Idx, -1, -1, -1, -1, 'atc1', atc1Idx);
        a1.childrenMap = new Map();
        rootMap.set(k1, a1);
      }
      addTupleToRawAcc(a1, t);

      const k4 = `${k1}:atc4:${atc4Idx}`;
      let a4 = a1.childrenMap!.get(k4);
      if (!a4) {
        a4 = createRawAcc(k4, dicts.atc4[atc4Idx], 'ATC4', atc1Idx, atc4Idx, -1, -1, -1, 'atc4', atc4Idx);
        a4.childrenMap = new Map();
        a1.childrenMap!.set(k4, a4);
      }
      addTupleToRawAcc(a4, t);

      const kN = `${k4}:nfc1:${nfc1Idx}`;
      let aN = a4.childrenMap!.get(kN);
      if (!aN) {
        aN = createRawAcc(kN, dicts.nfc1[nfc1Idx], 'NFC1', atc1Idx, atc4Idx, nfc1Idx, -1, -1, 'nfc1', nfc1Idx);
        aN.childrenMap = new Map();
        a4.childrenMap!.set(kN, aN);
      }
      addTupleToRawAcc(aN, t);

      const kP = `${kN}:prod:${prodIdx}`;
      let aP = aN.childrenMap!.get(kP);
      if (!aP) {
        aP = createRawAcc(kP, dicts.product[prodIdx], 'Product', atc1Idx, atc4Idx, nfc1Idx, prodIdx, -1, 'product', prodIdx);
        aP.childrenMap = new Map();
        aN.childrenMap!.set(kP, aP);
      }
      addTupleToRawAcc(aP, t);

      const kPack = `${kP}:pack:${packIdx}`;
      let aPack = aP.childrenMap!.get(kPack);
      if (!aPack) {
        aPack = createRawAcc(kPack, dicts.pack[packIdx], 'Pack', atc1Idx, atc4Idx, nfc1Idx, prodIdx, packIdx, 'pack', packIdx);
        aP.childrenMap!.set(kPack, aPack);
      }
      addTupleToRawAcc(aPack, t);
    }
  } else {
    // Flat Group-By Mode: 'Product' | 'Pack' | 'NFC1' | 'ATC4' | 'ATC1'
    for (let i = 0; i < packRowIndices.length; i++) {
      const t = rows[packRowIndices[i]];
      const [atc1Idx, atc4Idx, nfc1Idx, prodIdx, packIdx] = [t[2], t[3], t[4], t[5], t[6]];

      let key: string;
      let name: string;
      let subtitle: string | undefined;
      let dimKey: DimensionKey;
      let dictIdx: number;

      if (groupBy === 'Pack') {
        key = `pack:${prodIdx}:${packIdx}:${atc4Idx}:${nfc1Idx}`;
        name = `${dicts.product[prodIdx]} — ${dicts.pack[packIdx]}`;
        subtitle = `${dicts.atc4[atc4Idx]} • ${dicts.nfc1[nfc1Idx]}`;
        dimKey = 'pack';
        dictIdx = packIdx;
      } else if (groupBy === 'Product') {
        key = `prod:${prodIdx}`;
        name = dicts.product[prodIdx];
        subtitle = `${dicts.atc4[atc4Idx]} • ${dicts.nfc1[nfc1Idx]}`;
        dimKey = 'product';
        dictIdx = prodIdx;
      } else if (groupBy === 'NFC1') {
        key = `nfc1:${nfc1Idx}`;
        name = dicts.nfc1[nfc1Idx];
        dimKey = 'nfc1';
        dictIdx = nfc1Idx;
      } else if (groupBy === 'ATC4') {
        key = `atc4:${atc4Idx}`;
        name = dicts.atc4[atc4Idx];
        subtitle = dicts.atc1[atc1Idx];
        dimKey = 'atc4';
        dictIdx = atc4Idx;
      } else {
        key = `atc1:${atc1Idx}`;
        name = dicts.atc1[atc1Idx];
        dimKey = 'atc1';
        dictIdx = atc1Idx;
      }

      let acc = rootMap.get(key);
      if (!acc) {
        acc = createRawAcc(
          key,
          name,
          groupBy,
          atc1Idx,
          atc4Idx,
          nfc1Idx,
          prodIdx,
          packIdx,
          dimKey,
          dictIdx,
          subtitle
        );
        rootMap.set(key, acc);
      }
      addTupleToRawAcc(acc, t);
    }
  }

  const totalNode = finalizeNodeFromAcc(
    scopeAcc,
    indexed,
    period,
    measure,
    scopeAcc.m,
    grandTotals,
    null,
    0
  );

  const nodes = Array.from(rootMap.values()).map((acc) =>
    finalizeNodeFromAcc(acc, indexed, period, measure, scopeAcc.m, grandTotals, scopeAcc.m, 0)
  );

  // Assign top-level competition ranks for 2024, 2025, and 2026
  const topRanks24 = computeScopeRanks(nodes.map((n) => n.v2024));
  const topRanks25 = computeScopeRanks(nodes.map((n) => n.v2025));
  const topRanks26 = computeScopeRanks(nodes.map((n) => n.v2026));
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].rank24 = topRanks24[i];
    nodes[i].rank25 = topRanks25[i];
    nodes[i].rank = topRanks26[i];
  }
  nodes.sort((a, b) => b.v2026 - a.v2026);

  // Count flagged (>+999% capped) and "New" rows in current view
  let flaggedCappedCount = 0;
  let newCount = 0;
  const countFlags = (list: TableNode[]) => {
    for (const n of list) {
      if (
        n.growth26.isCapped ||
        n.growth25.isCapped ||
        n.growth24Source.isCapped ||
        n.cagr24_26.isCapped
      ) {
        flaggedCappedCount++;
      }
      if (n.growth26.isNew) {
        newCount++;
      }
      if (n.children) countFlags(n.children);
    }
  };
  countFlags(nodes);

  return {
    nodes,
    totalNode,
    flaggedCappedCount,
    newCount,
  };
}
