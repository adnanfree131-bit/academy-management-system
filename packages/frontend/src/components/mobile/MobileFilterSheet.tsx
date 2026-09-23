import React from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, RotateCcw } from 'lucide-react';
import { useMobileOverlay } from '../../lib/mobileOverlay';

export interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  activeFilterCount: number;
  totalResultsCount?: number;
  resultsLabel?: string;
  onReset: () => void;
  onApply?: () => void;
  children: React.ReactNode;
  testId?: string;
}

export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  isOpen,
  onClose,
  title = 'Filters & Grouping',
  subtitle,
  activeFilterCount,
  totalResultsCount,
  resultsLabel = 'Students',
  onReset,
  onApply,
  children,
  testId = 'mobile-filter-sheet',
}) => {
  // Register with mobile back-button stack
  useMobileOverlay('sheet', isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center p-0 m-0 mobile-sheet"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid={testId}
    >
      <div
        className="bg-white rounded-t-3xl border-t border-slate-300 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col mobile-sheet-card max-h-[88dvh]"
        role="dialog"
        aria-modal="true"
        data-testid="mobile-filter-sheet-card"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm leading-tight">
                  {title}
                </h3>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            data-testid="filter-sheet-close"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-300 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Filter Form Body */}
        <div className="p-4 overflow-y-auto space-y-4 divide-y divide-slate-100">
          {children}
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            data-testid="filter-sheet-reset"
            onClick={onReset}
            disabled={activeFilterCount === 0}
            className="flex-1 min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-press"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            data-testid="filter-sheet-apply"
            onClick={() => {
              if (onApply) onApply();
              onClose();
            }}
            className="flex-2 min-h-[48px] px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer touch-press"
          >
            <span>
              Apply Filters
              {typeof totalResultsCount === 'number'
                ? ` (Show ${totalResultsCount} ${resultsLabel})`
                : ''}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export interface FilterPillButtonProps {
  activeCount: number;
  onClick: () => void;
  label?: string;
  className?: string;
  testId?: string;
}

export const FilterPillButton: React.FC<FilterPillButtonProps> = ({
  activeCount,
  onClick,
  label = 'Filter',
  className = '',
  testId = 'filter-pill-button',
}) => {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-press shrink-0 ${
        activeCount > 0
          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs font-bold'
          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
      } ${className}`}
      aria-label={`Open filters. ${activeCount} active`}
    >
      <Filter className={`w-3.5 h-3.5 ${activeCount > 0 ? 'text-white' : 'text-slate-500'}`} />
      <span>{label}</span>
      {activeCount > 0 && (
        <span className="w-5 h-5 rounded-full bg-white text-amber-700 text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
          {activeCount}
        </span>
      )}
    </button>
  );
};

export interface FilterChipGroupProps {
  label: string;
  countBadge?: number | string;
  children: React.ReactNode;
  className?: string;
}

export const FilterChipGroup: React.FC<FilterChipGroupProps> = ({
  label,
  countBadge,
  children,
  className = '',
}) => {
  return (
    <div className={`pt-3 first:pt-0 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
          {label}
        </span>
        {countBadge !== undefined && (
          <span className="text-[10px] text-slate-400 font-mono">
            {countBadge}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
        {children}
      </div>
    </div>
  );
};

export interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  highlight?: boolean;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  selected,
  onClick,
  label,
  count,
}) => {
  return (
    <button
      type="button"
      data-testid={`filter-chip-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
      onClick={onClick}
      className={`min-h-[34px] px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer touch-press flex items-center gap-1.5 shrink-0 border ${
        selected
          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
          : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700 border-slate-200/80'
      }`}
    >
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={`text-[10px] font-mono px-1 rounded-full ${
            selected ? 'bg-slate-800 text-slate-200' : 'bg-slate-200/70 text-slate-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};
