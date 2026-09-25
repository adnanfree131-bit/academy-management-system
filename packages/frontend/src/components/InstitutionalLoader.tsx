import React from 'react';

export interface InstitutionalLoaderProps {
  /** Descriptive loading message, e.g. "Loading student roster..." */
  label?: string;
  /** Optional secondary subtitle or hint */
  hint?: string;
  /** Size of the spinner animation */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Presentation layout:
   * - 'page': Full workspace view container (centered in page area)
   * - 'card': Institutional white card with border & subtle shadow
   * - 'table': Table body row embedding with colSpan
   * - 'inline': Compact inline block for drawers, modals, or tab panels
   */
  variant?: 'page' | 'card' | 'table' | 'inline';
  /** Number of columns when variant === 'table' */
  colSpan?: number;
  /** Additional container CSS classes */
  className?: string;
}

/**
 * Universal institutional loading animation for the academy management ERP.
 * Replaces fragmented, inconsistent spinners with a document-grade, clean visual standard.
 */
export const InstitutionalLoader: React.FC<InstitutionalLoaderProps> = ({
  label = 'Loading institutional records...',
  hint,
  size = 'md',
  variant = 'card',
  colSpan = 7,
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4 border-[2px]',
    md: 'w-6 h-6 border-[2.5px]',
    lg: 'w-8 h-8 border-[3px]',
  };

  const spinner = (
    <div className="relative flex items-center justify-center shrink-0">
      {/* Outer neutral guide ring */}
      <div className={`${sizeMap[size]} rounded-full border-slate-200/80`} />
      {/* Precision spinning arc in institutional amber accent */}
      <div
        className={`absolute inset-0 ${sizeMap[size]} rounded-full border-transparent border-t-amber-600 border-r-amber-600/30 animate-spin`}
      />
    </div>
  );

  const content = (
    <div className="flex flex-col items-center justify-center space-y-2.5 select-none animate-in fade-in duration-150">
      {spinner}
      <div className="text-center">
        <p className="text-xs font-semibold text-slate-700 tracking-tight font-sans">
          {label}
        </p>
        {hint && (
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            {hint}
          </p>
        )}
      </div>
    </div>
  );

  if (variant === 'table') {
    return (
      <tr className={className}>
        <td colSpan={colSpan} className="py-12 px-4 text-center bg-white">
          {content}
        </td>
      </tr>
    );
  }

  if (variant === 'page') {
    return (
      <div className={`min-h-[380px] flex items-center justify-center p-8 ${className}`}>
        {content}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`py-6 px-3 flex items-center justify-center ${className}`}>
        {content}
      </div>
    );
  }

  // Default 'card' variant
  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-xl shadow-2xs py-10 px-6 text-center flex items-center justify-center ${className}`}
    >
      {content}
    </div>
  );
};
