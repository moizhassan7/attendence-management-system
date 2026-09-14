import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, ChevronDown, User, Hash, Shield } from 'lucide-react';

export interface PersonnelOption {
  id: number;
  biometric_user_id: string;
  full_name: string;
  employee_code?: string | null;
  rank_name?: string | null;
  department_name?: string | null;
  designation?: string | null;
  is_trainee?: boolean;
}

interface SearchablePersonSelectProps {
  personnel: PersonnelOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export const SearchablePersonSelect: React.FC<SearchablePersonSelectProps> = ({
  personnel,
  value,
  onChange,
  placeholder = 'Search by name, PIN, belt #, rank...',
  required = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find currently selected person
  const selectedPerson = useMemo(() => {
    if (!value) return null;
    return personnel.find((p) => String(p.id) === String(value)) || null;
  }, [personnel, value]);

  // Filter personnel based on search query
  const filteredPersonnel = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return personnel.slice(0, 50);

    return personnel
      .filter((p) => {
        const name = (p.full_name || '').toLowerCase();
        const pin = String(p.biometric_user_id || '').toLowerCase();
        const belt = (p.employee_code || '').toLowerCase();
        const rank = (p.rank_name || p.designation || '').toLowerCase();
        const dept = (p.department_name || '').toLowerCase();

        return (
          name.includes(q) ||
          pin.includes(q) ||
          belt.includes(q) ||
          rank.includes(q) ||
          dept.includes(q)
        );
      })
      .slice(0, 50);
  }, [personnel, searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset active index when filtered results change
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeItem = listRef.current.children[activeIndex] as HTMLElement;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  const handleSelect = (person: PersonnelOption) => {
    onChange(String(person.id));
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange('');
    setSearchQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredPersonnel.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPersonnel[activeIndex]) {
        handleSelect(filteredPersonnel[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden input for HTML5 required form validation */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={() => {}}
        required={required}
        className="sr-only"
      />

      {/* Selected Person Pill Card (When selected and dropdown closed) */}
      {selectedPerson && !isOpen ? (
        <div
          onClick={() => {
            if (disabled) return;
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="w-full flex items-center justify-between p-2.5 bg-indigo-50/60 border border-indigo-200 hover:border-indigo-300 rounded-xl transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex flex-col items-center justify-center shrink-0 shadow-xs">
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">PIN</span>
              <span className="text-xs leading-none">#{selectedPerson.biometric_user_id}</span>
            </div>
            <div className="min-w-0 truncate">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 truncate">
                <span className="truncate">{selectedPerson.full_name}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 shrink-0">
                  {selectedPerson.rank_name || (selectedPerson.is_trainee ? 'Trainee' : 'Staff')}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                {selectedPerson.employee_code && (
                  <span>Belt #{selectedPerson.employee_code}</span>
                )}
                {selectedPerson.employee_code && selectedPerson.department_name && <span>•</span>}
                {selectedPerson.department_name && <span>{selectedPerson.department_name}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Change / Clear"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Search Input Box */
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedPerson ? `${selectedPerson.full_name} (#${selectedPerson.biometric_user_id})` : placeholder}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform cursor-pointer ${
                  isOpen ? 'rotate-180 text-indigo-600' : ''
                }`}
                onClick={() => {
                  setIsOpen(!isOpen);
                  inputRef.current?.focus();
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Floating Dropdown Results */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center text-[10px] text-slate-500 font-semibold px-3">
            <span>
              {searchQuery
                ? `Results for "${searchQuery}" (${filteredPersonnel.length})`
                : `Available Personnel (${personnel.length})`}
            </span>
            <span className="text-slate-400">↑↓ to navigate, Enter to select</span>
          </div>

          <div ref={listRef} className="max-h-56 overflow-y-auto divide-y divide-slate-50 p-1">
            {filteredPersonnel.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                <User className="w-6 h-6 mx-auto mb-1 text-slate-300 opacity-60" />
                No person found matching <span className="font-semibold text-slate-600">"{searchQuery}"</span>
              </div>
            ) : (
              filteredPersonnel.map((person, idx) => {
                const isSelected = String(person.id) === String(value);
                const isHighlighted = idx === activeIndex;

                return (
                  <div
                    key={person.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(person)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      isHighlighted
                        ? 'bg-indigo-50/80 text-indigo-900'
                        : isSelected
                        ? 'bg-indigo-50/40 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                          isSelected || isHighlighted
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        #{person.biometric_user_id}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="font-bold truncate text-slate-900 flex items-center gap-1.5">
                          <span>{person.full_name}</span>
                          {(person.rank_name || person.is_trainee) && (
                            <span className="text-[10px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {person.rank_name || (person.is_trainee ? 'Trainee' : 'Staff')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                          {person.employee_code && <span>Belt: {person.employee_code}</span>}
                          {person.department_name && <span>• {person.department_name}</span>}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="shrink-0 text-indigo-600 ml-2">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchablePersonSelect;
