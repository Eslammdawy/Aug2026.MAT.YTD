import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MarketDatasetJSON } from '../types/market';
import { buildTableViewData } from './aggregationEngine';
import {
  buildIndexedMarketData,
  computeFacetedFilterState,
  type FilterSelections,
  type IndexedMarketData,
  sanitizeAndPruneSelections,
} from './filterEngine';

const EMPTY_SELECTIONS: FilterSelections = {
  atc1: [],
  atc4: [],
  nfc1: [],
  product: [],
  pack: [],
};

describe('IQVIA Egypt Market Dataset & Interlinked Filter Engine Verification', () => {
  let dataset: MarketDatasetJSON;
  let indexed: IndexedMarketData;

  beforeAll(() => {
    const jsonPath = path.resolve(process.cwd(), 'public', 'data', 'market-data.json');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    dataset = JSON.parse(raw) as MarketDatasetJSON;
    indexed = buildIndexedMarketData(dataset);
  });

  it('verifies exact row counts per hierarchy level and unique dimension counts', () => {
    expect(dataset.rows.length).toBe(28410);
    expect(dataset.meta.levelCounts.NFC1).toBe(851);
    expect(dataset.meta.levelCounts.Product).toBe(11067);
    expect(dataset.meta.levelCounts.Pack).toBe(16492);
    expect(dataset.meta.levelCounts.ATC4).toBe(507);
    expect(dataset.meta.levelCounts.ATC1).toBe(16);

    expect(dataset.dicts.atc1.length).toBe(16);
    expect(dataset.dicts.atc4.length).toBe(507);
    expect(dataset.dicts.nfc1.length).toBe(16);
    expect(dataset.dicts.product.length).toBe(10161);
    expect(dataset.dicts.pack.length).toBe(8823);

    expect(dataset.meta.flaggedSourceGrowthOver1000.mat_2026_value).toBe(1079);
  });

  it('verifies Product rows sum to NFC1 rows and Grand Totals match EGP 320.5bn / 275.6bn (+16.3%)', () => {
    const nfc1Mat26 = indexed.nfc1RowIndices.reduce((s, idx) => s + dataset.rows[idx][18], 0);
    const prodMat26 = indexed.productRowIndices.reduce((s, idx) => s + dataset.rows[idx][18], 0);
    const packMat26 = indexed.packRowIndices.reduce((s, idx) => s + dataset.rows[idx][18], 0);

    // Never sum across levels; each level independently totals ~ EGP 320.54bn
    expect(nfc1Mat26 / 1e9).toBeCloseTo(320.544, 2);
    expect(prodMat26 / 1e9).toBeCloseTo(320.544, 2);
    expect(packMat26 / 1e9).toBeCloseTo(320.544, 2);

    const nfc1Mat25 = indexed.nfc1RowIndices.reduce((s, idx) => s + dataset.rows[idx][17], 0);
    expect(nfc1Mat25 / 1e9).toBeCloseTo(275.65, 2);

    const matGrowth26 = nfc1Mat26 / nfc1Mat25 - 1;
    expect(matGrowth26 * 100).toBeCloseTo(16.29, 1);
  });

  it('toggling MAT | YTD changes only the metric column values while preserving identical rows and hierarchy', () => {
    const state = computeFacetedFilterState(indexed, EMPTY_SELECTIONS, 'mat', 'value');
    const matTable = buildTableViewData(indexed, state, 'mat', 'value', 'tree_product_pack');
    const ytdTable = buildTableViewData(indexed, state, 'ytd', 'value', 'tree_product_pack');

    expect(matTable.nodes.length).toBe(ytdTable.nodes.length);
    expect(matTable.nodes.length).toBe(10161); // 10,161 unique Products at root of Product > Pack tree
    expect(matTable.totalNode.v2026).not.toBe(ytdTable.totalNode.v2026);
  });

  it('supports bidirectional interlinked filtering (bottom-up Pack -> Parents and top-down ATC4 -> Children)', () => {
    // 1. Bottom-up: select Pack "GASTROR.TABS 40MG 14"
    const packIdx = dataset.dicts.pack.indexOf('GASTROR.TABS 40MG 14');
    expect(packIdx).toBeGreaterThanOrEqual(0);

    const packFilterState = computeFacetedFilterState(indexed, {
      ...EMPTY_SELECTIONS,
      pack: [packIdx],
    });

    // ATC1, ATC4, NFC1, and Product available options shrink strictly to rows containing that pack
    expect(packFilterState.availableSetByDim.atc1.size).toBeGreaterThan(0);
    expect(packFilterState.availableSetByDim.atc1.size).toBeLessThan(dataset.dicts.atc1.length);
    expect(packFilterState.availableSetByDim.product.size).toBeGreaterThan(0);
    expect(packFilterState.availableSetByDim.product.size).toBeLessThan(50);

    // 2. Top-down: select ATC4 "A02B2 PROTON PUMP INHIBITORS"
    const atc4Idx = dataset.dicts.atc4.indexOf('A02B2 PROTON PUMP INHIBITORS');
    expect(atc4Idx).toBeGreaterThanOrEqual(0);

    const atc4FilterState = computeFacetedFilterState(indexed, {
      ...EMPTY_SELECTIONS,
      atc4: [atc4Idx],
    });

    expect(atc4FilterState.availableSetByDim.atc1.size).toBe(1);
    expect(atc4FilterState.availableSetByDim.nfc1.size).toBeLessThan(dataset.dicts.nfc1.length);
    expect(atc4FilterState.availableSetByDim.product.size).toBeGreaterThan(10);
    expect(atc4FilterState.availableSetByDim.product.size).toBeLessThan(300);
    // ATC4's own option list still has all 507 options available because no OTHER filter is active!
    expect(atc4FilterState.availableSetByDim.atc4.size).toBe(507);
  });

  it('combines multi-select with OR within a filter and AND across filters, and auto-prunes invalid selections', () => {
    const ppiIdx = dataset.dicts.atc4.indexOf('A02B2 PROTON PUMP INHIBITORS');
    const zurcalIdx = dataset.dicts.product.indexOf('ZURCAL');
    expect(ppiIdx).toBeGreaterThanOrEqual(0);
    expect(zurcalIdx).toBeGreaterThanOrEqual(0);

    // Find another ATC1 that does NOT contain ZURCAL
    const zurcalState = computeFacetedFilterState(indexed, {
      ...EMPTY_SELECTIONS,
      product: [zurcalIdx],
    });
    const nonMatchingAtc1 = dataset.dicts.atc1.findIndex(
      (_, idx) => !zurcalState.availableSetByDim.atc1.has(idx)
    );
    expect(nonMatchingAtc1).toBeGreaterThanOrEqual(0);

    // If user switches ATC1 to `nonMatchingAtc1`, `ZURCAL` becomes invalid and is auto-pruned
    const pruned = sanitizeAndPruneSelections(
      indexed,
      {
        ...EMPTY_SELECTIONS,
        atc1: [nonMatchingAtc1],
        product: [zurcalIdx],
      },
      'atc1'
    );

    expect(pruned.selections.product).toEqual([]);
    expect(pruned.removedCount).toBe(1);
  });

  it('never mixes hierarchy levels when computing scope totals', () => {
    const ppiIdx = dataset.dicts.atc4.indexOf('A02B2 PROTON PUMP INHIBITORS');
    const stateAtc4 = computeFacetedFilterState(indexed, {
      ...EMPTY_SELECTIONS,
      atc4: [ppiIdx],
    });
    expect(stateAtc4.scopeAggregationLevel).toBe('NFC1');

    const zurcalIdx = dataset.dicts.product.indexOf('ZURCAL');
    const stateProd = computeFacetedFilterState(indexed, {
      ...EMPTY_SELECTIONS,
      product: [zurcalIdx],
    });
    expect(stateProd.scopeAggregationLevel).toBe('Product');

    const packIdx = dataset.dicts.pack.indexOf('GASTROR.TABS 40MG 14');
    const statePack = computeFacetedFilterState(indexed, {
      ...EMPTY_SELECTIONS,
      pack: [packIdx],
    });
    expect(statePack.scopeAggregationLevel).toBe('Pack');
  });
});
