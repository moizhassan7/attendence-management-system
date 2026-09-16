import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, ChevronDown, User } from 'lucide-react';

export interface PersonnelOption {
  id: number;
  biometric_user_id: string;
  full_name: string;
  employee_code?: string | null;
  rank_name?: string | null;
  department_name?: string | null;
  designation?: string | null;
  is_trainee?: boolean;
  course_name?: string | null;
}

interface SearchablePersonSelectProps {
  personnel: PersonnelOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

function initials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function pinLabel(raw: string | null | undefined) {
  const s = String(raw || '').trim();
  if (!s) return '—';
  if (s.toUpperCase().startsWith('TEMP-')) return `T-${s.slice(-4)}`;
  if (s.length > 8) return s.slice(-6);
  return s;
}

function rankLabel(person: PersonnelOption) {
  return person.course_name || person.rank_name || person.designation || (person.is_trainee ? 'Trainee' : 'Staff');
}

export const SearchablePersonSelect: React.FC<SearchablePersonSelectProps> = ({
  personnel,
  value,
  onChange,
  placeholder = 'Search name, PIN or belt number',
  required = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedPerson = useMemo(() => {
    if (!value) return null;
    return personnel.find((p) => String(p.id) === String(value)) || null;
  }, [personnel, value]);

  const filteredPersonnel = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return personnel.slice(0, 50);

    return personnel
      .filter((p) => {
        const hay = [
          p.full_name,
          p.biometric_user_id,
          p.employee_code,
          p.rank_name,
          p.designation,
          p.department_name,
          p.course_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [personnel, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeItem = listRef.current.children[activeIndex] as HTMLElement | undefined;
    activeItem?.scrollIntoView({ block: 'nearest' });
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
      if (filteredPersonnel[activeIndex]) handleSelect(filteredPersonnel[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={() => {}}
        required={required}
        className="sr-only"
      />

      {selectedPerson && !isOpen ? (
        <div
          onClick={() => {
            if (disabled) return;
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="w-full flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-2xl cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {initials(selectedPerson.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900 truncate">{selectedPerson.full_name}</div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              PIN {pinLabel(selectedPerson.biometric_user_id)}
              {selectedPerson.employee_code ? ` · ${selectedPerson.employee_code}` : ''}
              {` · ${rankLabel(selectedPerson)}`}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
            placeholder={placeholder}
            className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <div className="absolute inset-y-0 right-2 flex items-center">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <ChevronDown className={`w-4 h-4 text-slate-400 mr-1.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div className="relative z-50 mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 border-b border-slate-100">
            {searchQuery
              ? `${filteredPersonnel.length} match${filteredPersonnel.length === 1 ? '' : 'es'}`
              : `${personnel.length} personnel`}
          </div>

          <div ref={listRef} className="max-h-40 overflow-y-auto">
            {filteredPersonnel.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                <User className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                No match for “{searchQuery}”
              </div>
            ) : (
              filteredPersonnel.map((person, idx) => {
                const isSelected = String(person.id) === String(value);
                const isHighlighted = idx === activeIndex;

                return (
                  <button
                    type="button"
                    key={person.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelect(person)}
                    className={`w-full text-left flex items-start gap-3 px-3 py-2.5 border-b border-slate-50 last:border-0 ${
                      isHighlighted ? 'bg-indigo-50' : isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        isHighlighted || isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {initials(person.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{person.full_name}</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {rankLabel(person)}
                        {person.department_name ? ` · ${person.department_name}` : ''}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        PIN {pinLabel(person.biometric_user_id)}
                        {person.employee_code ? ` · Belt ${person.employee_code}` : ''}
                      </div>
                    </div>
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

export default SearchablePersonSelect;
