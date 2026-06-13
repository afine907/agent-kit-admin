/**
 * SearchBar 组 - 搜索栏 (防抖 300ms)
 */

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = '搜索包...' }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, onChange]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <div className="relative group">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-secondary focus:ring-1 focus:ring-primary/20 transition-all"
      />
      {inputValue && (
        <button
          onClick={() => setInputValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
