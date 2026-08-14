'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface MovieCardProps {
  movie: {
    id: string;
    slug: string;
    title: string;
    poster_url: string | null;
    rating: number;
    release_year: number | null;
    genres: string[];
  };
  /** When true, card fills its parent width (for grids). When false, uses fixed scroll width. */
  fill?: boolean;
}

export default function MovieCard({ movie, fill = false }: MovieCardProps) {
  const [imgSrc, setImgSrc] = useState(movie.poster_url || '/placeholder-poster.jpg');

  return (
    <Link
      href={`/movies/${movie.slug}`}
      className="group relative block cursor-pointer"
      style={fill ? { width: '100%' } : { width: '160px', flexShrink: 0 }}
    >
      {/* Poster Container — strict 2:3 aspect ratio enforced via padding-bottom */}
      <div
        className="relative rounded-xl overflow-hidden bg-dark-800 shadow-lg group-hover:shadow-2xl group-hover:shadow-brand-500/20 transition-all duration-500"
        style={{ width: '100%', paddingBottom: '150%', position: 'relative' }}
      >
        {/* Image */}
        <Image
          src={imgSrc}
          alt={movie.title}
          fill
          unoptimized
          onError={() => setImgSrc('/placeholder-poster.jpg')}
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          sizes={fill ? '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 14vw' : '160px'}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Rating Badge */}
        {movie.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-dark-950/80 backdrop-blur-sm border border-white/10">
            <svg className="w-2.5 h-2.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-[10px] font-bold text-white">{movie.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Hover Content */}
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xl">
              <svg className="w-3.5 h-3.5 text-dark-950 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            </div>
            <span className="text-[11px] text-dark-300 font-medium">Watch Now</span>
          </div>
          {movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {movie.genres.slice(0, 2).map((genre) => (
                <span
                  key={genre}
                  className="px-1.5 py-0.5 text-[9px] rounded-full bg-white/10 text-dark-200 backdrop-blur-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Text Below — fixed height for uniform cards */}
      <div className="mt-2 px-0.5" style={{ height: '40px', overflow: 'hidden' }}>
        <h3 className="text-xs font-medium text-dark-200 group-hover:text-white transition-colors line-clamp-2 leading-snug">
          {movie.title}
        </h3>
        {movie.release_year && (
          <p className="text-[10px] text-dark-500 mt-0.5">{movie.release_year}</p>
        )}
      </div>
    </Link>
  );
}
