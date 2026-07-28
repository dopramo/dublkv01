'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import TVSeriesCard, { TVSeriesItem } from '@/components/ui/TVSeriesCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function TVSeriesCatalogPage() {
  const [seriesList, setSeriesList] = useState<TVSeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'title' | 'year'>('recent');

  const supabase = createClient();

  useEffect(() => {
    async function fetchTVSeries() {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Filter only TV series
        const tvOnly = data.filter((item: any) => item.free_servers?.is_tv);
        setSeriesList(tvOnly);
      }
      setLoading(false);
    }
    fetchTVSeries();
  }, []);

  // Get all unique genres
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    seriesList.forEach(s => (s.genres || []).forEach((g: string) => genres.add(g)));
    return Array.from(genres).sort();
  }, [seriesList]);

  // Filter & Sort
  const filteredSeries = useMemo(() => {
    let result = seriesList;

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.title.toLowerCase().includes(q));
    }

    // Genre filter
    if (selectedGenre !== 'all') {
      result = result.filter(s => (s.genres || []).includes(selectedGenre));
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'title':
        result = [...result].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'year':
        result = [...result].sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
        break;
      default:
        result = [...result].sort((a, b) => {
          const timeA = new Date((a as any).updated_at || (a as any).created_at).getTime();
          const timeB = new Date((b as any).updated_at || (b as any).created_at).getTime();
          return timeB - timeA;
        });
        break;
    }

    return result;
  }, [seriesList, search, selectedGenre, sortBy]);

  return (
    <div className="pt-24 pb-16 page-enter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00ff73]/10 border border-[#00ff73]/20 text-[#00ff73] text-xs font-semibold mb-3">
            <span>📺</span>
            <span>TV Series</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2">Browse TV Series</h1>
          <p className="text-dark-400">Watch all your favourite TV series in Sinhala dubbed</p>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search TV series..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-[#00ff73]/50 focus:border-[#00ff73]/50 transition-all"
            />
          </div>

          {/* Genre Filter */}
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff73]/50 appearance-none cursor-pointer"
          >
            <option value="all" className="bg-dark-800">All Genres</option>
            {allGenres.map(g => (
              <option key={g} value={g} className="bg-dark-800">{g}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#00ff73]/50 appearance-none cursor-pointer"
          >
            <option value="recent" className="bg-dark-800">Recently Added</option>
            <option value="rating" className="bg-dark-800">Top Rated</option>
            <option value="title" className="bg-dark-800">Title (A-Z)</option>
            <option value="year" className="bg-dark-800">Year (Newest)</option>
          </select>
        </div>

        {/* Results Count */}
        <p className="text-sm text-dark-500 mb-6">
          {filteredSeries.length} {filteredSeries.length === 1 ? 'series' : 'series'} found
        </p>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" text="Loading TV series..." />
          </div>
        ) : filteredSeries.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No TV series found</h3>
            <p className="text-dark-400 text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {filteredSeries.map((series) => (
              <TVSeriesCard key={series.id} series={series} fill />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
