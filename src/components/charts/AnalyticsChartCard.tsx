import React, { useRef } from 'react';
import { AlertCircle, Camera, Download, Info } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';

export type CsvRowObject = Record<string, string | number | boolean | null | undefined>;

export function exportRowsToCsv(
  filename: string,
  headersOrRows: string[] | CsvRowObject[],
  rows?: (string | number | boolean | null | undefined)[][]
) {
  if (typeof window === 'undefined') return;
  const esc = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  let headers: string[] = [];
  let matrix: (string | number | boolean | null | undefined)[][] = [];

  if (Array.isArray(rows)) {
    headers = headersOrRows as string[];
    matrix = rows;
  } else {
    const objRows = headersOrRows as CsvRowObject[];
    if (!objRows || objRows.length === 0) return;
    headers = Object.keys(objRows[0]);
    matrix = objRows.map((obj) => headers.map((h) => obj[h]));
  }

  const lines = [
    headers.map(esc).join(','),
    ...matrix.map((r) => r.map(esc).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function createChartToolbox(isDark: boolean, filenameBase: string) {
  return {
    show: true,
    right: 6,
    top: -4,
    iconStyle: {
      borderColor: isDark ? '#94a3b8' : '#64748b',
    },
    emphasis: {
      iconStyle: {
        borderColor: '#6366f1',
      },
    },
    feature: {
      saveAsImage: {
        type: 'png' as const,
        name: filenameBase,
        title: 'Save PNG',
        pixelRatio: 2,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
      },
    },
  };
}

export interface AnalyticsChartCardProps {
  id?: string;
  sectionTag?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  periodMode?: 'reactive' | 'both_windows';
  measureMode?: 'reactive' | 'fixed_value' | 'dual_measures';
  periodBadge?: string;
  measureBadge?: string;
  alertBanner?: React.ReactNode;
  footnote?: React.ReactNode;
  controls?: React.ReactNode;
  onExportCsv?: () => void;
  csvRows?: CsvRowObject[];
  exportFilename?: string;
  echartsRef?: React.RefObject<any>;
  className?: string;
  children: React.ReactNode;
}

export const AnalyticsChartCard: React.FC<AnalyticsChartCardProps> = ({
  id,
  sectionTag,
  title,
  subtitle,
  icon,
  periodMode = 'reactive',
  measureMode = 'reactive',
  periodBadge,
  measureBadge,
  alertBanner,
  footnote,
  controls,
  onExportCsv,
  csvRows,
  exportFilename = 'HPG_Chart',
  echartsRef,
  className = '',
  children,
}) => {
  const { period, measure, theme } = useMarketStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  const fullExportName = `${exportFilename}_${period}_${measure}`;

  const handleDownloadPng = () => {
    const inst = echartsRef?.current?.getEchartsInstance?.();
    if (inst) {
      const dataUrl = inst.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fullExportName}.png`;
      a.click();
      return;
    }
    // Fallback: find canvas inside cardRef
    const canvas = cardRef.current?.querySelector('canvas');
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fullExportName}.png`;
      a.click();
    }
  };

  const handleCsvExport = () => {
    if (onExportCsv) {
      onExportCsv();
      return;
    }
    if (csvRows && csvRows.length > 0) {
      exportRowsToCsv(fullExportName, csvRows);
    }
  };

  const hasCsvExport = Boolean(onExportCsv || (csvRows && csvRows.length > 0));

  return (
    <div
      id={id}
      ref={cardRef}
      className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] flex flex-col scroll-mt-20 print:break-inside-avoid ${className}`}
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-start justify-between gap-2.5 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {icon}
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              {title}
            </h3>
            {sectionTag && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/25">
                {sectionTag}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right: Sensitivity Badges + Custom Controls + Export Buttons (UX-1) */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 print:hidden">
          {/* Toggle sensitivity indicators (Guardrail 5) */}
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700"
            title={
              periodBadge || periodMode === 'both_windows'
                ? 'Compares YTD Aug against MAT Aug simultaneously'
                : `Reacts to global period toggle (currently ${period.toUpperCase()} Aug)`
            }
          >
            {periodBadge ?? (periodMode === 'both_windows' ? 'YTD÷MAT' : period.toUpperCase())}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
              measureMode === 'fixed_value'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
                : measureBadge || measureMode === 'dual_measures'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/25'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25'
            }`}
            title={
              measureMode === 'fixed_value'
                ? 'Intentionally fixed to LC Value (EGP) for price evaluation'
                : measureBadge || measureMode === 'dual_measures'
                ? 'Evaluates multiple measure dimensions simultaneously'
                : `Reacts to global measure toggle (currently ${
                    measure === 'value' ? 'LC Value' : 'Units'
                  })`
            }
          >
            {measureBadge ??
              (measureMode === 'fixed_value'
                ? 'LC Value (Fixed)'
                : measureMode === 'dual_measures'
                ? 'Value + Units'
                : measure === 'value'
                ? 'LC Value'
                : 'Units')}
          </span>

          {controls}

          {/* PNG Export */}
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
            title={`Download high-resolution PNG (${fullExportName}.png)`}
          >
            <Camera className="w-3 h-3" />
            <span>PNG</span>
          </button>

          {/* CSV Export */}
          {hasCsvExport && (
            <button
              type="button"
              onClick={handleCsvExport}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors"
              title={`Export plotted series data to CSV (${fullExportName}.csv)`}
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Contextual Edge-Case Alert Banner */}
      {alertBanner && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">{alertBanner}</div>
        </div>
      )}

      {/* Main Chart Body */}
      <div className="flex-1 flex flex-col">{children}</div>

      {/* Optional Footnote (Excluded zero-base count / methodology) */}
      {footnote && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">{footnote}</div>
        </div>
      )}
    </div>
  );
};
