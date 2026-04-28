import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { CITY_CODES, CITY_GROUPS, sel } from '../constants';

export function CityPicker({ value, onChange, disabled }: {
  value: string; onChange: (city: string) => void; disabled?: boolean
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = query.trim()
    ? Object.keys(CITY_CODES).filter(c =>
        c.includes(query) || CITY_CODES[c].toLowerCase().includes(query.toLowerCase())
      )
    : null;

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`${sel} text-left flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span>{value} ({CITY_CODES[value] || '?'})</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border border-gray-200 bg-white rounded-lg shadow-lg max-h-64 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="搜索城市名或代码..."
              className="flex-1 bg-transparent text-gray-800 text-sm outline-none placeholder-gray-400" />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered ? (
              filtered.length === 0 ? (
                <div className="text-gray-400 text-xs text-center py-4">无匹配城市</div>
              ) : (
                <div className="py-1">
                  {filtered.map(c => (
                    <button key={c} type="button"
                      onClick={() => { onChange(c); setOpen(false); setQuery(''); }}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-wechat/5 transition-colors
                        ${c === value ? 'text-wechat bg-wechat/5' : 'text-gray-700'}`}>
                      {c} <span className="text-gray-400 text-xs ml-1">{CITY_CODES[c]}</span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              CITY_GROUPS.map(g => (
                <div key={g.label}>
                  <div className="px-3 py-1.5 text-[10px] text-gray-400 sticky top-0 bg-gray-50 border-b border-gray-100">
                    {g.label}
                  </div>
                  {g.cities.map(c => (
                    <button key={c} type="button"
                      onClick={() => { onChange(c); setOpen(false); setQuery(''); }}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-wechat/5 transition-colors
                        ${c === value ? 'text-wechat bg-wechat/5' : 'text-gray-700'}`}>
                      {c} <span className="text-gray-400 text-xs ml-1">{CITY_CODES[c]}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
