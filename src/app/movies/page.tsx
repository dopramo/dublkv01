'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import MovieCard from '@/components/ui/MovieCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function CatalogPage() {
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'title' | 'year'>('recent');

  const supabase = createClient();

  useEffect(() => {
    async function fetchMovies() {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const moviesOnly = data.filter((item: any) => !item.free_servers?.is_tv);
        setMovies(moviesOnly);
      }
      setLoading(false);
    }
    fetchMovies();
  }, []);

  // Get all unique genres
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    movies.forEach(m => (m.genres || []).forEach((g: string) => genres.add(g)));
    return Array.from(genres).sort();
  }, [movies]);

  // Filter & Sort
  const filteredMovies = useMemo(() => {
    let result = movies;

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m => m.title.toLowerCase().includes(q));
    }

    // Genre filter
    if (selectedGenre !== 'all') {
      result = result.filter(m => (m.genres || []).includes(selectedGenre));
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
          const timeA = new Date(a.updated_at || a.created_at).getTime();
          const timeB = new Date(b.updated_at || b.created_at).getTime();
          return timeB - timeA;
        });
        break;
    }

    return result;
  }, [movies, search, selectedGenre, sortBy]);

  return (
    <div className="pt-24 pb-16 page-enter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2">Browse Movies</h1>
          <p className="text-dark-400">Discover our collection of Sinhala dubbed movies</p>
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
              placeholder="Search movies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
            />
          </div>

          {/* Genre Filter */}
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
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
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none cursor-pointer"
          >
            <option value="recent" className="bg-dark-800">Recently Added</option>
            <option value="rating" className="bg-dark-800">Top Rated</option>
            <option value="title" className="bg-dark-800">Title (A-Z)</option>
            <option value="year" className="bg-dark-800">Year (Newest)</option>
          </select>
        </div>

        {/* Results Count */}
        <p className="text-sm text-dark-500 mb-6">
          {filteredMovies.length} {filteredMovies.length === 1 ? 'movie' : 'movies'} found
        </p>

        {/* Movie Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" text="Loading movies..." />
          </div>
        ) : filteredMovies.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No movies found</h3>
            <p className="text-dark-400 text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
            {filteredMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} fill />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
