# Engineering Work Log — IQVIA Egypt Pharma Market Intelligence Report

**Project**: `iqvia-egypt-pharma-report`  
**Source Workbook**: `IQVIA_Brands_MAT_8-2026_Ungrouped.xlsx` (Sheet: `"Egypt Combined Data"`, 28,410 rows)  
**Target Stack**: React 18 + Vite 5 + TypeScript 5.6 + Tailwind CSS + TanStack Table v8 + TanStack Virtual v3 + Apache ECharts 5 + Zustand 5 + Vitest  

---

## Chronological Log of Completed Work

### Phase 1 — Source Data Audit & Offline Preprocessing Pipeline (`scripts/preprocess.ts`)
- **Action**: Inspected the raw Excel workbook (`IQVIA_Brands_MAT_8-2026_Ungrouped.xlsx`) and built an offline TypeScript preprocessor (`npm run preprocess`) that outputs `/public/data/market-data.json` (~3.8 MB).
- **Hierarchy Classification**:
  - Identified and tagged each row by blank-encoded hierarchy level:
    - `NFC1` (`Product` blank, `Pack` blank): **851 rows**
    - `Product` (`Product` set, `Pack` blank): **11,067 rows** (`10,161` unique products)
    - `Pack` (`Product` set, `Pack` set): **16,492 rows** (`8,823` unique packs)
- **Pre-Aggregated Rollups & Verification**:
  - Constructed `ATC4` (**507 rows**), `ATC1` (**16 rows**), and `GrandTotal` (**1 row**) strictly by summing the `851` `NFC1`-level rows to prevent double- or triple-counting across levels.
  - Verified that `Product` rows sum to `NFC1` totals and `Pack` rows sum to `Product` totals.
  - Verified Grand Totals:
    - **MAT Aug 2026 LC Value**: `EGP 320,544,229,702.96` (~`EGP 320.5bn`)
    - **MAT Aug 2025 LC Value**: `EGP 275,649,676,467.91` (~`EGP 275.6bn`, `+16.29%` YoY)
    - **MAT Aug 2024 LC Value**: `EGP 186,664,597,004.07` (~`EGP 186.7bn`)
  - Dictionary-encoded all 5 dimension columns (`atc1`, `atc4`, `nfc1`, `product`, `pack`) into compact integer indices for fast in-memory cross-filtering.

---

### Phase 2 — Pure Metrics Engine & Automated Verification Suite (`src/lib/metrics.ts`, `*.test.ts`)
- **Action**: Implemented pure calculation helpers in `src/lib/metrics.ts` and formatting utilities in `src/lib/formatters.ts`.
- **Calculations Implemented**:
  - YoY Growth (`2025 vs 2024`, `2026 vs 2025`), source-backed `2024 vs 2023 (source)` growth, and implied 2023 base aggregation for parent nodes.
  - **2-yr CAGR (`Aug-24 to Aug-26`)**: `(v2026 / v2024)^(1/2) - 1`, returning `null` when `v2024 <= 0` or `v2026 < 0`.
  - **New Launch & Extreme Growth Rules**: Prior value `<= 0` and current `> 0` returns status `'new'` (`New` badge, never `Infinity` or raw `100%`). Growth values `> +999.0%` are capped at `+999.0%+` (`isCapped: true`) for display while preserving exact raw numbers for tooltips and sums.
  - **Scope-Based Market Share & Share Shift**: Dynamic scope share (`2024`, `2025`, `2026`), parent-relative share, total Egypt market share, `Δ Share (pp)`, and relative share change.
  - **Evolution Index (`EI`)**: `((1 + g_item) / (1 + g_scope)) * 100`.
  - **Price/Mix Decomposition**: Average unit price (`Value / Units`), Volume effect (`g_units`), and Price/Mix effect (`(1 + g_value) / (1 + g_units) - 1`).
  - **Momentum**: `YTD Growth % - MAT Growth %`.
  - **Concentration Metrics**: Top-5 / Top-10 share and **Herfindahl-Hirschman Index (HHI)** (`sum of squared percentage shares`, `0–10,000`).
- **Verification**: Created `src/lib/metrics.test.ts` (11 unit tests) and `src/lib/data.test.ts` (8 dataset & filter engine integration tests) — **all 19 tests passing**.

---

### Phase 3 — Bi-Directional Faceted Filter Engine & Global Store (`src/lib/filterEngine.ts`, `src/store/useMarketStore.ts`)
- **Action**: Built an indexed in-memory cross-filtering engine and Zustand state store synchronized with browser URL query parameters.
- **Key Capabilities**:
  - **Bi-Directional Cross-Filtering**: Available options in each of the 5 filters (`ATC1`, `ATC4`, `NFC1`, `Product`, `Pack`) are computed from the rows matching all *other* active filters (`OR` within a dimension, `AND` across dimensions).
  - **Automatic Selection Pruning**: When changing a filter invalidates selections in another dimension, invalid selections are automatically dropped and reported via a dismissible banner notice.
  - **Non-Double-Counting Scope Totals**: Automatically selects the highest applicable hierarchy level (`NFC1` when only class/form filters are active, `Product` when Product filter is active, `Pack` when Pack filter is active) to compute exact scope totals.
  - **URL State Persistence**: Synchronizes `period`, `measure`, `tab`, `groupBy`, `shareBasis`, `q` (table search), and dimension selections (`atc1`, `atc4`, `nfc1`, `product`, `pack`) to `window.location.search`.

---

### Phase 4 — Core Explorer Table & Visual Analytics Views (`src/components/`)
- **Action**: Built the interactive UI components and ECharts analytical views:
  - `InterlinkedFilterBar.tsx`: 5 multi-select filter popovers with `@tanstack/react-virtual` virtualized lists for `10,161` Products and `8,823` Packs, live EGP/row-count metrics, Select All / Clear, and active filter chips.
  - `MainHierarchyTable.tsx`: Single unified table driven by `MAT | YTD` and `LC Value | Units` toggles, supporting tree expansion (`Product > Pack` and 5-level `ATC1 > ATC4 > NFC1 > Product > Pack`), flat grouping modes, sorting on every column, search filtering, and CSV export.
  - `MarketStructureView.tsx`: Dual-axis Size & Value/Units Growth bar chart, Winsorised Growth Treemap (`Product > Pack` or `ATC1 > ATC4`), Product Pareto (`80/20`) curve, and ATC4 HHI concentration table.
  - `ShareAndMatrixView.tsx`: Growth-Share Bubble Matrix (`Stars`, `Cash Cows`, `Rising Challengers`, `Declining`), 3-year Share Shift slope chart + gainers/losers table, and 2-yr CAGR vs Latest Growth / Momentum scatter.
  - `PortfolioAndLaunchesView.tsx`: `NFC1` dosage form mix, Pack Price Tier analysis, Multi-Pack Brand Architecture table, and 2026 New Launches vs Discontinued products/packs.

---

### Phase 5 — UI/UX Refinements, Branding & Layout Restructuring
- **Executive Summary Streamlining (`src/components/ExecutiveSummaryBanner.tsx`)**:
  - Focused the top KPI banner into a clean **3-card grid** (`LC Value`, `Units Volume`, `Active Products & Packs`) across a 3-column desktop layout (`md:grid-cols-3`), removing the `Brand Concentration` card and the bottom metadata footer rows (secondary period comparison, `% of Egypt` market share, and `2026 New Launches` footer) from the remaining cards while preserving the primary headline figures, YoY growth badges, `2-yr CAGR`, and `Avg Packs per Brand` metrics.
- **HPG Brand Identity Integration (`src/components/HeaderBar.tsx`, `src/vite-env.d.ts`)**:
  - Replaced the generic placeholder icon in the sticky header with the official **Hefny Pharma Group (`HPG logo.jpg`)** logo inside a full-height (`h-16`) square container with `object-contain scale-[1.38]`.
- **Table Virtualization & Sticky Header Alignment (`src/components/MainHierarchyTable.tsx`)**:
  - Refactored table body virtualization from `position: absolute` rows to **in-flow spacer rows (`paddingTop` and `paddingBottom` `<tr>` elements)** so `table-fixed` column widths align pixel-for-pixel across the sticky `<thead>`, pinned `Filtered Scope Total` row, and virtualized `<tbody>` rows.
  - Enhanced table header contrast (`bg-slate-200 dark:bg-slate-900`, `text-slate-800 dark:text-slate-100`) and active sort indicators.
- **Standalone Top Explorer Table & Split Workspace (`src/App.tsx`, `src/store/useMarketStore.ts`, `src/types/market.ts`, `src/components/views/MarketStructureView.tsx`)**:
  - Promoted the **Explorer Table (`Product > Pack`)** out of the tab navigation into a permanent, standalone top section (`#explorer-table-section`) above the chart tabs.
  - Streamlined the bottom chart navigation into 4 focused visual tabs (`Market Structure & Concentration`, `Growth Drivers & Movers`, `Share Matrix, Shifts & Momentum`, `Portfolio, Packs & Launches`).
  - Updated `drillToProductsInTable` to filter the report, set `groupBy` to `'tree_product_pack'`, and smoothly scroll to `#explorer-table-section`.

---

### Phase 6 — Final Documentation & Production Build Verification
- **Action**: Updated `README.md`, updated `WORKLOG.md`, and verified TypeScript and Vite production build.
