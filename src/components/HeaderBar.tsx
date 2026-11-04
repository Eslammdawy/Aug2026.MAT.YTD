import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  DollarSign,
  Edit3,
  Link2,
  Moon,
  Package,
  Plus,
  Printer,
  Share2,
  Sun,
  Trash2,
} from 'lucide-react';
import hpgLogo from '../../HPG logo.jpg';
import { buildShareUrlForPreset, useMarketStore } from '../store/useMarketStore';

export const HeaderBar: React.FC = () => {
  const {
    indexed,
    period,
    measure,
    theme,
    savedViews,
    setPeriod,
    setMeasure,
    toggleTheme,
    saveCurrentView,
    applySavedView,
    renameSavedView,
    deleteSavedView,
  } = useMarketStore();

  const [copied, setCopied] = useState(false);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [copiedPresetId, setCopiedPresetId] = useState<string | null>(null);
  const viewsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (viewsMenuRef.current && !viewsMenuRef.current.contains(e.target as Node)) {
        setViewsOpen(false);
      }
    };
    if (viewsOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [viewsOpen]);

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateSavedView = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newViewName.trim();
    if (!trimmed) return;
    saveCurrentView(trimmed);
    setNewViewName('');
  };

  const handleCopyPresetUrl = (preset: any) => {
    const url = buildShareUrlForPreset(preset);
    if (!url || typeof navigator === 'undefined') return;
    navigator.clipboard.writeText(url);
    setCopiedPresetId(preset.id);
    setTimeout(() => setCopiedPresetId(null), 1800);
  };

  const meta = indexed?.dataset.meta;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md transition-colors no-print">
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Period Toggle: MAT | YTD */}
          <div
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            role="group"
            aria-label="Time Period Toggle"
          >
            <button
              type="button"
              onClick={() => setPeriod('mat')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
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
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
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

          {/* UX-2: Saved Views / Custom Watchlists Dropdown */}
          <div className="relative" ref={viewsMenuRef}>
            <button
              type="button"
              onClick={() => setViewsOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                viewsOpen || savedViews.length > 0
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-500/50'
              }`}
              title="Manage custom saved views and brand watchlists"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Views</span>
              {savedViews.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-mono">
                  {savedViews.length}
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {viewsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-3 z-50">
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                  <span>Saved Watchlists &amp; Views</span>
                  <span className="text-[10px] font-mono text-slate-400">localStorage</span>
                </div>

                {/* Save Current View Form */}
                <form onSubmit={handleCreateSavedView} className="flex items-center gap-1.5 mb-3">
                  <input
                    type="text"
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    placeholder="Name current filter & tab view…"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </form>

                {savedViews.length === 0 ? (
                  <div className="py-4 px-2 text-center text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    No saved views yet. Filter to any therapeutic class or brand portfolio and click{' '}
                    <b>Save</b> to bookmark it.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pt-1 border-t border-slate-100 dark:border-slate-800">
                    {savedViews.map((v) => (
                      <div
                        key={v.id}
                        className="p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-2"
                      >
                        {editingViewId === v.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              renameSavedView(v.id, editingName);
                              setEditingViewId(null);
                            }}
                            className="flex items-center gap-1 flex-1"
                          >
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="flex-1 px-2 py-0.5 text-xs rounded bg-white dark:bg-slate-900 border border-indigo-400 text-slate-900 dark:text-white"
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold"
                            >
                              OK
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              applySavedView(v.id);
                              setViewsOpen(false);
                            }}
                            className="text-left flex-1 min-w-0 group"
                          >
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                              {v.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              {v.period.toUpperCase()} • {v.measure.toUpperCase()}
                            </div>
                          </button>
                        )}

                        <div className="inline-flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyPresetUrl(v)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                            title="Copy shareable link for this saved view"
                          >
                            {copiedPresetId === v.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Link2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingViewId(v.id);
                              setEditingName(v.name);
                            }}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                            title="Rename view"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedView(v.id)}
                            className="p-1 rounded hover:bg-rose-500/15 text-slate-400 hover:text-rose-500"
                            title="Delete saved view"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* UX-4: Print-Friendly Executive Brief Button */}
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors"
            title="Print A4 Executive Brief (KPIs, Key Insights, Table & Active Charts)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Print Brief</span>
          </button>

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
                <span className="hidden sm:inline">Share</span>
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
