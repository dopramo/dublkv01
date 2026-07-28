'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface DBMovie {
  id: string;
  slug: string;
  title: string;
  release_year: number | null;
  poster_url: string | null;
  genres: string[];
  rating: number;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 280);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
      document.body.style.overflow = 'hidden';
    } else {
      setQuery('');
      setResults([]);
      document.body.style.overflow = '';
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Search against our OWN database movies only
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults((data.movies || []).slice(0, 10));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  const handleSelect = (movie: any) => {
    onClose();
    const isTV = movie.free_servers?.is_tv;
    router.push(isTV ? `/tv-series/${movie.slug}` : `/movies/${movie.slug}`);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center"
      style={{ paddingTop: 'clamp(60px, 12vh, 140px)' }}
    >
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-xl"
        style={{ animation: 'fadeIn 0.2s ease' }}
        onClick={onClose}
      />

      {/* Search panel */}
      <div
        className="relative w-full mx-4 max-w-2xl"
        style={{ animation: 'searchSlideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hint text */}
        {!query && (
          <p
            className="text-center text-dark-400 text-sm mb-4 tracking-wide"
            style={{ animation: 'fadeIn 0.3s ease 0.1s both' }}
          >
            🎬 Find your best movie &amp; TV series
          </p>
        )}

        {/* Input bar */}
        <div className="relative flex items-center bg-dark-800/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-brand-500/30 focus-within:ring-brand-500/70 transition-all duration-300">
          <div className="pl-5 pr-3 flex-shrink-0">
            {loading ? (
              <svg className="w-5 h-5 text-brand-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, TV series..."
            className="flex-1 bg-transparent py-4 pr-4 text-white placeholder-dark-500 text-base outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
              className="mr-4 p-1 text-dark-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results dropdown */}
        {results.length > 0 && (
          <div
            className="mt-2 bg-dark-800/98 border border-white/8 rounded-2xl shadow-2xl overflow-hidden"
            style={{ animation: 'fadeSlideDown 0.2s ease' }}
          >
            {results.map((movie, idx) => (
              <button
                key={movie.id}
                onClick={() => handleSelect(movie)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-all duration-150 group text-left border-b border-white/5 last:border-0"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* Poster */}
                <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-dark-700 relative">
                  {movie.poster_url ? (
                    <Image
                      src={movie.poster_url}
                      alt={movie.title}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dark-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate group-hover:text-brand-300 transition-colors">
                    {movie.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {movie.release_year && (
                      <span className="text-xs text-dark-500">{movie.release_year}</span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-brand-500/20 text-brand-400">
                      Movie
                    </span>
                    {movie.rating > 0 && (
                      <span className="text-xs text-yellow-400">★ {movie.rating.toFixed(1)}</span>
                    )}
                  </div>
                  {movie.genres?.length > 0 && (
                    <p className="text-xs text-dark-500 mt-0.5 truncate">
                      {movie.genres.slice(0, 3).join(', ')}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-dark-600 group-hover:text-brand-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {query && !loading && results.length === 0 && (
          <div
            className="mt-2 bg-dark-800/98 border border-white/8 rounded-2xl shadow-2xl p-8 text-center"
            style={{ animation: 'fadeSlideDown 0.2s ease' }}
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-dark-400 text-sm">No results for &ldquo;{query}&rdquo;</p>
            <p className="text-dark-600 text-xs mt-1">Try a different title</p>
          </div>
        )}

        {/* Keyboard hint */}
        <p className="text-center text-dark-600 text-xs mt-4">
          Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-dark-500 font-mono">Esc</kbd> to close
        </p>
      </div>

      <style jsx global>{`
        @keyframes searchSlideIn {
          from { opacity: 0; transform: translateY(-24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
