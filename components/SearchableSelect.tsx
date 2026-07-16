import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface SearchableSelectProps {
  options: (string | { label: string; value: string })[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper selectors
  const getVal = (opt: string | { label: string; value: string }) => typeof opt === 'string' ? opt : opt.value;
  const getLabel = (opt: string | { label: string; value: string }) => typeof opt === 'string' ? opt : opt.label;

  // Filter options based on search query
  const filtered = options.filter(opt => {
    const label = getLabel(opt);
    return label.toLowerCase().includes(search.toLowerCase());
  });

  const selectedOption = options.find(opt => getVal(opt) === value);
  const displayLabel = selectedOption ? getLabel(selectedOption) : "";

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block w-full text-slate-700 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className="w-full flex items-center justify-between border border-slate-200 bg-white px-4 py-2.5 rounded-xl text-xs font-bold leading-tight shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-all outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-550"
      >
        <span className={value ? "text-slate-800 text-left truncate" : "text-slate-400 text-left truncate"}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 min-w-[220px] w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden leading-normal flex flex-col py-1.5 max-h-72" style={{ position: 'absolute', zIndex: 9999 }}>
          <div className="px-3 py-1.5 border-b border-slate-50 flex items-center gap-2 bg-slate-50/50">
            <Search size={12} className="text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              className="w-full bg-transparent text-[11px] font-semibold text-slate-800 placeholder-slate-400 border-none outline-none focus:ring-0 p-0"
              placeholder="Cari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-y-auto custom-scrollbar max-h-48 flex-1 py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-2.5 text-[10px] font-bold text-slate-400 text-center italic">
                Tidak ada hasil.
              </div>
            ) : (
              filtered.map((opt) => {
                const optVal = getVal(opt);
                const optLabel = getLabel(opt);
                return (
                  <button
                    key={optVal}
                    type="button"
                    onClick={() => {
                      onChange(optVal);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-[11px] font-bold transition-all flex items-center justify-between ${
                      value === optVal ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{optLabel}</span>
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
