# IQVIA Egypt Pharma Market Intelligence Report (React + TypeScript)

Single-page pharmaceutical market analytics application built for **Hefny Pharma Group (HPG)** using the **IQVIA Egypt Combined Data** (`MAT Aug 2024–2026` & `YTD Aug 2024–2026`), focused on **Products (Brands)** and **Packs** across all 5 hierarchy levels (`ATC1 > ATC4 > NFC1 > Product > Pack`).

---

## 1. Quick Start & Run Instructions

```bash
# 1. Install dependencies
npm install

# 2. Preprocess the Excel workbook into /public/data/market-data.json
npm run preprocess

# 3. Run unit & dataset verification tests (Vitest)
npm test

# 4. Start the local Vite development server
npm run dev

# 5. Build for production
npm run build
```

---

## 2. Project Architecture

```text
├── HPG logo.jpg                             # Hefny Pharma Group (HPG) brand logo asset
├── IQVIA_Brands_MAT_8-2026_Ungrouped.xlsx   # Source workbook ("Egypt Combined Data")
├── README.md                                # Project documentation & verification guide
├── WORKLOG.md                               # Engineering work log & change history
├── scripts/
│   └── preprocess.ts                        # Offline Node/TS preprocessor -> /public/data/market-data.json
├── public/
│   └── data/
│       └── market-data.json                 # Dictionary-encoded compact JSON (28,410 hierarchy rows + rollups)
├── src/
│   ├── types/
│   │   └── market.ts                        # Core TypeScript types & compact tuple schema
│   ├── lib/
│   │   ├── metrics.ts                       # Pure, unit-tested calculation functions (growth, CAGR, share, EI, HHI)
│   │   ├── metrics.test.ts                  # Unit test suite for all mathematical & edge-case rules
│   │   ├── filterEngine.ts                  # Single-pass (<15ms) bi-directional faceted filter engine & auto-pruner
│   │   ├── aggregationEngine.ts             # Hierarchical (Product > Pack, 5-level tree) & flat table builder
│   │   ├── analyticsEngine.ts               # Analytics models for report sections (Pareto, Matrix, Share Shift, Launches)
│   │   ├── data.test.ts                     # Dataset integrity, grand totals, and interlinked filter verification tests
│   │   └── formatters.ts                    # EGP mn/bn, %, pp, Evolution Index, and exact tooltip formatters
│   ├── store/
│   │   └── useMarketStore.ts                # Zustand global state with 2-way URL query string synchronization
│   ├── components/
│   │   ├── HeaderBar.tsx                    # Sticky HPG-branded header with MAT|YTD & LC Value|Units toggles + URL sharing
│   │   ├── InterlinkedFilterBar.tsx         # 5 virtualized bi-directional multi-select filters + active chips
│   │   ├── ExecutiveSummaryBanner.tsx       # Section A: 4-card persistent KPI summary (Value, Units, Portfolio, Concentration)
│   │   ├── MainHierarchyTable.tsx           # Standalone top Explorer Table (Product > Pack) with in-flow virtualization + CSV export
│   │   └── views/
│   │       ├── MarketStructureView.tsx      # Sections B & H: Size/Growth bars, Treemap, Pareto 80/20, ATC4 HHI
│   │       ├── ShareAndMatrixView.tsx       # Sections D, E & G: Bubble Matrix, Share Shift Slope, CAGR vs Latest Momentum
│   │       ├── PortfolioAndLaunchesView.tsx # Sections I & J: NFC1 Mix, Price Tiers, Pack Extensions, New & Discontinued
│   │       └── GrowthDecompositionView.tsx  # Supplementary Volume vs Price/Mix & Waterfall analytics module
│   ├── App.tsx                              # Split workspace layout: Top Explorer Table + Bottom Interactive Chart Tabs
│   ├── vite-env.d.ts                        # Vite client type declarations
│   └── main.tsx                             # React 18 entry point
```

---

## 3. Workspace Layout & Core Capabilities

1. **Sticky Header Bar (`HeaderBar.tsx`)**:
   - Displays the **Hefny Pharma Group (HPG)** identity and live dataset scope counters (`10,161 Products • 8,823 Packs • 507 ATC4 Classes • 28,410 Hierarchy Rows`).
   - Global **Period Toggle (`MAT Aug` | `YTD Aug`)** and **Measure Toggle (`LC Value (EGP)` | `Units`)** persisted in the URL query string.
   - One-click **Share View** URL copy and **Dark / Light Mode** switcher.
2. **Bi-Directional Interlinked Filter Bar (`InterlinkedFilterBar.tsx`)**:
   - Multi-select dropdowns for **ATC1, ATC4, NFC1, Product, Pack** in exact hierarchy order.
   - **Virtualised search-as-you-type lists** for high-cardinality dimensions (`10,161` Products and `8,823` Packs).
   - **True cross-filtering in any direction**: selecting a Pack or Product narrows parent classes (`ATC1`, `ATC4`, `NFC1`), and selecting a parent class narrows child Products and Packs.
   - **OR** logic within a filter, **AND** logic across filters, live EGP/row-count badges per option, and automatic pruning of invalid selections with user notification.
3. **Executive Summary Banner (`ExecutiveSummaryBanner.tsx`)**:
   - 4 persistent KPI cards reacting immediately to filter and toggle changes:
     1. **LC Value (EGP)**: 2026 Value, YoY Growth %, 2-yr CAGR (`Aug-24 to Aug-26`), secondary period comparison, and `% of Egypt` total market.
     2. **Units Volume**: Juxtaposed directly alongside Value to separate real volume growth from price/inflation effects.
     3. **Active Products & Packs**: Active brand and pack counts, average packs per brand, and 2026 new launch counts.
     4. **Brand Concentration**: Top-5 and Top-10 brand share % plus scope Product **Herfindahl-Hirschman Index (HHI)**.
4. **Top Standalone Explorer Table (`MainHierarchyTable.tsx`)**:
   - Permanently visible above the chart tabs so analysts can inspect and sort rows without switching tabs.
   - Supports **Hierarchy / Group By** modes (`Product > Pack` expandable tree by default, full 5-level `ATC1 > ATC4 > NFC1 > Product > Pack` tree, or flat `Product`, `Pack`, `NFC1`, `ATC4`, `ATC1` views).
   - Switchable **Share Basis** (`Current Filter Scope`, `Immediate Parent Node`, `Unfiltered Total Egypt Market`).
   - Uses in-flow spacer row virtualization (`@tanstack/react-virtual`) with sticky header, pinned `Filtered Scope Total` row, sticky first column, 3-point `24→26` mini-sparklines, complementary growth subtitle, and full **CSV Export**.
5. **Bottom Interactive Visual Analytics Tabs (`App.tsx`)**:
   - **Market Structure & Concentration (`Sec B & H`)**: Dual-axis Size & Value/Units Growth bar chart, Winsorised Growth Treemap (`Product > Pack` or `ATC1 > ATC4`), Product Pareto (`80/20`) curve, and ATC4 Concentration & HHI table with direct drill-to-table actions.
   - **Share Matrix, Shifts & Momentum (`Sec D, E & G`)**: Growth-Share Bubble Matrix (`Stars`, `Cash Cows`, `Rising Challengers`, `Declining`), 3-year Share Shift Trajectory (`2024 → 2025 → 2026`) with gainers/losers table, and 2-yr CAGR vs Latest Growth / `YTD - MAT` Momentum scatter.
   - **Portfolio, Packs & Launches (`Sec I & J`)**: Dosage Form (`NFC1`) mix, Pack Price Tier distribution (`Economy <50 EGP` to `Ultra-Premium 500+ EGP`), Multi-Pack Brand Architecture explorer, and 2026 New Launches vs Discontinued tracker.

---

## 4. Verified Data Model & Hierarchy Rules

- **28,410 Hierarchical Source Rows**:
  - `NFC1` level (`Product` blank, `Pack` blank): **851 rows**
  - `Product` level (`Product` set, `Pack` blank): **11,067 rows** (`10,161` unique commercial brands)
  - `Pack` level (`Product` set, `Pack` set): **16,492 rows** (`8,823` unique pack descriptions)
  - Higher-level aggregates built strictly from `NFC1` rows without double-counting: `ATC4` (**507 rows**), `ATC1` (**16 rows**), and `Grand Total` (**1 row**).
- **Verified Grand Totals**:
  - **MAT Aug 2026 LC Value**: `EGP 320,544,229,702.96` (~`EGP 320.5bn`)
  - **MAT Aug 2025 LC Value**: `EGP 275,649,676,467.91` (~`EGP 275.6bn`, **+16.3%** YoY)
  - **MAT Aug 2024 LC Value**: `EGP 186,664,597,004.07` (~`EGP 186.7bn`)
- **Non-Double-Counting Scope Rule**:
  - When only `ATC1`, `ATC4`, or `NFC1` filters (or no filters) are active, scope totals aggregate strictly `NFC1`-level rows.
  - When `Product` filter is active (and `Pack` is not), scope totals aggregate strictly `Product`-level rows.
  - When `Pack` filter is active, scope totals aggregate strictly `Pack`-level rows.
  - Hierarchy levels are never mixed in any sum.

---

## 5. Explicit Assumptions & Data Quality Rules

1. **Local Currency (`LC`)**: Assumed to be **Egyptian Pounds (`EGP`)**.
2. **Time Horizons**: `MAT Aug` represents the 12-month Moving Annual Total ending August of each year (2024, 2025, 2026); `YTD Aug` represents the 8-month Year-to-Date period (January–August).
3. **2024 Growth (`vs 2023 (source)`)**: Because 2023 sales values are not present as standalone columns in the workbook, 2024 growth uses the source column (`vs 2023 (source)`). For aggregated parent nodes, implied 2023 sales (`X_2024 / (1 + g_2024)`) are summed where valid.
4. **Zero / Null & New Launch Handling**:
   - Blank or `null` sales cells are treated as `0` for sums and `null` for ratios.
   - Source Rank `-1` (or `<= 0`) is normalized to `null` and competition ranks are recomputed dynamically within the active scope.
   - When prior-period value is `0` or `null` and current-period value is `> 0`, growth is reported as **`New`** (never `Infinity` or `100%`, correcting the raw sheet's `1.0` placeholder on new launches).
5. **Extreme Growth Capping (`+999.0%+`) & Winsorisation**:
   - Displayed growth values exceeding `+999.0%` (`9.99` in decimal) are capped at `+999.0%+` and flagged with an indicator icon (`1,079` source rows exceed `+1000%` in MAT Aug 2026 LC Value).
   - Winsorisation is applied strictly to chart colour scales and scatter bounds, never to totals or table values.
#   A u g 2 0 2 6 . M A T . Y T D  
 