import React, { useMemo, useRef, useState } from 'react';
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  FolderTree,
  Layers,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { TableNode, TableViewData } from '../lib/aggregationEngine';
import {
  formatCompactValue,
  formatDecimalPct,
  formatEvolutionIndex,
  formatExactValue,
  formatGrowthMetric,
  formatPp,
  formatPriceEgp,
  formatSharePct,
} from '../lib/formatters';
import type { GrowthMetric } from '../lib/metrics';
import { useMarketStore } from '../store/useMarketStore';
import type { GroupByMode, HierarchyLevel, ShareBasis } from '../types/market';

interface MainHierarchyTableProps {
  tableData: TableViewData;
}

const LEVEL_BADGE_STYLES: Record<HierarchyLevel, string> = {
  GrandTotal: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  ATC1: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  ATC4: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
  NFC1: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30',
  Product: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  Pack: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
};

const MiniSparkline: React.FC<{ v24: number; v25: number; v26: number }> = ({
  v24,
  v25,
  v26,
}) => {
  const vals = [v24, v25, v26];
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const pts = vals
    .map((v, idx) => {
      const x = 4 + idx * 18;
      const y = 18 - ((v - min) / range) * 14;
      return `${x},${y.toFixed(1)}`;
    })
    .join(' ');
  const isUp = v26 >= v25;
  const strokeColor = isUp ? '#10b981' : '#f43f5e';

  return (
    <svg width="44" height="22" className="overflow-visible shrink-0" aria-hidden="true">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
      <circle
        cx="40"
        cy={18 - ((v26 - min) / range) * 14}
        r="2.2"
        fill={strokeColor}
      />
    </svg>
  );
};

const GrowthCellView: React.FC<{
  metric: GrowthMetric;
  subText?: string;
}> = ({ metric, subText }) => {
  if (metric.status === 'null') {
    return <span className="text-slate-400 dark:text-slate-600 font-mono">—</span>;
  }
  if (metric.isNew) {
    return (
      <div className="flex flex-col items-end">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30">
          <Sparkles className="w-2.5 h-2.5" />
          New
        </span>
        {subText && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
            {subText}
          </span>
        )}
      </div>
    );
  }

  const val = metric.display ?? 0;
  const isPos = val > 0;
  const isNeg = val < 0;
  const color = isPos
    ? 'text-emerald-600 dark:text-emerald-400'
    : isNeg
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-slate-500 dark:text-slate-400';

  return (
    <div
      className="flex flex-col items-end"
      title={
        metric.isCapped && metric.raw !== null
          ? `Uncapped growth: +${(metric.raw * 100).toFixed(1)}% (capped at +999.0% for display)`
          : undefined
      }
    >
      <span className={`font-mono font-medium inline-flex items-center gap-1 ${color}`}>
        {metric.isCapped && (
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
        )}
        <span>{formatGrowthMetric(metric)}</span>
      </span>
      {subText && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-tight">
          {subText}
        </span>
      )}
    </div>
  );
};

function filterTreeBySearch(nodes: TableNode[], query: string): TableNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const result: TableNode[] = [];

  for (const node of nodes) {
    const selfMatches =
      node.name.toLowerCase().includes(q) ||
      (node.subtitle && node.subtitle.toLowerCase().includes(q)) ||
      node.productName.toLowerCase().includes(q) ||
      node.packName.toLowerCase().includes(q) ||
      node.atc4Name.toLowerCase().includes(q);

    if (node.children && node.children.length > 0) {
      const filteredChildren = filterTreeBySearch(node.children, query);
      if (selfMatches || filteredChildren.length > 0) {
        result.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      }
    } else if (selfMatches) {
      result.push(node);
    }
  }
  return result;
}

export const MainHierarchyTable: React.FC<MainHierarchyTableProps> = ({ tableData }) => {
  const {
    period,
    measure,
    groupBy,
    shareBasis,
    tableSearch,
    setGroupBy,
    setShareBasis,
    setTableSearch,
    toggleFilterValue,
  } = useMarketStore();

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'v2026', desc: true },
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const periodHeader = period === 'mat' ? 'MAT Aug' : 'YTD Aug';
  const measureHeader = measure === 'value' ? 'LC Value (EGP)' : 'Units';
  const complementaryLabel = measure === 'value' ? 'U:' : 'V:';

  const searchedNodes = useMemo(
    () => filterTreeBySearch(tableData.nodes, tableSearch.trim()),
    [tableData.nodes, tableSearch]
  );

  const columns = useMemo<ColumnDef<TableNode>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (row) => row.name,
        header: () => (
          <div className="flex items-center gap-1.5">
            <span>Product / Pack / Hierarchy Name</span>
          </div>
        ),
        size: 320,
        cell: ({ row }) => {
          const n = row.original;
          const canExpand = row.getCanExpand();
          const indentPx = row.depth * 18;

          return (
            <div
              className="flex items-center justify-between gap-2 min-w-0 pr-1"
              style={{ paddingLeft: `${indentPx}px` }}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {canExpand ? (
                  <button
                    type="button"
                    onClick={row.getToggleExpandedHandler()}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0"
                    title={row.getIsExpanded() ? 'Collapse Packs' : 'Expand Packs'}
                  >
                    {row.getIsExpanded() ? (
                      <ChevronDown className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  <span className="w-5 shrink-0" />
                )}

                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
                    LEVEL_BADGE_STYLES[n.level]
                  }`}
                >
                  {n.level === 'Product' ? 'PROD' : n.level === 'Pack' ? 'PACK' : n.level}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate"
                      title={n.name}
                    >
                      {n.name}
                    </span>
                    {n.packCount && n.level !== 'Pack' && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                        {n.packCount} {n.packCount === 1 ? 'pk' : 'pks'}
                      </span>
                    )}
                  </div>
                  {n.subtitle && (
                    <div
                      className="text-[10px] text-slate-400 dark:text-slate-500 truncate"
                      title={n.subtitle}
                    >
                      {n.subtitle}
                    </div>
                  )}
                </div>
              </div>

              {n.dimKey && n.dictIdx !== undefined && n.dictIdx >= 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFilterValue(n.dimKey!, n.dictIdx!);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-opacity shrink-0"
                  title={`Filter report by ${n.level}: ${n.name}`}
                >
                  <Filter className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        },
      },
      {
        id: 'rank',
        accessorFn: (row) => row.rank ?? 999999,
        header: 'Rank',
        size: 64,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {row.original.rank !== null ? `#${row.original.rank}` : '—'}
          </span>
        ),
      },
      {
        id: 'trend',
        accessorFn: (row) => row.v2026,
        enableSorting: false,
        header: '24→26',
        size: 64,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <MiniSparkline
              v24={row.original.v2024}
              v25={row.original.v2025}
              v26={row.original.v2026}
            />
          </div>
        ),
      },
      {
        id: 'v2024',
        accessorFn: (row) => row.v2024,
        header: `${periodHeader} 2024`,
        size: 98,
        cell: ({ row }) => (
          <span
            className="font-mono text-xs text-slate-700 dark:text-slate-300"
            title={formatExactValue(row.original.v2024, measure)}
          >
            {formatCompactValue(row.original.v2024, measure)}
          </span>
        ),
      },
      {
        id: 'v2025',
        accessorFn: (row) => row.v2025,
        header: `${periodHeader} 2025`,
        size: 98,
        cell: ({ row }) => (
          <span
            className="font-mono text-xs text-slate-700 dark:text-slate-300"
            title={formatExactValue(row.original.v2025, measure)}
          >
            {formatCompactValue(row.original.v2025, measure)}
          </span>
        ),
      },
      {
        id: 'v2026',
        accessorFn: (row) => row.v2026,
        header: `${periodHeader} 2026`,
        size: 106,
        cell: ({ row }) => (
          <span
            className="font-mono text-xs font-bold text-slate-900 dark:text-white"
            title={formatExactValue(row.original.v2026, measure)}
          >
            {formatCompactValue(row.original.v2026, measure)}
          </span>
        ),
      },
      {
        id: 'growth24Source',
        accessorFn: (row) => row.growth24Source.raw ?? -999999,
        header: 'Growth 24 (vs 2023 src)',
        size: 102,
        cell: ({ row }) => <GrowthCellView metric={row.original.growth24Source} />,
      },
      {
        id: 'growth25',
        accessorFn: (row) =>
          row.growth25.isNew ? 1000000 : row.growth25.raw ?? -999999,
        header: 'Growth 25',
        size: 92,
        cell: ({ row }) => <GrowthCellView metric={row.original.growth25} />,
      },
      {
        id: 'growth26',
        accessorFn: (row) =>
          row.growth26.isNew ? 1000000 : row.growth26.raw ?? -999999,
        header: 'Growth 26',
        size: 108,
        cell: ({ row }) => {
          const n = row.original;
          const compMetric =
            measure === 'value' ? n.unitsGrowth26 : n.valueGrowth26;
          const compText = `${complementaryLabel} ${formatGrowthMetric(compMetric)}`;
          return <GrowthCellView metric={n.growth26} subText={compText} />;
        },
      },
      {
        id: 'cagr24_26',
        accessorFn: (row) => row.cagr24_26.raw ?? -999999,
        header: '2-yr CAGR, Aug-24 to Aug-26',
        size: 118,
        cell: ({ row }) => <GrowthCellView metric={row.original.cagr24_26} />,
      },
      {
        id: 'share24',
        accessorFn: (row) => row.share24 ?? -1,
        header: 'Share 24',
        size: 82,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
            {formatSharePct(row.original.share24)}
          </span>
        ),
      },
      {
        id: 'share25',
        accessorFn: (row) => row.share25 ?? -1,
        header: 'Share 25',
        size: 82,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
            {formatSharePct(row.original.share25)}
          </span>
        ),
      },
      {
        id: 'share26',
        accessorFn: (row) =>
          shareBasis === 'parent'
            ? row.parentShare26 ?? -1
            : shareBasis === 'total'
            ? row.totalMarketShare26 ?? -1
            : row.share26 ?? -1,
        header:
          shareBasis === 'parent'
            ? 'Share 26 (Parent)'
            : shareBasis === 'total'
            ? 'Share 26 (Total)'
            : 'Share 26 (Scope)',
        size: 104,
        cell: ({ row }) => {
          const n = row.original;
          const primaryShare =
            shareBasis === 'parent'
              ? n.parentShare26
              : shareBasis === 'total'
              ? n.totalMarketShare26
              : n.share26;
          return (
            <div
              className="flex flex-col items-end"
              title={`Scope Share: ${formatSharePct(n.share26)} | Parent Share: ${formatSharePct(n.parentShare26)} | Total Market Share: ${formatSharePct(n.totalMarketShare26)}`}
            >
              <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                {formatSharePct(primaryShare)}
              </span>
              {shareBasis !== 'parent' && n.depth > 0 && (
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  Par: {formatSharePct(n.parentShare26)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'totalMarketShare26',
        accessorFn: (row) => row.totalMarketShare26 ?? -1,
        header: 'Share of Total Mkt',
        size: 98,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-indigo-600 dark:text-indigo-300">
            {formatSharePct(row.original.totalMarketShare26)}
          </span>
        ),
      },
      {
        id: 'deltaShare26_25Pp',
        accessorFn: (row) => row.deltaShare26_25Pp ?? -999999,
        header: 'Δ Share pp (26v25)',
        size: 104,
        cell: ({ row }) => {
          const d = row.original.deltaShare26_25Pp;
          if (d === null) return <span className="font-mono text-slate-500">—</span>;
          const color =
            d > 0.005
              ? 'text-emerald-600 dark:text-emerald-400'
              : d < -0.005
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-500 dark:text-slate-400';
          return (
            <span className={`font-mono text-xs font-medium ${color}`}>
              {formatPp(d, 2)}
            </span>
          );
        },
      },
      {
        id: 'evolutionIndex26',
        accessorFn: (row) => row.evolutionIndex26 ?? -999999,
        header: 'Evolution Index',
        size: 98,
        cell: ({ row }) => {
          const ei = row.original.evolutionIndex26;
          if (ei === null) return <span className="font-mono text-slate-500">—</span>;
          const isOutgrowing = ei >= 100;
          return (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs font-semibold ${
                isOutgrowing
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
              }`}
            >
              {formatEvolutionIndex(ei)}
            </span>
          );
        },
      },
      {
        id: 'priceMix',
        accessorFn: (row) => row.avgPrice26 ?? -1,
        header: 'Avg Price & P/Mix',
        size: 108,
        cell: ({ row }) => {
          const n = row.original;
          return (
            <div className="flex flex-col items-end">
              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                {formatPriceEgp(n.avgPrice26)}
              </span>
              <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
                P/M: {formatDecimalPct(n.priceMixGrowth26, 1)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'momentum26',
        accessorFn: (row) => row.momentum26 ?? -999999,
        header: 'Momentum (YTD-MAT)',
        size: 108,
        cell: ({ row }) => {
          const mom = row.original.momentum26;
          if (mom === null) return <span className="font-mono text-slate-500">—</span>;
          const pp = mom * 100;
          const color =
            pp > 0.1
              ? 'text-emerald-600 dark:text-emerald-400'
              : pp < -0.1
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-500';
          return (
            <span className={`font-mono text-xs ${color}`}>
              {formatPp(pp, 1)}
            </span>
          );
        },
      },
    ],
    [periodHeader, measure, complementaryLabel, shareBasis, toggleFilterValue]
  );

  const table = useReactTable({
    data: searchedNodes,
    columns,
    state: {
      sorting,
      expanded,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const { rows: tableRows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 46,
    overscan: 16,
  });

  const handleExportCsv = () => {
    const headers = [
      'Level',
      'Name',
      'ATC1',
      'ATC4',
      'NFC1',
      'Product',
      'Pack',
      'Rank',
      `${periodHeader} 2024 (${measureHeader})`,
      `${periodHeader} 2025 (${measureHeader})`,
      `${periodHeader} 2026 (${measureHeader})`,
      'Growth 24 vs 2023 (source) %',
      'Growth 25 %',
      'Growth 26 %',
      '2-yr CAGR Aug-24 to Aug-26 %',
      'Share 24 %',
      'Share 25 %',
      'Share 26 (Scope) %',
      'Share 26 (Total Market) %',
      'Delta Share (26 vs 25) pp',
      'Evolution Index 26',
      'Avg Price 2026 (EGP)',
      'Price/Mix Growth 26 %',
      'Momentum (YTD - MAT) pp',
    ];

    const lines = [headers.join(',')];
    const esc = (s: string | number | null | undefined) => {
      if (s === null || s === undefined) return '';
      const str = String(s).replace(/"/g, '""');
      return `"${str}"`;
    };

    for (const r of tableRows) {
      const n = r.original;
      lines.push(
        [
          esc(n.level),
          esc(n.name),
          esc(n.atc1Name),
          esc(n.atc4Name),
          esc(n.nfc1Name),
          esc(n.productName),
          esc(n.packName),
          n.rank ?? '',
          n.v2024.toFixed(2),
          n.v2025.toFixed(2),
          n.v2026.toFixed(2),
          n.growth24Source.isNew
            ? 'New'
            : n.growth24Source.raw !== null
            ? (n.growth24Source.raw * 100).toFixed(2)
            : '',
          n.growth25.isNew
            ? 'New'
            : n.growth25.raw !== null
            ? (n.growth25.raw * 100).toFixed(2)
            : '',
          n.growth26.isNew
            ? 'New'
            : n.growth26.raw !== null
            ? (n.growth26.raw * 100).toFixed(2)
            : '',
          n.cagr24_26.raw !== null ? (n.cagr24_26.raw * 100).toFixed(2) : '',
          n.share24 !== null ? (n.share24 * 100).toFixed(4) : '',
          n.share25 !== null ? (n.share25 * 100).toFixed(4) : '',
          n.share26 !== null ? (n.share26 * 100).toFixed(4) : '',
          n.totalMarketShare26 !== null
            ? (n.totalMarketShare26 * 100).toFixed(4)
            : '',
          n.deltaShare26_25Pp !== null ? n.deltaShare26_25Pp.toFixed(3) : '',
          n.evolutionIndex26 !== null ? n.evolutionIndex26.toFixed(2) : '',
          n.avgPrice26 !== null ? n.avgPrice26.toFixed(2) : '',
          n.priceMixGrowth26 !== null
            ? (n.priceMixGrowth26 * 100).toFixed(2)
            : '',
          n.momentum26 !== null ? (n.momentum26 * 100).toFixed(2) : '',
        ].join(',')
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IQVIA_Egypt_${period.toUpperCase()}_${measure}_${groupBy}_Aug2026.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tot = tableData.totalNode;
  const isTreeMode = groupBy === 'tree_product_pack' || groupBy === 'tree_full';
  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden flex flex-col">
      {/* Table Controls Bar */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-950/50">
        {/* Left: Group By / Tree Selector + Expand/Collapse */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <FolderTree className="w-4 h-4 text-indigo-500" />
            <span>Hierarchy / Group By:</span>
          </div>

          <select
            value={groupBy}
            onChange={(e) => {
              setExpanded({});
              setGroupBy(e.target.value as GroupByMode);
            }}
            aria-label="Group By Hierarchy Mode"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="tree_product_pack">
              Product &gt; Pack (Expandable Brand Tree — Default)
            </option>
            <option value="Product">Flat: Product (Brand Level)</option>
            <option value="Pack">Flat: Pack Presentation Level</option>
            <option value="tree_full">
              Full Tree: ATC1 &gt; ATC4 &gt; NFC1 &gt; Product &gt; Pack
            </option>
            <option value="NFC1">Flat: NFC1 Dosage Form</option>
            <option value="ATC4">Flat: ATC4 Therapeutic Subclass</option>
            <option value="ATC1">Flat: ATC1 Anatomical Main Group</option>
          </select>

          {isTreeMode && (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => table.toggleAllRowsExpanded(true)}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-300 border border-slate-200 dark:border-slate-700"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={() => table.toggleAllRowsExpanded(false)}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
              >
                Collapse All
              </button>
            </div>
          )}

          {/* Share Basis Selector */}
          <div className="flex items-center gap-1.5 ml-1">
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Share Basis:</span>
            <select
              value={shareBasis}
              onChange={(e) => setShareBasis(e.target.value as ShareBasis)}
              aria-label="Market Share Denominator Basis"
              className="px-2 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            >
              <option value="scope">Current Filter Scope</option>
              <option value="parent">Immediate Parent Node</option>
              <option value="total">Unfiltered Total Egypt Market</option>
            </select>
          </div>
        </div>

        {/* Right: Search Input + Row Count + CSV Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64 sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search product, pack, or class..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {tableSearch && (
              <button
                type="button"
                onClick={() => setTableSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {tableRows.length.toLocaleString()} visible rows
          </span>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Column Group Banner showing active Period & Measure (no layout shift on toggle) */}
      <div className="px-4 py-1.5 bg-indigo-950/30 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Active Column Set: {periodHeader} • {measureHeader}
          </span>
          <span className="text-slate-400 dark:text-slate-500">|</span>
          <span>
            Secondary subtitle in Growth 26 shows complementary{' '}
            {measure === 'value' ? 'Units Growth %' : 'LC Value Growth %'}
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          Scope Total 2026: <strong className="text-slate-900 dark:text-white">{formatExactValue(tot.v2026, measure)}</strong>
        </div>
      </div>

      {/* Virtualized Table Scroll Container */}
      <div
        ref={tableContainerRef}
        className="h-[620px] overflow-auto relative overscroll-contain"
      >
        <table className="w-full border-separate border-spacing-0 text-left table-fixed min-w-[1820px]">
          {/* Sticky Header + Pinned Scope Totals Row */}
          <thead className="sticky top-0 z-30 shadow-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, colIdx) => {
                  const isStickyFirst = colIdx === 0;
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      onClick={
                        canSort ? header.column.getToggleSortingHandler() : undefined
                      }
                      className={`py-2.5 px-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100 bg-slate-200 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 select-none align-middle ${
                        canSort
                          ? 'cursor-pointer hover:bg-slate-300/80 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors'
                          : ''
                      } ${
                        isStickyFirst
                          ? 'sticky left-0 z-40 border-r border-slate-300 dark:border-slate-700 text-left'
                          : 'text-right border-r border-slate-300/50 dark:border-slate-800/80'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          isStickyFirst ? 'justify-start' : 'justify-end w-full'
                        }`}
                      >
                        <span className="whitespace-normal leading-tight">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </span>
                        {canSort && (
                          <span className="shrink-0">
                            {sorted === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}

            {/* Pinned Scope Totals Row right beneath the header */}
            <tr className="font-semibold text-xs">
              <td className="sticky left-0 z-40 bg-indigo-50 dark:bg-slate-900 px-3 py-2 border-r border-slate-300 dark:border-slate-700 border-b-2 border-b-indigo-500/50">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-600 text-white">
                    TOTAL
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Filtered Scope Total ({searchedNodes.length.toLocaleString()} top items)
                  </span>
                </div>
              </td>
              <td className="px-2.5 py-2 text-right font-mono text-slate-400 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                —
              </td>
              <td className="px-2.5 py-2 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                <div className="flex justify-end">
                  <MiniSparkline v24={tot.v2024} v25={tot.v2025} v26={tot.v2026} />
                </div>
              </td>
              <td
                className="px-2.5 py-2 text-right font-mono text-slate-800 dark:text-slate-200 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50"
                title={formatExactValue(tot.v2024, measure)}
              >
                {formatCompactValue(tot.v2024, measure)}
              </td>
              <td
                className="px-2.5 py-2 text-right font-mono text-slate-800 dark:text-slate-200 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50"
                title={formatExactValue(tot.v2025, measure)}
              >
                {formatCompactValue(tot.v2025, measure)}
              </td>
              <td
                className="px-2.5 py-2 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50"
                title={formatExactValue(tot.v2026, measure)}
              >
                {formatCompactValue(tot.v2026, measure)}
              </td>
              <td className="px-2.5 py-2 text-right bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                <GrowthCellView metric={tot.growth24Source} />
              </td>
              <td className="px-2.5 py-2 text-right bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                <GrowthCellView metric={tot.growth25} />
              </td>
              <td className="px-2.5 py-2 text-right bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                <GrowthCellView
                  metric={tot.growth26}
                  subText={`${complementaryLabel} ${formatGrowthMetric(
                    measure === 'value' ? tot.unitsGrowth26 : tot.valueGrowth26
                  )}`}
                />
              </td>
              <td className="px-2.5 py-2 text-right bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                <GrowthCellView metric={tot.cagr24_26} />
              </td>
              <td className="px-2.5 py-2 text-right font-mono text-slate-700 dark:text-slate-300 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                100.00%
              </td>
              <td className="px-2.5 py-2 text-right font-mono text-slate-700 dark:text-slate-300 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                100.00%
              </td>
              <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-900 dark:text-white bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                100.00%
              </td>
              <td className="px-2.5 py-2 text-right font-mono text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                {formatSharePct(tot.totalMarketShare26)}
              </td>
              <td className="px-2.5 py-2 text-right font-mono text-slate-500 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                0.00 pp
              </td>
              <td className="px-2.5 py-2 text-right font-mono text-slate-700 dark:text-slate-300 bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                100.0
              </td>
              <td className="px-2.5 py-2 text-right font-mono text-xs bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                <div className="flex flex-col items-end">
                  <span>{formatPriceEgp(tot.avgPrice26)}</span>
                  <span className="text-[10px] text-amber-500">
                    P/M: {formatDecimalPct(tot.priceMixGrowth26, 1)}
                  </span>
                </div>
              </td>
              <td className="px-2.5 py-2 text-right font-mono text-xs bg-indigo-50 dark:bg-slate-900 border-b-2 border-b-indigo-500/50">
                {tot.momentum26 !== null ? formatPp(tot.momentum26 * 100, 1) : '—'}
              </td>
            </tr>
          </thead>

          {/* Virtualized Body using in-flow spacer rows for rock-solid table layout */}
          <tbody>
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={columns.length}
                  style={{ height: `${paddingTop}px`, padding: 0, border: 0 }}
                />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              const isChild = row.depth > 0;

              return (
                <tr
                  key={row.id}
                  style={{ height: `${virtualRow.size}px` }}
                  className={`group transition-colors ${
                    isChild
                      ? 'bg-slate-50 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  {row.getVisibleCells().map((cell, colIdx) => {
                    const isStickyFirst = colIdx === 0;
                    return (
                      <td
                        key={cell.id}
                        style={{ width: `${cell.column.getSize()}px` }}
                        className={`px-2.5 py-1.5 align-middle border-b border-slate-100 dark:border-slate-800/70 ${
                          isStickyFirst
                            ? `sticky left-0 z-10 border-r border-slate-200 dark:border-slate-800 text-left overflow-hidden ${
                                isChild
                                  ? 'bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
                                  : 'bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900'
                              }`
                            : 'text-right'
                        }`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={columns.length}
                  style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
