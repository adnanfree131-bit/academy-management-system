import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart2, ChevronDown, X } from 'lucide-react';
import { useMobileOverlay } from '../../lib/mobileOverlay';

export interface GlanceableKpiItem {
  label: string;
  value: string | number;
  highlight?: boolean;
  color?: string;
}

export interface GlanceableKpiStripProps {
  items: GlanceableKpiItem[];
  insightsTitle?: string;
  insightsSubtitle?: string;
  children?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  testId?: string;
}

export const GlanceableKpiStrip: React.FC<GlanceableKpiStripProps> = ({
  items,
  insightsTitle = 'Operational Insights',
  insightsSubtitle,
  children,
  className = '',
  icon,
  actionLabel = 'Insights',
  testId = 'glanceable-kpi-strip',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    if (children) {
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Register with hardware/browser back-button stack
  useMobileOverlay('sheet', isOpen, handleClose);

  return (
    <div className={`sm:hidden ${className}`} data-testid={testId}>
      {/* 36px–40px Compact Ticker Bar */}
      <div
        onClick={children ? handleOpen : undefined}
        className={`flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs shadow-2xs ${
          children ? 'cursor-pointer active:bg-slate-100/80 transition-colors' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-slate-700">
          {icon ? (
            <span className="shrink-0 text-slate-500">{icon}</span>
          ) : (
            <BarChart2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}

          <div className="flex items-center gap-1.5 truncate font-sans text-xs">
            {items.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-300 font-bold">·</span>}
                <span className="truncate">
                  <strong className={`font-mono font-bold ${item.color || 'text-slate-900'}`}>
                    {item.value}
                  </strong>{' '}
                  <span className="text-slate-500 text-[11px] font-medium">{item.label}</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {children && (
          <button
            type="button"
            data-testid="kpi-insights-trigger"
            onClick={e => {
              e.stopPropagation();
              handleOpen();
            }}
            className="ml-2 shrink-0 min-h-[36px] px-2.5 py-1 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer touch-press"
            aria-label="Open insights bottom sheet"
          >
            <span>{actionLabel}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>

      {/* Insights Bottom Sheet Modal */}
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center p-0 m-0 mobile-sheet"
            onClick={e => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <div
              className="bg-white rounded-t-3xl border-t border-slate-300 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col mobile-sheet-card max-h-[90dvh]"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                    {insightsTitle}
                  </h3>
                  {insightsSubtitle && (
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {insightsSubtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="kpi-insights-close"
                  onClick={handleClose}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-300 transition-colors shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Sheet Content */}
              <div className="p-4 overflow-y-auto space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {children}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
