# Analytics Enhancement Roadmap — IQVIA Egypt Pharma Market Intelligence Report

> **Purpose.** This document is a prioritized set of recommendations to deepen the analytical value of the dashboard for **brand / product managers** — the primary persona — using **only the fields already present in the dataset** (`ATC1 > ATC4 > NFC1 > Product > Pack`, MAT & YTD Aug 2024–2026, LC Value & Units, plus all derived metrics in `metrics.ts`). No re-export of the IQVIA workbook is required for anything in Sections 2–4.
>
> **Audit basis.** Written after a full code review of the repository (`main` @ HEAD): all four view components, the explorer table, `metrics.ts`, `aggregationEngine.ts`, `analyticsEngine.ts`, `filterEngine.ts`, the Zustand store, the preprocessor, and the raw workbook headers (53 columns verified).
>
> **How to read.** Every recommendation has an ID (`QW-` quick win, `NC-` new chart, `UX-` product enhancement), a priority (`P0 > P1 > P2 > P3`), an effort estimate (`S` < half day, `M` 1–3 days, `L` > 3 days), and — for charts — a full spec: the insight question it answers, encodings, interactions, and the exact computation needed.

---

## Table of Contents

1. [Market Context — Why These Charts](#1-market-context--why-these-charts)
2. [Current-State Snapshot](#2-current-state-snapshot)
3. [Priority 0 — Quick Wins: Unlock What Is Already Built](#3-priority-0--quick-wins-unlock-what-is-already-built)
4. [New Analytical Charts](#4-new-analytical-charts)
   - 4.1 [Where to Play](#41-theme-1--where-to-play)
   - 4.2 [How to Win](#42-theme-2--how-to-win)
   - 4.3 [At What Price](#43-theme-3--at-what-price)
   - 4.4 [With What Portfolio](#44-theme-4--with-what-portfolio)
   - 4.5 [When to Act](#45-theme-5--when-to-act)
5. [UX & Product Enhancements](#5-ux--product-enhancements)
6. [Consolidated Priority Matrix](#6-consolidated-priority-matrix)
7. [Implementation Guardrails](#7-implementation-guardrails)
8. [Adjacent Observations (Outside Selected Scope)](#8-adjacent-observations-outside-selected-scope)

---

## 1. Market Context — Why These Charts

The dataset itself argues for the chart set below. The verified Egypt grand totals show a market whose **value growth is almost entirely price, not volume**:

| Metric (Egypt total) | MAT Aug 2025 | MAT Aug 2026 | 2-yr CAGR (24→26) |
|---|---|---|---|
| LC Value growth | **+47.7%** | **+16.3%** | **+31.0%** |
| Units growth | **+4.7%** | **+1.0%** | **+2.8%** |
| Implied Price/Mix (`calcPriceMixGrowth`) | +41.1% | +15.1% | — |

Two headline facts a brand manager must not miss, and which the current chart set does not put on one screen:

1. **~92% of MAT 2026 value growth is price/mix** (15.1 pp of 16.3 pp). Nominal growth flatters every brand in the report; only the Units columns tell the demand story.
2. **Volume is decelerating into a contraction**: YTD Aug 2026 units fell **−1.6%** YoY (vs +7.8% in YTD 2025 and +1.0% for the full MAT) — a units momentum of **−2.6 pp**. YTD value growth also slowed to +14.7% (from +45.8%), a value momentum of −1.6 pp.

The recommendations below therefore weight **volume-vs-price truth-telling, share-of-growth honesty, and class selection** heavily — the questions a brand manager asks before allocating a promotional or launch budget in an inflationary, volume-flat market.

---

## 2. Current-State Snapshot

**16 mounted visuals** (10 ECharts + 1 SVG sparkline + 4-card KPI banner + pinned-total explorer table) across 3 chart tabs:

| Tab | Section | Visual |
|---|---|---|
| Always visible | A | 4 KPI cards (Value, Units, Portfolio, Concentration/HHI) |
| Always visible | — | Explorer Table, 18 columns, 7 group-by modes, CSV export |
| Market Structure & Concentration | B & H | Size & dual-growth combo bars · Hierarchical treemap · Pareto 80/20 curve · ATC4 HHI table |
| Share Matrix, Shifts & Momentum | D, E & G | Growth-Share bubble matrix · 3-yr share slope chart · gainers/losers tables · CAGR-vs-growth scatter · momentum bars |
| Portfolio, Packs & Launches | I & J | NFC1 mix + price trend · price-tier value/volume bars · pack-size table · multi-pack brands table · launches vs discontinued tables |

**Built but unreachable** (see Quick Wins): `GrowthDecompositionView.tsx` (583 lines — volume vs price/mix decomposition, growth-contribution waterfall, top movers with threshold slider), the auto-generated `executive.insights` string array, `deltaShare25_24Pp`, `relShareChange26_25`, `flaggedCappedCount`/`newCount`, market-level `priceMixGrowth26`/`avgPrice` KPIs.

**Working well and worth preserving**: bi-directional cross-filtering with auto-prune, the non-double-counting scope rule, MAT/YTD and Value/Units global toggles, URL state sync, New/capped growth rules (+999.0%+ cap), winsorised colour scales, virtualisation everywhere.

---

## 3. Priority 0 — Quick Wins: Unlock What Is Already Built

These are the highest ROI items in the entire document: the analytics are **already computed and tested**, only the last mile of UI wiring is missing.

### QW-1 · Mount `GrowthDecompositionView` as a 4th tab — `P0` · Effort `S`

**Problem.** `src/components/views/GrowthDecompositionView.tsx` is fully implemented (volume vs price/mix stacked decomposition, scope-growth waterfall, top growers/decliners with a minimum-size threshold slider) but is never imported by `App.tsx`. Sections C & F of the report do not exist for the user.

**Why it matters.** In a market where +16.3% value growth contains only +1.0% units growth, the volume-vs-price decomposition **is** the story. It is also the exact evidence a brand manager needs to defend (or attack) a growth number.

**Fix (4 small edits).**

```tsx
// 1. src/types/market.ts — extend the union
export type ActiveTab = 'structure' | 'share' | 'portfolio' | 'growth';

// 2. src/App.tsx — import the view and the TrendingUp icon
import { GrowthDecompositionView } from './components/views/GrowthDecompositionView';

// 3. src/App.tsx — register the tab in CHART_TABS
{
  id: 'growth',
  label: 'Growth Drivers & Movers',
  sectionsBadge: 'Sec C & F',
  icon: TrendingUp,
},

// 4. src/App.tsx — render it, and extend the store's valid list
{activeTab === 'growth' && <GrowthDecompositionView bundle={analyticsBundle} />}
```

```ts
// src/store/useMarketStore.ts — line ~103
const validTabs: ActiveTab[] = ['structure', 'share', 'portfolio', 'growth'];
```

No other changes needed: the view already takes `{ bundle: ScopedAnalyticsBundle }` and reads period/measure/theme/actions from the store itself. URL sharing keeps working because `syncStateToUrl` already persists `tab=growth`.

### QW-2 · Render the auto-generated insights strip — `P0` · Effort `S`

**Problem.** `analyticsBundle.executive.insights` (5 plain-language, filter-aware sentences — market value/units/price-mix summary, leading product, #1 growth contributor, top share gainer, top ATC1 highlight) is computed on every filter change and never rendered. It was removed in Phase 5 to save vertical space.

**Fix.** Bring it back as a **collapsible** strip under the 4 KPI cards in `ExecutiveSummaryBanner.tsx` (it already receives `executive`): one `useState(false)` toggle labelled "Key insights (5)", defaulting to collapsed on first load and auto-expanding only when a filter is active. Zero recomputation cost — the strings already exist.

### QW-3 · Surface the data-quality footnote — `P0` · Effort `S`

**Problem.** `TableViewData.flaggedCappedCount` and `newCount` are computed per view but never shown; `meta.flaggedSourceGrowthOver1000` (1,079 rows in MAT 26 value) lives only in tests. The README promises this footnote; the UI does not deliver it.

**Fix.** One line under the Explorer Table controls bar, e.g. `⚠ 37 rows capped at +999.0%+ · 214 new launches in scope`, with a `title` tooltip explaining the cap rule and that raw values are preserved in tooltips/CSV. This is a trust feature: without it, a +999%+ cell looks like a bug rather than a rule.

### QW-4 · Expose `Δ Share 25v24` and relative share change — `P1` · Effort `S`

**Problem.** `TableNode.deltaShare25_24Pp` and `relShareChange26_25` are computed for every row and displayed nowhere. A brand whose share rose two years running tells a different story than one that rose only this year.

**Fix (cheapest option).** Extend the tooltip of the existing `Δ Share pp (26v25)` cell: `Δ 25v24: +0.4 pp · rel. +6.2%`. Optional follow-up: a thin "share path" micro-visual `+0.4 → +1.1 pp` next to the Δ value. No new computation, no new column width.

### QW-5 · Wire click-to-filter on the E1 slope chart and G1 scatter — `P1` · Effort `S`

**Problem.** Most visuals cross-filter on click via `toggleFilterValue` / `drillToProductsInTable`, but the share trajectory slope chart (E1) and the CAGR-vs-growth scatter (G1) do not. Interaction inconsistency teaches users to stop clicking.

**Fix.** Both charts already render from bundle nodes that carry `dimKey` / `dictIdx`; add the same `onEvents` click handler used by the bubble matrix. Add `cursor: 'pointer'` on those series.

### QW-6 · Persist the theme preference — `P2` · Effort `S`

**Problem.** `toggleTheme` flips `documentElement` classes but nothing persists; every reload lands on dark.

**Fix.** In `toggleTheme`, `localStorage.setItem('hpg-theme', next)`; in store initialisation, read `localStorage.getItem('hpg-theme') ?? 'dark'` and apply the class before first paint (guard for SSR/`typeof window`). Do **not** add theme to the URL — it would pollute shared analysis links.

---

## 4. New Analytical Charts

Twelve new visuals, grouped by the brand-manager decision journey. All are computable from existing tuple fields (`public/data/market-data.json`, tuple indices 7–18 + dims) and existing `TableNode` / bundle fields. Section letters continue the report's A–J convention.

### 4.1 Theme 1 — Where to Play

#### NC-1 · Class Attractiveness Matrix ("Where to Play" grid) — `P1` · Effort `M` · Sec K, Market Structure tab

- **Insight question.** *Which ATC4 classes deserve investment, and which are tax on growth?* One screen replaces an hour of sorting the 507-row ATC4 table.
- **Why it matters.** Class selection is the first and highest-leverage brand-plan decision. In a volume-flat market, the difference between a +20% class and a −5% class is the entire ambition conversation.
- **Chart type.** ECharts scatter (bubble). **X** = class growth 26 % (winsorised −20…+60 for axis bounds only); **Y** = class 2026 value, **log scale** (classes span ~4 orders of magnitude); **bubble size** = √(v2026 / max v2026); **colour** = HHI bucket from `Atc4ConcentrationRow.hhi` (emerald < 1500 fragmented → easier entry, amber 1500–2500, rose ≥ 2500 concentrated → gatekeeper risk).
- **Marks.** Horizontal markLine at Egypt market growth (+16.3% MAT 26 value) and vertical at median class growth. Four quadrant labels: **Scale winners** (big + fast), **Cash cores** (big + slow), **Selective bets** (small + fast), **Structural drag** (small + slow).
- **Interactions.** Click bubble → `toggleFilterValue('atc4', atc4Idx)` (field exists on `Atc4ConcentrationRow`). Tooltip: sales, value/units growth, brands, packs, HHI, #1 brand + its share — all fields already in `atc4Concentration`.
- **Data & computation.** Direct: `analyticsBundle.atc4Concentration` (has `v2026`, `growth26`, `productCount`, `packCount`, `hhi`, `topProductName`). Optionally join `atc4Nodes[].cagr24_26` to offer a Growth/CAGR X-axis toggle.
- **Caveats.** Winsorise axis bounds only, never values. Exclude classes with `v2026 ≤ 0`. Label only the top ~30 bubbles by value to avoid label soup.

#### NC-2 · Real vs Nominal Momentum Panels (indexed small multiples) — `P1` · Effort `M` · Sec L, Growth Drivers tab

- **Insight question.** *Is this category actually growing in patients, or only in pounds?* — per ATC1 class, side by side.
- **Why it matters.** This is the Egypt inflation story made unavoidable. Market-wide, value CAGR is +31.0% while units CAGR is +2.8%; classes will differ wildly, and budget decisions should follow the units line.
- **Chart type.** 16 mini line panels (ECharts `grid` array in one canvas, 4×4), one per ATC1. Each panel: X = [Aug 2024, Aug 2025, Aug 2026]; two lines indexed to **2024 = 100**: **value index** (indigo, solid) and **units index** (amber, dashed). Panel title = ATC1 code + units CAGR badge (green ≥ +5%, slate 0–5%, rose < 0%).
- **Marks.** Reference line at 100. The visual gap between the two lines *is* the price/mix effect — annotate the widest-gap panel.
- **Interactions.** Click panel → `toggleFilterValue('atc1', atc1Idx)`. Tooltip shows the exact indices and the class price/mix growth (`valueGrowth26` vs `unitsGrowth26` ratio, or `priceMixGrowth26` from the node).
- **Data & computation.** Direct from `analyticsBundle.atc1Nodes`: each node carries `value2024/25/26` **and** `units2024/25/26` (TableNode lines 70–75) plus `atc1Idx`. Index = `v_year / v_2024 × 100`.
- **Caveats.** Exclude classes with `value2024 ≤ 0` (index undefined) and show an "n/a" tile instead. Reacts to the MAT/YTD toggle (both periods' tuples exist); keep the measure toggle **inert** here and always draw both measures — that is the point of the chart.
- **Optional extension (no new data).** A "constant-EGP" toggle that lets the user apply a single annual deflator constant (e.g. 0.20) to the value line, clearly labelled *"assumption, user-set"*. This is a display transformation only, not new data — keep it off by default.

#### NC-3 · Market Health Heatmap (ATC1 × metric scan) — `P2` · Effort `M` · Sec M, Market Structure tab

- **Insight question.** *Which major classes are deteriorating on which dimension — and how fast?* A 30-second triage across the 16 ATC1s.
- **Why it matters.** Brand managers own classes, not the whole market; this is their morning scan. Catches the "value fine, volume dying" pattern that single-metric sorting hides.
- **Chart type.** ECharts heatmap: rows = 16 ATC1 classes (sorted by 2026 value, desc), columns = 6 metrics: **Value growth 26 · Units growth 26 · Price/Mix 26 · Δ class share of Egypt market (pp, 26v25) · Units momentum (YTD−MAT) · 2-yr units CAGR**.
- **Encodings.** Cell colour = column-wise winsorised percentile (`winsoriseForColorScale`, e.g. p05–p95), diverging palette centred at neutral (0 for growth/momentum, market growth for Δshare). Cell text = compact formatted value. Grey = null (New/insufficient base).
- **Interactions.** Click row label → `toggleFilterValue('atc1', ...)`. Click cell → drill the corresponding column's ranked table in the Explorer Table. Tooltip carries the exact values.
- **Data & computation.** `atc1Nodes` provide every column: `valueGrowth26`, `unitsGrowth26`, `priceMixGrowth26`, `deltaShare26_25Pp`, `momentum26`, `cagr24_26` (on units via `units2024/26` recompute — specify a `unitsCagr` helper or compute inline). "Δ class share of Egypt market" = `totalMarketShare26` year-over-year difference: add a small derived `deltaTotalSharePp` or approximate with scope share when unfiltered (they coincide when no filter is active — note this).
- **Caveats.** When filters are active, shares are within-scope; label the column dynamically ("Δ Share of Scope"). Reacts to both global toggles.

### 4.2 Theme 2 — How to Win

#### NC-4 · Share of Market vs Share of Growth (SOM–SOG matrix) — `P1` · Effort `M` · Sec N, Share Matrix tab

- **Insight question.** *Who is actually capturing the market's incremental EGP — and who is defending a shrinking share of it?*
- **Why it matters.** The single most decision-relevant competitive chart for a brand manager: it separates brands that are **bigger than their fair share of growth** (winning new money) from those growing below their entitlement (harvesting). Complements the existing ΔShare table, which only shows net movement, not growth capture.
- **Chart type.** Scatter. **X** = share of market 2026 % (`share26`, scope-based — exists); **Y** = **share of growth** % = `absGrowth26 / (scopeV2026 − scopeV2025) × 100` (new, one line of math on existing fields); **bubble size** = √(v2026); **colour** = winsorised EI (reuse the bubble-matrix palette).
- **Marks.** 1:1 diagonal markLine ("fair share of growth"); horizontal markLine at 100%. Quadrants: **Growth thieves** (top-left: small share, outsized growth capture), **Entitled leaders** (top-right), **Under-attack incumbents** (bottom-right: large share, capturing less than fair), **Fading** (bottom-left).
- **Interactions.** Click → cross-filter. Tooltip: SOM, SOG, abs EGP gain, ΔShare pp, EI.
- **Data & computation.** `productNodes` (or the tab's existing Products/Packs/NFC1/ATC4 scope switcher) supply `share26` and `absGrowth26`; scope totals come from `executive[period]`. Guard: if scope delta ≤ 0 (contracting market) show a banner "market contracted −x%; SOG shown as share of |decline|" and compute against the absolute net decline, or disable — pick one rule and unit-test it.
- **Caveats.** New launches have `absGrowth26 = v2026` (from a zero base) and can dominate SOG — either badge them "New" (reuse `growth26.isNew`) or add a min-size toggle like the F-section slider. Measure-sensitive: on Units, this becomes share of unit growth — arguably the more honest chart in this market; default to the active global measure.

#### NC-5 · Competitiveness Trajectory Quadrant (EI'25 vs EI'26) — `P1` · Effort `S` · Sec G extension, Share Matrix tab

- **Insight question.** *Which competitors are gaining strength versus the market, and is that acceleration or decay?* Evolution Index is already trusted; this shows its **trend**.
- **Why it matters.** A brand with EI 130 that had EI 160 last year is a different threat than one climbing 90 → 115. Single-year EI (currently a table badge) cannot distinguish improving from fading competitiveness.
- **Chart type.** Scatter. **X** = Evolution Index 2025 (new: `((1 + growth25) / (1 + scopeGrowth25)) × 100`); **Y** = Evolution Index 2026 (`evolutionIndex26`, exists); **bubble size** = √(v2026); **colour** = above/below the 1:1 diagonal (emerald = accelerating vs market, rose = fading).
- **Marks.** markLines at 100 on both axes (market parity) + 1:1 diagonal. Quadrants: **Rising threats** (x < 100, y > 100), **Sustained outperformers** (x > 100, y > 100, above diagonal), **Recovering** (x < 100, y < 100, above diagonal), **Fading stars** (x > 100, y < 100).
- **Interactions.** Click → cross-filter. Tooltip: EI 25, EI 26, both growths, Δ EI.
- **Data & computation.** `growth25` exists per node; scope growth 25 exists in `executive[period].valueGrowth25` (and units equivalent). One new helper `calcEvolutionIndex` call with 2025 inputs — the function is already pure and unit-tested; add two test cases.
- **Caveats.** Requires `v2024 > 0` for a meaningful 2025 EI — filter candidates like G1 does. Reacts to both global toggles.

#### NC-6 · Brand Ladder Bump Chart (rank flow 24 → 25 → 26) — `P3` · Effort `M` · Sec E extension, Share Matrix tab

- **Insight question.** *Who overtook whom in the top 10 of this class?*
- **Why it matters.** Rank is the language of sales forces and management reviews; overtakes are memorable events that share-point tables bury. Complements the existing share slope chart (same topology, different psychology).
- **Chart type.** Line-and-symbol bump chart: X = 3 year categories; Y = **rank** (inverted axis, 1 at top); one coloured line per brand (top 8 by 2026 value), with rank labels at both ends. Brands that exit/enter the top-8 mid-flow get an "out"/"in" annotation.
- **Data & computation.** New small derived: rank each year via `computeScopeRanks` over `v2024`, `v2025`, `v2026` value maps (the function is pure and reusable; currently only applied to 2026). Store as `rank24/25/26` on the prepared series only — no schema change needed.
- **Interactions.** Click line → cross-filter. Hover highlights the full line (ECharts `emphasis.focus: 'series'`).
- **Caveats.** Ties produce equal ranks (already handled by `computeScopeRanks`); new entrants have no prior rank — start their line at the edge with a "New" badge.

### 4.3 Theme 3 — At What Price

#### NC-7 · Price-Positioning Map (price index vs units share) — `P1` · Effort `M` · Sec O, Portfolio tab

- **Insight question.** *Within this class, who plays premium and who plays economy — and which position is winning volume?*
- **Why it matters.** The classic pharma positioning map, currently missing. With the market's average selling price up ~62% over two years (price/mix +41.1% in 2025, +15.1% in 2026), price position **is** strategy: it reveals premium niches, economy volume machines, and the crowded middle where differentiation dies.
- **Chart type.** Scatter, ideally scoped to one ATC4 (default: largest class in scope). **X** = **price index** = `avgPrice26 / scopeAvgPrice26` (log scale, markLine at 1.0); **Y** = **units share** % = `units2026 / scopeUnits2026` (new, one line on existing fields); **bubble size** = √(value2026); **colour** = winsorised value growth 26.
- **Marks.** Quadrant labels: **Premium volume** (price > 1, high units share — the class price leaders), **Premium niche**, **Economy volume**, **Economy niche**. Optional horizontal markLine at median units share.
- **Interactions.** Click → cross-filter. Tooltip: avg price (exact, `title`), price index, units share, value share, value/units growth, price/mix growth — all existing node fields.
- **Data & computation.** All from `productNodes` (or packs): `avgPrice26`, `units2026`, `value2026`, `valueGrowth26`; scope averages from `executive[period]` (`value2026 / units2026` for the weighted price — do **not** average `avgPrice26` across brands).
- **Caveats.** `avgPrice` mixes pack sizes within a brand (Value/Units blends 14-tab and 30-tab packs) — state this in the subtitle. Exclude nodes with `units2026 ≤ 0`. Force the class filter hint: when scope spans many ATC4s, show a "refine to one ATC4" nudge chip (one click applies the largest class). Measure toggle: keep this chart **always LC Value-based prices** (a price in "units" is meaningless); the Y axis can still react to the measure toggle only by switching to value share — better to fix both and label clearly.

#### NC-8 · Price-Tier Migration (premiumization vs trading down) — `P2` · Effort `S` · Sec I extension, Portfolio tab

- **Insight question.** *Is the market (or this class) premiumizing or trading down?*
- **Why it matters.** 2025–2026 inflation pushed packs across price points; brand managers need to know whether demand is climbing into Premium or being value-engineered into Economy — it decides launch price corridors and pack architecture.
- **Chart type.** Grouped bar chart per tier (Economy < 50 · Standard 50–150 · Premium 150–500 · Specialty > 500 EGP): **value share %** for 2025 vs 2026 side by side, plus a **Δ pp** dot/line overlay per tier. Green = gaining share, rose = losing.
- **Data & computation.** `analyticsBundle.priceTierMix` already stores per-tier `value2025`, `value2026` (and units) — only the share delta view is new. `PriceTierBucket.unitsGrowth26` is also computed but unshown: add a Units-based toggle to expose it.
- **Caveats.** Tier assignment is static per pack (by `avgPrice26 ?? avgPrice25`), so migration shown here is *between* tiers, not within — packs crossing a boundary stay in their old tier. Footnote this. Reacts to the MAT/YTD toggle via the bundle.

### 4.4 Theme 4 — With What Portfolio

#### NC-9 · Portfolio Architecture Map (breadth vs depth) — `P2` · Effort `S` · Sec I extension, Portfolio tab

- **Insight question.** *Which big brands are fragile one-pack businesses, and which have a proper pack ladder?*
- **Why it matters.** Pack architecture is a brand manager's quiet lever: single-pack brands lose a price point, a reimbursement lane, or a pharmacy shelf slot all at once. This chart turns the multi-pack table (I3) into a strategic picture.
- **Chart type.** Scatter. **X** = pack count (**`productNodes[].packCount`** — covers single-pack brands, which `packExtensions` excludes); **Y** = lead-pack share % (`packExtensions.leadPackSharePct`; single-pack brands plot at 100% by definition — high = depth concentration in one SKU); **bubble size** = √(brand 2026 value); **colour** = 2026 growth (winsorised). Marklines at X = 2 and Y = 70%.
- **Reading.** Far-left = **fragile monoliths** (1–2 packs, lead > 70%); bottom-right = **laddered fortresses**; top-right = broad-but-dependent; bottom-left = balanced smalls.
- **Interactions.** Click → `drillToProductsInTable('product', ...)` (already used by I3's Inspect button). Tooltip: brand, packs, lead pack name + share, new extensions count/value (`newExtensionPackCount`, `extensionValue26` — computed, currently only badge-shown).
- **Data & computation.** `productNodes` supply `packCount`, `v2026`, and growth for every brand; `packExtensions` (which only covers multi-pack brands or brands with new extensions) supplies `leadPackSharePct`, `newExtensionPackCount`, `extensionValue26`, `leadPackName` via `prodIdx` join — zero new math.

#### NC-10 · Launch Entry Positioning — `P2` · Effort `S` · Sec J extension, Portfolio tab

- **Insight question.** *Are this year's launches entering at premium or economy price points — and does entry price predict first-year size?*
- **Why it matters.** Egypt's 2026 launches landed in a +15% price/mix market; whether a launch priced above or below its class average is the earliest read on its strategy and its vulnerability. Directly informs HPG's own launch price corridors.
- **Chart type.** Scatter. One point per 2026 new product (`newProducts`): **X** = entry price index = `avgPrice26 / classAvgPrice26` (match via `atc4Idx` → `atc4Nodes[].avgPrice26`); **Y** = first-year value 2026 (log); **colour** = NFC1 dosage form (categorical, ≤ 12); **size** fixed small (avoid double-encoding).
- **Marks.** Vertical markLine at 1.0 (parity with class). Median entry index annotated.
- **Interactions.** Click → cross-filter; tooltip: brand, ATC4, class avg price, first-year value, scope share.
- **Caveats.** Class average uses incumbent prices (`atc4Nodes.avgPrice26`) — fine by construction. Badge pack-level launches separately (a toggle exists for products/packs in section J already). Excluding micro-launches < EGP 1mn via a threshold keeps the plot readable (reuse the F-section slider pattern).

#### NC-11 · Revenue Fragility Strip — `P3` · Effort `S` · Sec H extension, Market Structure tab

- **Insight question.** *How much of this scope's revenue rests on very few brands or very few packs?*
- **Why it matters.** Concentration is already measured (HHI, Pareto) but not *felt*. One horizontal 100% stacked bar makes the dependency visceral before a negotiation or a tender.
- **Chart type.** Single horizontal stacked bar of scope 2026 value, segments: **Top-3 brands** · **single-pack brands** (`productNodes` where `packCount === 1` — note `packExtensions` excludes them) · **2026 launches** (`newProducts` value) · **all other brands**. Segment labels with EGP and %. Four stat chips above: Top-3 share, single-pack-brand share, launch share, Pareto 80% count (`pareto.countFor80Pct`).
- **Data & computation.** All segments derive from existing bundle arrays (`productNodes` top-3 by v2026, `packExtensions`, `newProducts`, scope total from `executive`). Watch overlap: a 2026 launch that is single-pack would double count — define precedence (launch → single-pack → top-3 → other) and unit-test it.
- **Caveats.** Reacts to filters and both toggles; when scope is a single brand, the strip degrades gracefully to pack-level segments (top pack / single-SKU share).

### 4.5 Theme 5 — When to Act

#### NC-12 · Seasonality / Front-Load Index by class — `P2` · Effort `M` · Sec P, Market Structure tab

- **Insight question.** *Which categories front-load their year into Jan–Aug (flu/cough season, reimbursement cycles) — and which build toward year-end?*
- **Why it matters.** Timing decides promotion calendars, stock builds, and quarter-end push decisions. The dataset contains the signal even though it has no monthly columns: the YTD-vs-MAT split differences seasonal from flat categories. (Market-wide the ratio is a neutral 0.6653 ≈ 8/12 — the deviations by class are the signal.)
- **Chart type.** Horizontal diverging bar chart, one bar per ATC4 (top 30 by value, or all NFC1s in a single-class scope). **Value** = seasonality index = `(YTD2026 / MAT2026) ÷ (8/12)`; **colour**: emerald ≥ 1.10 (front-loaded), slate 0.90–1.10 (flat), rose ≤ 0.90 (back-loaded). A secondary small column shows the **2025 index** for stability (same formula on 2025 tuples).
- **Interactions.** Click → cross-filter. Tooltip: YTD 26, MAT 26, index 26 and 25, and the implied Sep–Dec share `(MAT−YTD)/MAT`.
- **Data & computation.** **New function** `computeSeasonalityIndex(indexed, filterState)` in `analyticsEngine.ts`: from `filterState.scopeRows` (respecting the non-double-counting level rule), sum tuple indices **12 vs 18** (YTD 2026 vs MAT 2026 value) and **11 vs 17** (2025) per ATC4/NFC1; units variant uses indices 9/15 and 8/14. Pure, unit-testable (add cases: zero MAT → null; new class → null).
- **Caveats.** This is an approximation of seasonality from two window definitions, not monthly data — say so in the subtitle. Keep it value-based (units optional toggle). A class whose index swings > 0.15 between 2025 and 2026 is more likely a disruption (listing/delisting) than seasonality — flag instability with a dot marker.

---

## 5. UX & Product Enhancements

### UX-1 · Per-chart export: PNG + CSV — `P1` · Effort `S`

Every ECharts visual gets `toolbox: { feature: { saveAsImage: { name: \`HPG_<section>_<period>_<measure>\`, backgroundColor: theme-aware } } }` — centralise it in one exported `CHART_TOOLBOX(theme)` constant to avoid 10 copies. Add a small "CSV" button per chart card that serialises the plotted series (chart components already hold the data arrays; reuse the quoting logic from the table's CSV exporter). This is what turns a finding into an appendix slide. Filename convention: `HPG_SecK_ClassAttractiveness_mat_value.png`.

### UX-2 · Saved views / watchlists — `P1` · Effort `M`

Named, user-created filter presets ("My chronic classes", "Respiratory top-20", "Launch review") stored in `localStorage` as snapshots of `{ period, measure, selections, groupBy, shareBasis, tab }`. UI: a "Views ▾" dropdown in `HeaderBar` (Save current view / Apply / Rename / Delete). Sharing remains URL-based — a preset can also emit its URL via the existing `syncStateToUrl` encoder, so a saved view is always a shareable link. This converts the dashboard from a data explorer into a weekly ritual tool.

### UX-3 · Guided story mode — `P2` · Effort `M`

A "▶ Play market story" button that walks a fixed sequence of 6–8 steps: each step applies a preset (filters + tab), scrolls to the target section, and shows a 2-line caption card (e.g. Step 3: "Value +16.3%, units +1.0% — growth is price. → Growth Drivers tab"). Steps are a static array of {preset, anchor, caption}; captions can reuse `executive.insights` phrasing. Primary value: onboarding new users and standardising the Monday review; secondary: a poor man's narrative report. Keyboard arrows advance/retreat; Esc exits.

### UX-4 · Print-friendly executive brief — `P2` · Effort `S`–`M`

A dedicated "Export brief" action (or `/brief` route) rendering only: the 4 KPI cards, the insights strip (QW-2), the top-10 movers table, and 3 user-pinned charts, with `@media print` rules (hide header/filters/tabs, force light theme, `page-break-inside: avoid` on cards, A4 margins). Brand managers forward PDFs more than URLs; this makes the forwarding self-service. Keep charts as ECharts screenshots (`getDataURL`) embedded into the print container.

### UX-5 · Table column chooser (+ mobile column diet) — `P2` · Effort `M`

The 18-column, `min-w-[1820px]` table is excellent on a 27" monitor and unusable on a laptop half-screen. Add a "Columns ▾" popover in the table controls bar (checkbox list, persisted in `localStorage`, plus 3 quick layouts: *Full / Board / Compact*). Below `lg`, auto-apply the Compact layout (name, rank, 2026, growth 26, Δ share, EI ≈ 6 columns) instead of forcing horizontal scroll. This is also the honest fix for the mobile experience without rebuilding the table.

### UX-6 · Scope snapshot compare (A/B) — `P3` · Effort `M`

A "📌 Pin snapshot" action that stores the current `executive` summary (+ label, e.g. "Respiratory MAT26"); after refining filters, a slim comparison banner shows old vs new: value, value growth, units growth, top-3 share, active brands, with deltas. Unpin at any time. Powers the everyday question "what did I just lose when I added that filter?" and informal A/B class comparisons without a second tab. Keep the snapshot in component state (not the store) so it never leaks into URL sharing.

---

## 6. Consolidated Priority Matrix

| ID | Recommendation | Priority | Effort | New computation needed | Suggested release |
|---|---|---|---|---|---|
| QW-1 | Mount GrowthDecompositionView (Sec C & F) | P0 | S | None (done) | R1 |
| QW-2 | Render insights strip | P0 | S | None (done) | R1 |
| QW-3 | Flagged/new-growth footnote | P0 | S | None (done) | R1 |
| QW-4 | Δ Share 25v24 + rel. change tooltip | P1 | S | None (done) | R1 |
| QW-5 | Click-to-filter on E1 & G1 | P1 | S | None | R1 |
| QW-6 | Persist theme | P2 | S | None | R1 |
| NC-1 | Class Attractiveness Matrix | P1 | M | None (join only) | R2 |
| NC-2 | Real vs Nominal panels (ATC1) | P1 | M | Index only | R2 |
| NC-4 | SOM vs SOG matrix | P1 | M | Share-of-growth (1 line) | R2 |
| NC-5 | EI'25 vs EI'26 quadrant | P1 | S | EI 2025 (reuse fn) | R2 |
| NC-7 | Price-Positioning Map | P1 | M | Price index, units share | R2 |
| UX-1 | Per-chart PNG + CSV export | P1 | S | None | R2 |
| UX-2 | Saved views / watchlists | P1 | M | None | R2 |
| NC-3 | Market Health Heatmap | P2 | M | Units CAGR, Δ total share | R3 |
| NC-8 | Price-Tier Migration | P2 | S | None (view of existing) | R3 |
| NC-9 | Portfolio Architecture Map | P2 | S | None | R3 |
| NC-10 | Launch Entry Positioning | P2 | S | Entry price index | R3 |
| NC-12 | Seasonality / Front-Load Index | P2 | M | New pure function | R3 |
| UX-3 | Story mode | P2 | M | Static step array | R3 |
| UX-4 | Print-friendly brief | P2 | S–M | None | R3 |
| UX-5 | Column chooser + compact layout | P2 | M | None | R3 |
| NC-6 | Brand ladder bump chart | P3 | M | Rank 24/25 (reuse fn) | R4 |
| NC-11 | Revenue Fragility Strip | P3 | S | Segment precedence rule | R4 |
| UX-6 | Snapshot A/B compare | P3 | M | None | R4 |

Release shape: **R1** = all quick wins (one PR, ~1 day, ships two whole report sections + trust features). **R2** = the five P1 charts + export + presets (the "brand manager power release"). **R3** = scanning and timing analytics + print/presets polish. **R4** = narrative and risk niceties.

---

## 7. Implementation Guardrails

Conventions the new code must inherit (all established in this repo):

1. **Scope integrity.** Any new aggregation reads `filterState.scopeRows` and honours `determineScopeAggregationLevel` — never sum mixed hierarchy levels (README §4).
2. **Growth honesty.** All growth display goes through `calcGrowth` / `GrowthMetric` (New badge, +999.0%+ cap, raw preserved for tooltips/CSV). Never render `Infinity` or hard `100%` for launches.
3. **Winsorisation is for colour only.** `winsoriseForColorScale` may bound axes and palettes; totals, tooltips, and CSVs always carry exact values (README §5.5).
4. **Interactivity parity.** Every chart: click-to-filter (`toggleFilterValue` / `drillToProductsInTable`), `cursor: 'pointer'`, exact-value tooltips, and dark/light theming via the store's `theme` (memoized options).
5. **Toggle awareness.** Declare per chart whether it reacts to `period` / `measure` and why not if it doesn't (NC-2 and NC-7 intentionally fix measures).
6. **Pure functions first.** New math (share-of-growth, EI 2025, seasonality index, price index) lives in `metrics.ts` / `analyticsEngine.ts` as pure, exported, Vitest-covered functions — extending the existing 19-test suite, not bypassing it.
7. **Performance discipline.** Derive chart series inside `useMemo` from the already-computed `analyticsBundle`; no component re-reads the 3.7 MB JSON or re-filters 16,492 rows on its own.

---

## 8. Adjacent Observations (Outside Selected Scope)

Noted during the audit but excluded from this roadmap per its scope (chart gaps + UX/product only):

- `echarts-for-react` imports the full ECharts bundle (~1.4 MB JS). Per-chart `echarts/core` registration would cut most of it.
- A stale `dist/` build is committed to the repo; the README also carries a garbled trailing title artifact (`# A u g 2 0 2 6 . M A T . Y T D`).
- Table header sorting is mouse-only and chart canvases carry no ARIA descriptions — keyboard/screen-reader gaps worth a dedicated accessibility pass.
- Tree search in `MainHierarchyTable` runs per keystroke without the debounce used elsewhere.

---

*End of roadmap. Suggested file location: `docs/ENHANCEMENTS.md`, next to `README.md` and `WORKLOG.md`.*
