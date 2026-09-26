import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface ModernSelectOption {
  value: string;
  label: string;
  subtext?: string;
  disabled?: boolean;
}

export interface ModernSelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options?: ModernSelectOption[];
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  'aria-label'?: string;
}

function extractOptionsFromChildren(children: React.ReactNode): ModernSelectOption[] {
  const result: ModernSelectOption[] = [];

  const traverse = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, node => {
      if (!node) return;
      if (Array.isArray(node)) {
        traverse(node);
        return;
      }
      if (React.isValidElement(node)) {
        const typeName = typeof node.type === 'string' ? node.type.toLowerCase() : '';
        if (typeName === 'option' || node.type === 'option') {
          const val = node.props.value !== undefined ? String(node.props.value) : '';
          const childrenContent = node.props.children;
          let label = '';
          if (typeof childrenContent === 'string' || typeof childrenContent === 'number') {
            label = String(childrenContent);
          } else if (Array.isArray(childrenContent)) {
            label = childrenContent
              .map(c => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
              .join('');
          } else if (childrenContent) {
            label = String(childrenContent);
          }
          result.push({
            value: val,
            label: label || val,
            disabled: Boolean(node.props.disabled),
          });
        } else if (node.props && (node.props as any).children) {
          traverse((node.props as any).children);
        }
      }
    });
  };

  traverse(children);
  return result;
}

export const ModernSelect: React.FC<ModernSelectProps> = ({
  id,
  name,
  value,
  onChange,
  options,
  children,
  placeholder = 'Select option...',
  disabled = false,
  required = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  searchable,
  searchPlaceholder = 'Search options...',
  'aria-label': ariaLabel,
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Extract option list either from explicit options prop or children <option> tags
  const resolvedOptions = useMemo<ModernSelectOption[]>(() => {
    if (options && options.length > 0) {
      return options;
    }
    if (children) {
      return extractOptionsFromChildren(children);
    }
    return [];
  }, [options, children]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return resolvedOptions.find(opt => opt.value === value);
  }, [resolvedOptions, value]);

  // Only searchable if explicitly enabled via searchable={true} prop
  // NEVER auto-enable search to avoid mobile virtual keyboard popup and violent screen jerk
  const isSearchable = Boolean(searchable);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return resolvedOptions;
    const query = searchTerm.toLowerCase().trim();
    return resolvedOptions.filter(
      opt =>
        opt.label.toLowerCase().includes(query) ||
        (opt.subtext && opt.subtext.toLowerCase().includes(query))
    );
  }, [resolvedOptions, searchTerm]);

  // Sync highlightedIndex when opening or when filtered options change
  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex(o => o.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, filteredOptions, value]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsListRef.current) {
      const optionEl = optionsListRef.current.querySelector(
        `#${selectId}-opt-${highlightedIndex}`
      );
      if (optionEl) {
        (optionEl as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen, highlightedIndex, selectId]);

  // Check positioning on open to flip upwards if close to viewport bottom
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If less than 240px below and more room above, open upwards
      if (spaceBelow < 240 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle keyboard events (ArrowUp, ArrowDown, Home, End, Escape, Enter, Space)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev + 1;
        return next >= filteredOptions.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev - 1;
        return next < 0 ? filteredOptions.length - 1 : next;
      });
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIndex(Math.max(0, filteredOptions.length - 1));
    } else if (e.key === 'Enter' || (e.key === ' ' && !isSearchable)) {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const opt = filteredOptions[highlightedIndex];
        if (!opt.disabled) {
          handleSelect(opt.value, opt.disabled);
        }
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const handleSelect = (val: string, isDisabled?: boolean) => {
    if (isDisabled) return;
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Determine display label
  const displayLabel = selectedOption?.label || (value ? value : placeholder);
  const isPlaceholder = !selectedOption && !value;
  const activeDescendantId =
    isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]
      ? `${selectId}-opt-${highlightedIndex}`
      : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left font-sans ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Native hidden form input for form submission without invalid un-focusable control crashes */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
        />
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        id={selectId}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || displayLabel}
        aria-required={required}
        aria-invalid={required && !value ? true : undefined}
        aria-activedescendant={activeDescendantId}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`group w-full flex items-center justify-between gap-2 px-2.5 py-1.5 min-h-[32px] sm:min-h-[34px] text-xs rounded-lg border transition-all duration-150 text-left select-none ${
          disabled
            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
            : isOpen
            ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/15 text-slate-800 shadow-sm'
            : required && !value
            ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 hover:bg-slate-50/50'
            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 hover:bg-slate-50/50'
        } ${buttonClassName}`}
      >
        <span
          className={`truncate block flex-1 ${
            isPlaceholder ? 'text-slate-400 font-normal' : 'text-slate-800 font-medium'
          }`}
        >
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Floating Menu Panel */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute left-0 w-full z-50 bg-white border border-slate-200/90 rounded-xl shadow-xl shadow-slate-900/10 overflow-hidden transition-all duration-150 animate-in fade-in zoom-in-95 ${
            openUpward ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'
          } ${menuClassName}`}
          style={{ minWidth: '100%' }}
        >
          {/* Real-time Search Box for lists with >= 7 items */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      setIsOpen(false);
                      e.stopPropagation();
                    }
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setSearchTerm('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            ref={optionsListRef}
            className="max-h-56 overflow-y-auto p-1 space-y-0.5 divide-y divide-transparent"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3.5 text-center text-xs text-slate-400 font-normal">
                {searchTerm ? 'No options match your search' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = highlightedIndex === idx;
                return (
                  <button
                    key={opt.value || `__empty_${idx}__`}
                    id={`${selectId}-opt-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value, opt.disabled)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between gap-2 transition-colors ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed text-slate-400 bg-transparent'
                        : isSelected
                        ? 'bg-indigo-50 text-indigo-950 font-semibold shadow-xs ring-1 ring-indigo-500/20'
                        : isHighlighted
                        ? 'bg-slate-100/90 text-slate-900 font-medium'
                        : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <div className="truncate flex-1">
                      <span className="truncate block">{opt.label}</span>
                      {opt.subtext && (
                        <span className="text-[10px] text-slate-400 block font-normal truncate mt-0.5">
                          {opt.subtext}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
