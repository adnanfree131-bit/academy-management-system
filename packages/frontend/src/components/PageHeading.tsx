import React from 'react';
import { SectionInfo } from './SectionInfo';

interface PageHeadingProps {
  title: string;
  description?: string;
  badge?: string;
  badgeIcon?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeading: React.FC<PageHeadingProps> = ({
  title,
  description,
  badge,
  badgeIcon,
  icon,
  children,
  className = '',
}) => {
  return (
    <div className={`pb-1 ${className}`}>
      {/* Desktop Heading (>= sm) */}
      <div className="hidden sm:flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0 flex items-center justify-center">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
              {title}
            </h1>
            
            {description && (
              <SectionInfo text={description} />
            )}

            {badge && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {badgeIcon}
                <span>{badge}</span>
              </span>
            )}
          </div>
        </div>

        {children && (
          <div className="flex items-center gap-2 shrink-0">
            {children}
          </div>
        )}
      </div>

      {/* Mobile Action Strip (< sm): Makes modal trigger buttons visible, wrapped, and thumb-accessible */}
      {children && (
        <div className="sm:hidden flex flex-wrap items-center gap-2 py-1.5 w-full shrink-0">
          {children}
        </div>
      )}
    </div>
  );
};

