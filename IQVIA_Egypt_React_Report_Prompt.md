# Agent Prompt: IQVIA Egypt Pharma Market Report (React)

## ROLE
You are a senior React/TypeScript engineer and pharma-market analyst. Build a single-page analytics report in React for the IQVIA Egypt pharma market, using the attached workbook `IQVIA_Brands_MAT_8-2026_Ungrouped.xlsx` (sheet "Egypt Combined Data").

## STACK
React 18 + Vite + TypeScript, Tailwind, TanStack Table + TanStack Virtual, Recharts (or ECharts), Zustand for filter state. Do NOT parse the xlsx in the browser. Write a Node/Python preprocessing script that converts the workbook to a compact JSON (columnar or array-of-arrays) in `/public/data`, and have the app load that.

## 1. DATA MODEL (verified - follow exactly)
- 28,410 rows. Dimensions: ATC1, ATC4, NFC1, Product, Pack.
- Metric columns are named `<PERIOD> Aug <YEAR>\n<MEASURE> <METRIC>` (the header contains a newline). PERIOD = YTD | MAT. YEAR = 2024, 2025, 2026. MEASURE = Units | LC Value (local-currency value, EGP). METRIC = Ranked | (value) | Growth % PY | Market Share. Normalise to tidy keys, e.g. `mat_2026_value`, `ytd_2025_units`.
- **Hierarchy is encoded by blanks.** Add a `level` field in preprocessing:
  - Product blank -> level `NFC1` (ATC4 x NFC1 subtotal, 851 rows)
  - Product set, Pack blank -> level `Product` (11,067 rows)
  - Pack set -> level `Pack` (16,492 rows)
- There are NO ATC1 / ATC4 / grand-total rows. Build them in preprocessing by summing the NFC1-level rows (Product rows sum exactly to their NFC1 row). NEVER sum across levels - that triple-counts. Sanity check to assert in tests: grand total MAT Aug 2026 LC Value ~ EGP 320.5bn, MAT Aug 2025 ~ 275.6bn (+16.3%).
- Source "Market Share" is relative to the PARENT row (NFC1 share within ATC4, Product share within its ATC4 x NFC1, Pack share within its Product). Do not display it as-is when filters are active. Recompute share = row value / total of the CURRENT FILTER SCOPE (the "market" = the set of rows matching all active filters; whole market if none). Also expose "share of total market" as a secondary column.
- "Growth % PY" in source = X_t / X_{t-1} - 1 (verified). For 2024 columns it is vs 2023, which is not in the file. Recompute growth from values; use source growth only for the 2024 column, labelled "vs 2023 (source)".
- Data quality rules: blank/null = no sales (treat as 0 for sums, null for ratios). Rank -1 = no data -> null. If prior-period value is 0/null and current > 0, growth = "New" (not Infinity). Cap displayed growth at +999% and flag it (1,079 source values exceed +1000%). Winsorise only for chart colour scales, never for totals. Show a footnote with how many rows were flagged.

## 2. CALCULATIONS
Implement as pure, unit-tested functions in `/src/lib/metrics.ts`. For each row/aggregate, for BOTH Units and LC Value, for BOTH MAT and YTD:
- Growth 25 = v2025/v2024 - 1; Growth 26 = v2026/v2025 - 1.
- CAGR 24-26 = (v2026/v2024)^(1/2) - 1. Null if v2024 <= 0 or v2026 < 0. Always label "2-yr CAGR, Aug-24 to Aug-26".
- Absolute growth = v2026 - v2025 (value and units).
- Contribution to growth (pp) = row absolute growth / scope total of v2025 x 100.
- Market share (scope-based) for 2024, 2025, 2026.
- Share change: delta-share (pp) = share26 - share25 and share25 - share24; relative share change = share26/share25 - 1.
- Evolution Index = (1 + row growth) / (1 + scope market growth) x 100. >100 = outgrowing the market.
- Average price = value / units; price/mix growth = (1 + value growth) / (1 + units growth) - 1. Volume effect = units growth. Egyptian value growth is heavily price/devaluation-driven, so always show units growth next to value growth.
- Rank within the current scope (recomputed, not the source rank).
- Momentum: YTD growth minus MAT growth (positive = accelerating).

## 3. MAIN TABLE (core feature)
- ONE table. A segmented toggle **MAT | YTD** switches which column set is shown in the SAME table (same rows, same filters, same sort; the sort key follows the toggle). Add a second toggle **LC Value | Units**. Persist both in the URL query string.
- Columns: Name | 2024 | 2025 | 2026 | Growth 25 | Growth 26 | CAGR 24-26 | Share 24 | Share 25 | Share 26 | Delta-share pp (26 vs 25) | Evolution Index | Rank. The column group header shows "MAT Aug" or "YTD Aug". Values in EGP mn/bn with 1 decimal, growth with 1 decimal %, share with 2 decimals; green/red for +/-; optional 3-point sparkline.
- Tree/drill-down: rows grouped by ATC1 > ATC4 > NFC1 > Product > Pack, expandable. A "Group by" selector can also set the flat level. Sticky header, sticky first column, virtualized rows (10k+ products).
- Sorting on every column, text search, CSV export of the current view, totals row.

## 4. FILTERS (interlinked + multi-select)
Filters: **ATC1, ATC4, NFC1, Product, Pack** (in this display order).

**Multi-select**
- Every filter allows selecting MULTIPLE values (checkbox list), with Select all / Clear, a search box, and a count badge ("3 selected"). Within one filter, values combine with OR; across filters, with AND.
- Product (10,161 unique) and Pack (8,823 unique) need a virtualized, search-as-you-type list.

**Interlinked (faceted / cross-filtering, works in ANY direction)**
- The filters are linked to each other in both directions, not only top-down. The options available in each filter are computed from the rows that match the selections in ALL OTHER filters (the filter's own selection is excluded from its own option list, so users can still add values).
  - Example: select Pack "GASTROR.TABS 40MG 14" first -> ATC1/ATC4/NFC1/Product lists shrink to only the values that contain that pack. Select ATC4 "A02B2 PROTON PUMP INHIBITORS" -> Product and Pack lists shrink to that ATC4; NFC1 shows only forms existing in it.
  - Selecting a child can auto-narrow parents (e.g. choosing a Product shows its ATC1/ATC4/NFC1 as the only available options in those filters, and highlights them).
- Options with no matching rows are hidden (or greyed out and disabled, user setting), and each option shows a live row count or EGP value next to it.
- If a selection in one filter becomes invalid because another filter changed, drop that value automatically and show a small notice ("2 selections removed").
- Implementation: precompute dictionary-encoded integer columns per dimension plus bitsets/Sets of row indexes per value; compute the intersection of the other filters once per change and derive each filter's available values from it. Target < 100 ms per change on 28k rows; use `useMemo` / selectors and debounce search.
- Filters drive everything: KPI cards, charts, table and insights. Show active filters as removable chips grouped by dimension, plus a "Reset all" button. The market definition for share = rows matching the current filters. Keep filter state in the URL so views are shareable.
- Hierarchy-level caution: when ATC1/ATC4/NFC1 selections are active and Product/Pack are not, aggregate at NFC1-level rows (do not double count with Product/Pack rows). When Product or Pack is selected, use Product- or Pack-level rows respectively and never mix levels in one total.

## 5. ANALYSES / VIEWS TO PRESENT (report sections)
- **A. Executive summary:** KPI cards for total market value, units, growth, 2-yr CAGR, price/mix effect, number of products, top-5 concentration; for MAT and YTD. Auto-generated plain-language insights (e.g. "N0 Nervous System grew 21% in value but only 4% in units - mostly price/mix").
- **B. Market structure:** ATC1 bar chart (size) with growth overlay; treemap of ATC1 > ATC4 by value.
- **C. Growth decomposition:** volume vs price/mix stacked bars per ATC1/ATC4; waterfall of market growth by top contributors (pp).
- **D. Growth-share bubble matrix:** x = share (or size), y = growth 26, bubble = value, colour = Evolution Index. Quadrants: Stars, Cash cows, Rising, Declining.
- **E. Share shift:** bump/slope chart of share 24 > 25 > 26 and a ranked table of share gainers/losers (pp) for the chosen scope (ATC4, NFC1, Product).
- **F. Top / bottom movers:** top 15 growers and decliners by absolute value change, with a minimum-size threshold slider to exclude tiny bases.
- **G. CAGR vs latest growth:** scatter (momentum): above the diagonal = accelerating, below = decelerating. Include YTD-vs-MAT momentum bars.
- **H. Concentration:** top-5/top-10 share and HHI per ATC4; Pareto (80/20) curve of products.
- **I. Portfolio form & pack analysis:** NFC1 mix, pack-size/price-tier mix, average price trend, pack extensions vs product total.
- **J. New & discontinued:** products with 0 in 2025 and >0 in 2026 (launches) and the reverse.

## 6. DESIGN & UX
Clean professional BI look, dark/light, responsive, consistent colour for +/-, tooltips with exact values, empty/loading/error states, no layout shift when toggling MAT/YTD. Memoize derived data; aggregate in a Web Worker if the filtered set is slow. Target < 200 ms interaction on the full dataset.

## 7. DELIVERABLES & ACCEPTANCE
- Project structure, preprocessing script, `metrics.ts` with unit tests (growth, CAGR, share, EI, New/null handling), and a README with run instructions.
- Tests/assertions:
  - Row counts per level; product sums = NFC1; grand totals as above.
  - Toggling MAT/YTD changes only the column set.
  - Filters are interlinked: selecting a value in any filter narrows the options of all others; multi-select uses OR within a filter and AND across filters; invalid selections are dropped automatically.
  - No double counting when mixing hierarchy levels.
- List any assumption you make (e.g. LC = EGP) instead of silently guessing.
