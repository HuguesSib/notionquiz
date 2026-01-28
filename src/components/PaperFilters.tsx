import { ChangeEvent } from 'react';
import { Search, SortAsc, X } from 'lucide-react';
import type { SortOption } from '@shared/types';

interface PaperFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  showDueOnly: boolean;
  setShowDueOnly: (show: boolean) => void;
  allTags: string[];
}

export default function PaperFilters({ 
  searchQuery, 
  setSearchQuery,
  selectedTags,
  setSelectedTags,
  sortBy,
  setSortBy,
  showDueOnly,
  setShowDueOnly,
  allTags
}: PaperFiltersProps) {
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSortChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as SortOption);
  };

  const handleDueOnlyChange = (e: ChangeEvent<HTMLInputElement>) => {
    setShowDueOnly(e.target.checked);
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div className="space-y-3 mb-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search papers..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort Dropdown */}
        <div className="flex items-center gap-1">
          <SortAsc className="w-4 h-4 text-slate-400" />
          <select
            value={sortBy}
            onChange={handleSortChange}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="priority">Needs Review</option>
            <option value="new-first">New First</option>
            <option value="mastery-asc">Weakest First</option>
            <option value="mastery-desc">Strongest First</option>
            <option value="recent">Recently Reviewed</option>
            <option value="alphabetical">A-Z</option>
          </select>
        </div>

        {/* Needs Review Toggle */}
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={showDueOnly}
            onChange={handleDueOnlyChange}
            className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
          />
          Needs review only
        </label>
      </div>

      {/* Tag Pills */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.slice(0, 10).map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-600 hover:bg-red-200"
            >
              Clear tags
            </button>
          )}
        </div>
      )}
    </div>
  );
}
