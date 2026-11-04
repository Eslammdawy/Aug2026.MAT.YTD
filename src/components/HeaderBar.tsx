import React, { useState } from 'react';
import {
  Check,
  DollarSign,
  Moon,
  Package,
  Share2,
  Sun,
} from 'lucide-react';
import hpgLogo from '../../HPG logo.jpg';
import { useMarketStore } from '../store/useMarketStore';

export const HeaderBar: React.FC = () => {
  const {
    indexed,
    period,
    measure,
    theme,
    setPeriod,
    setMeasure,
    toggleTheme,
  } = useMarketStore();

  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const meta = indexed?.dataset.meta;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md transition-colors">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 min-h-16 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand Identity & Scope Metadata */}
        <div className="flex items-center gap-3 min-w-0 h-16">
          <div className="h-full aspect-square rounded-lg bg-white overflow-hidden flex items-center justify-center shadow-sm border border-slate-200/80 dark:border-slate-700/80 shrink-0">
            <img
              src={hpgLogo}
              alt="Hefny Pharma Group (HPG) Logo"
              className="w-full h-full object-contain scale-[1.38]"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
                IQVIA Egypt Pharma Market Intelligence
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                Aug 2024 – Aug 2026
              </span>
            </div>
            {meta && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {meta.uniqueCounts.product.toLocaleString()} Products •{' '}
                {meta.uniqueCounts.pack.toLocaleString()} Packs •{' '}
                {meta.uniqueCounts.atc4.toLocaleString()} ATC4 Classes •{' '}
                {meta.sourceRowCount.toLocaleString()} Hierarchy Rows (LC = EGP)
              </p>
            )}
          </div>
        </div>

        {/* Right: Global Segmented Toggles (MAT | YTD and LC Value | Units) + Utilities */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Period Toggle: MAT | YTD */}
          <div
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            role="group"
            aria-label="Time Period Toggle"
          >
            <button
              type="button"
              onClick={() => setPeriod('mat')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                period === 'mat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Moving Annual Total (12 months ending Aug)"
            >
              MAT Aug
            </button>
            <button
              type="button"
              onClick={() => setPeriod('ytd')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                period === 'ytd'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Year-to-Date (Jan–Aug)"
            >
              YTD Aug
            </button>
          </div>

          {/* Measure Toggle: LC Value | Units */}
          <div
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            role="group"
            aria-label="Measure Toggle"
          >
            <button
              type="button"
              onClick={() => setMeasure('value')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                measure === 'value'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Local Currency Value (Egyptian Pounds - EGP)"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>LC Value (EGP)</span>
            </button>
            <button
              type="button"
              onClick={() => setMeasure('units')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                measure === 'units'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Unit Volume"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Units</span>
            </button>
          </div>

          {/* Shareable URL button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors"
            title="Copy shareable link with current filters and view state"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline text-emerald-500">Copied URL</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share View</span>
              </>
            )}
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
