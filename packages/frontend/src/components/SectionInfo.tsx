import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface SectionInfoProps {
  title?: string;
  description?: string;
  text?: string;
  className?: string;
  titleClassName?: string;
}

export const SectionInfo: React.FC<SectionInfoProps> = ({
  title,
  description,
  text,
  className = '',
  titleClassName = 'text-sm font-bold text-slate-900',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const tooltipContent = description || text;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTooltip]);

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {title && <h2 className={titleClassName}>{title}</h2>}
      {tooltipContent && (
        <div className="relative inline-flex items-center" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setShowTooltip(prev => !prev)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
            aria-label="Section Details"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {showTooltip && (
            <div className="absolute left-0 top-full mt-1 z-50 w-64 sm:w-72 p-2.5 bg-slate-900 text-white text-xs rounded-lg shadow-lg border border-slate-800 pointer-events-none animate-in fade-in duration-150">
              <p className="leading-relaxed text-slate-200 font-normal">
                {tooltipContent}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
