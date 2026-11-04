import * as fs from 'node:fs';
import * as path from 'node:path';
import XLSX from 'xlsx';
import type { CompactRowTuple, MarketDatasetJSON } from '../src/types/market';

const WORKBOOK_PATH = path.resolve(process.cwd(), 'IQVIA_Brands_MAT_8-2026_Ungrouped.xlsx');
const SHEET_NAME = 'Egypt Combined Data';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'market-data.json');

function round2(val: unknown): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n === 0) return 0;
  return Math.round(n * 100) / 100;
}

function roundGrowth(val: unknown, salesVal: number): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  if (salesVal <= 0 && n === -1) return null;
  return Math.round(n * 1_000_000) / 1_000_000;
}

function implied2023(val2024: number, growth2024: number | null): number {
  if (val2024 <= 0 || growth2024 === null || growth2024 <= -1) return 0;
  return val2024 / (1 + growth2024);
}

function deriveAggGrowth2024(sum2024: number, sumImplied2023: number): number | null {
  if (sum2024 <= 0 || sumImplied2023 <= 0) return null;
  return Math.round((sum2024 / sumImplied2023 - 1) * 1_000_000) / 1_000_000;
}

interface AggAccumulator {
  atc1Idx: number;
  atc4Idx: number;
  nfc1Idx: number;
  prodIdx: number;
  metrics: number[]; // 12 metrics (indices 0..11 matching tuple 7..18)
  implied23: [number, number, number, number]; // ytdU23, ytdV23, matU23, matV23
}

function createAccumulator(
  atc1Idx: number,
  atc4Idx: number,
  nfc1Idx = -1,
  prodIdx = -1
): AggAccumulator {
  return {
    atc1Idx,
    atc4Idx,
    nfc1Idx,
    prodIdx,
    metrics: new Array(12).fill(0),
    implied23: [0, 0, 0, 0],
  };
}

function addMetricsToAccumulator(
  acc: AggAccumulator,
  m: number[],
  imp23: [number, number, number, number]
) {
  for (let k = 0; k < 12; k++) acc.metrics[k] += m[k];
  for (let k = 0; k < 4; k++) acc.implied23[k] += imp23[k];
}

function main() {
  console.log(`Reading workbook: ${WORKBOOK_PATH}`);
  const wb = XLSX.readFile(WORKBOOK_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in workbook.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  });

  // Filter out header and trailing completely-blank rows
  const dataRows = rawRows
    .slice(1)
    .filter((r) => r && (r[0] !== null || r[1] !== null || r[2] !== null || r[3] !== null || r[4] !== null));

  console.log(`Non-empty rows in sheet: ${dataRows.length}`);

  // Dictionary encoding
  const atc1Dict: string[] = [];
  const atc4Dict: string[] = [];
  const nfc1Dict: string[] = [];
  const productDict: string[] = [];
  const packDict: string[] = [];

  const atc1Map = new Map<string, number>();
  const atc4Map = new Map<string, number>();
  const nfc1Map = new Map<string, number>();
  const productMap = new Map<string, number>();
  const packMap = new Map<string, number>();

  const getDictIdx = (val: unknown, map: Map<string, number>, dict: string[]): number => {
    if (val === null || val === undefined || String(val).trim() === '') return -1;
    const s = String(val).trim();
    let idx = map.get(s);
    if (idx === undefined) {
      idx = dict.length;
      dict.push(s);
      map.set(s, idx);
    }
    return idx;
  };

  // Check if workbook has all 28,410 rows (NFC1 + Product + Pack) or only the 16,492 leaf Pack rows
  const hasSubtotalRows = dataRows.some((r) => !r[3] || !r[4]);

  const packTuples: CompactRowTuple[] = [];
  const existingNfc1Tuples: CompactRowTuple[] = [];
  const existingProdTuples: CompactRowTuple[] = [];

  const nfc1AggMap = new Map<string, AggAccumulator>();
  const prodAggMap = new Map<string, AggAccumulator>();
  const atc4AggMap = new Map<string, AggAccumulator>();
  const atc1AggMap = new Map<number, AggAccumulator>();
  const grandTotalAcc = createAccumulator(-1, -1);

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const atc1Idx = getDictIdx(r[0], atc1Map, atc1Dict);
    const atc4Idx = getDictIdx(r[1], atc4Map, atc4Dict);
    const nfc1Idx = getDictIdx(r[2], nfc1Map, nfc1Dict);
    const prodIdx = getDictIdx(r[3], productMap, productDict);
    const packIdx = getDictIdx(r[4], packMap, packDict);

    let levelCode: number;
    if (prodIdx === -1 && packIdx === -1) {
      levelCode = 0; // NFC1
    } else if (prodIdx !== -1 && packIdx === -1) {
      levelCode = 1; // Product
    } else if (prodIdx !== -1 && packIdx !== -1) {
      levelCode = 2; // Pack
    } else {
      throw new Error(`Invalid hierarchy row at index ${i}: Product blank but Pack present`);
    }

    const ytd24U = round2(r[6]);
    const ytd25U = round2(r[14]);
    const ytd26U = round2(r[22]);
    const ytd24V = round2(r[10]);
    const ytd25V = round2(r[18]);
    const ytd26V = round2(r[26]);

    const mat24U = round2(r[30]);
    const mat25U = round2(r[38]);
    const mat26U = round2(r[46]);
    const mat24V = round2(r[34]);
    const mat25V = round2(r[42]);
    const mat26V = round2(r[50]);

    const ytd24UGSrc = roundGrowth(r[7], ytd24U);
    const ytd24VGSrc = roundGrowth(r[11], ytd24V);
    const mat24UGSrc = roundGrowth(r[31], mat24U);
    const mat24VGSrc = roundGrowth(r[35], mat24V);

    const tuple: CompactRowTuple = [
      0, // id assigned below
      levelCode,
      atc1Idx,
      atc4Idx,
      nfc1Idx,
      prodIdx,
      packIdx,
      ytd24U,
      ytd25U,
      ytd26U,
      ytd24V,
      ytd25V,
      ytd26V,
      mat24U,
      mat25U,
      mat26U,
      mat24V,
      mat25V,
      mat26V,
      ytd24UGSrc,
      ytd24VGSrc,
      mat24UGSrc,
      mat24VGSrc,
    ];

    if (levelCode === 0) {
      existingNfc1Tuples.push(tuple);
    } else if (levelCode === 1) {
      existingProdTuples.push(tuple);
    } else {
      packTuples.push(tuple);
    }

    // Use Pack rows (if workbook is Pack-only) or NFC1 rows (if workbook has subtotals) to build rollups
    const isBaseForHigherAgg = hasSubtotalRows ? levelCode === 0 : levelCode === 2;
    const m = [
      ytd24U,
      ytd25U,
      ytd26U,
      ytd24V,
      ytd25V,
      ytd26V,
      mat24U,
      mat25U,
      mat26U,
      mat24V,
      mat25V,
      mat26V,
    ];
    const imp23: [number, number, number, number] = [
      implied2023(ytd24U, ytd24UGSrc),
      implied2023(ytd24V, ytd24VGSrc),
      implied2023(mat24U, mat24UGSrc),
      implied2023(mat24V, mat24VGSrc),
    ];

    if (!hasSubtotalRows && levelCode === 2) {
      // Synthesize NFC1 and Product subtotal rows from Pack rows
      const nfc1Key = `${atc1Idx}:${atc4Idx}:${nfc1Idx}`;
      let accNfc1 = nfc1AggMap.get(nfc1Key);
      if (!accNfc1) {
        accNfc1 = createAccumulator(atc1Idx, atc4Idx, nfc1Idx, -1);
        nfc1AggMap.set(nfc1Key, accNfc1);
      }
      addMetricsToAccumulator(accNfc1, m, imp23);

      const prodKey = `${atc1Idx}:${atc4Idx}:${nfc1Idx}:${prodIdx}`;
      let accProd = prodAggMap.get(prodKey);
      if (!accProd) {
        accProd = createAccumulator(atc1Idx, atc4Idx, nfc1Idx, prodIdx);
        prodAggMap.set(prodKey, accProd);
      }
      addMetricsToAccumulator(accProd, m, imp23);
    }

    if (isBaseForHigherAgg) {
      const atc4Key = `${atc1Idx}:${atc4Idx}`;
      let acc4 = atc4AggMap.get(atc4Key);
      if (!acc4) {
        acc4 = createAccumulator(atc1Idx, atc4Idx);
        atc4AggMap.set(atc4Key, acc4);
      }
      addMetricsToAccumulator(acc4, m, imp23);

      let acc1 = atc1AggMap.get(atc1Idx);
      if (!acc1) {
        acc1 = createAccumulator(atc1Idx, -1);
        atc1AggMap.set(atc1Idx, acc1);
      }
      addMetricsToAccumulator(acc1, m, imp23);

      addMetricsToAccumulator(grandTotalAcc, m, imp23);
    }
  }

  let nextId = 0;
  const toTupleFromAcc = (acc: AggAccumulator, levelCode: number): CompactRowTuple => {
    const m = acc.metrics.map(round2);
    return [
      nextId++,
      levelCode,
      acc.atc1Idx,
      acc.atc4Idx,
      acc.nfc1Idx,
      acc.prodIdx,
      -1,
      m[0],
      m[1],
      m[2],
      m[3],
      m[4],
      m[5],
      m[6],
      m[7],
      m[8],
      m[9],
      m[10],
      m[11],
      deriveAggGrowth2024(m[0], acc.implied23[0]),
      deriveAggGrowth2024(m[3], acc.implied23[1]),
      deriveAggGrowth2024(m[6], acc.implied23[2]),
      deriveAggGrowth2024(m[9], acc.implied23[3]),
    ];
  };

  const finalNfc1Tuples = hasSubtotalRows
    ? existingNfc1Tuples.map((t) => {
        t[0] = nextId++;
        return t;
      })
    : Array.from(nfc1AggMap.values()).map((acc) => toTupleFromAcc(acc, 0));

  const finalProdTuples = hasSubtotalRows
    ? existingProdTuples.map((t) => {
        t[0] = nextId++;
        return t;
      })
    : Array.from(prodAggMap.values()).map((acc) => toTupleFromAcc(acc, 1));

  const finalPackTuples = packTuples.map((t) => {
    t[0] = nextId++;
    return t;
  });

  const rows: CompactRowTuple[] = [
    ...finalNfc1Tuples,
    ...finalProdTuples,
    ...finalPackTuples,
  ];

  // Count extreme growths (> +1000% = 10.0) across the 28,410 rows
  let mat26ValOver1000 = 0;
  let mat26UnitsOver1000 = 0;
  let ytd26ValOver1000 = 0;
  let ytd26UnitsOver1000 = 0;
  let allGrowthOver1000 = 0;

  for (const t of rows) {
    // Recomputed growth 25 and 26 + 2024 source growth
    const gMat26V = t[17] > 0 ? t[18] / t[17] - 1 : null;
    const gMat26U = t[14] > 0 ? t[15] / t[14] - 1 : null;
    const gYtd26V = t[11] > 0 ? t[12] / t[11] - 1 : null;
    const gYtd26U = t[8] > 0 ? t[9] / t[8] - 1 : null;

    const gMat25V = t[16] > 0 ? t[17] / t[16] - 1 : null;
    const gMat25U = t[13] > 0 ? t[14] / t[13] - 1 : null;
    const gYtd25V = t[10] > 0 ? t[11] / t[10] - 1 : null;
    const gYtd25U = t[7] > 0 ? t[8] / t[7] - 1 : null;

    if (gMat26V !== null && gMat26V > 10) mat26ValOver1000++;
    if (gMat26U !== null && gMat26U > 10) mat26UnitsOver1000++;
    if (gYtd26V !== null && gYtd26V > 10) ytd26ValOver1000++;
    if (gYtd26U !== null && gYtd26U > 10) ytd26UnitsOver1000++;

    for (const gv of [
      t[19],
      t[20],
      t[21],
      t[22],
      gYtd25U,
      gYtd25V,
      gYtd26U,
      gYtd26V,
      gMat25U,
      gMat25V,
      gMat26U,
      gMat26V,
    ]) {
      if (gv !== null && gv > 10) allGrowthOver1000++;
    }
  }

  const atc4Tuples = Array.from(atc4AggMap.values()).map((acc) => toTupleFromAcc(acc, 3));
  const atc1Tuples = Array.from(atc1AggMap.values()).map((acc) => toTupleFromAcc(acc, 4));
  const grandTotalTuple = toTupleFromAcc(grandTotalAcc, 5);

  const dataset: MarketDatasetJSON = {
    meta: {
      generatedAt: new Date().toISOString(),
      currency: 'EGP',
      sourceSheet: SHEET_NAME,
      sourceRowCount: rows.length,
      levelCounts: {
        GrandTotal: 1,
        ATC1: atc1Tuples.length,
        ATC4: atc4Tuples.length,
        NFC1: finalNfc1Tuples.length,
        Product: finalProdTuples.length,
        Pack: finalPackTuples.length,
      },
      uniqueCounts: {
        atc1: atc1Dict.length,
        atc4: atc4Dict.length,
        nfc1: nfc1Dict.length,
        product: productDict.length,
        pack: packDict.length,
      },
      flaggedSourceGrowthOver1000: {
        mat_2026_value: mat26ValOver1000,
        mat_2026_units: mat26UnitsOver1000,
        ytd_2026_value: ytd26ValOver1000,
        ytd_2026_units: ytd26UnitsOver1000,
        allGrowthColumnsTotal: allGrowthOver1000,
      },
      grandTotals: {
        ytd_2024_units: grandTotalTuple[7],
        ytd_2025_units: grandTotalTuple[8],
        ytd_2026_units: grandTotalTuple[9],
        ytd_2024_value: grandTotalTuple[10],
        ytd_2025_value: grandTotalTuple[11],
        ytd_2026_value: grandTotalTuple[12],
        mat_2024_units: grandTotalTuple[13],
        mat_2025_units: grandTotalTuple[14],
        mat_2026_units: grandTotalTuple[15],
        mat_2024_value: grandTotalTuple[16],
        mat_2025_value: grandTotalTuple[17],
        mat_2026_value: grandTotalTuple[18],
      },
    },
    dicts: {
      atc1: atc1Dict,
      atc4: atc4Dict,
      nfc1: nfc1Dict,
      product: productDict,
      pack: packDict,
    },
    rows,
    aggregates: {
      atc4: atc4Tuples,
      atc1: atc1Tuples,
      grandTotal: grandTotalTuple,
    },
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset));

  const sizeMb = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${OUTPUT_FILE} (${sizeMb} MB)`);
  console.log('Meta summary:', JSON.stringify(dataset.meta, null, 2));
}

main();
