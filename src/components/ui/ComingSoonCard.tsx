'use client';

import { useState } from 'react';
import Image from 'next/image';

export interface ComingSoonItem {
  id: string;
  title: string;
  type?: 'movie' | 'tv';
  poster_url: string;
  backdrop_url?: string | null;
  description?: string | null;
  release_date?: string | null;
  genres?: string[];
  rating?: number;
  tmdb_id?: number | null;
}

interface ComingSoonCardProps {
  item: ComingSoonItem;
  fill?: boolean;
}

export default function ComingSoonCard({ item, fill = false }: ComingSoonCardProps) {
  const [imgSrc, setImgSrc] = useState(item.poster_url || '/placeholder-poster.jpg');
  const isTv = item.type === 'tv';

  return (
    <div
      className="group relative block cursor-default select-none"
      style={fill ? { width: '100%' } : { width: '160px', flexShrink: 0 }}
    >
      {/* Poster Container — strict 2:3 aspect ratio */}
      <div
        className="relative rounded-xl overflow-hidden bg-dark-800 shadow-lg border border-brand-500/20 group-hover:border-brand-500/40 transition-all duration-500"
        style={{ width: '100%', paddingBottom: '150%', position: 'relative' }}
      >
        {/* Poster Image */}
        <Image
          src={imgSrc}
          alt={item.title}
          fill
          unoptimized
          onError={() => setImgSrc('/placeholder-poster.jpg')}
          className="object-cover filter brightness-[0.9] group-hover:brightness-100 transition-all duration-700 group-hover:scale-105"
          sizes={fill ? '(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 14vw' : '160px'}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />

        {/* Coming Soon Dark Overlay & Shimmer Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/30 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10">
          {/* Type Badge: MOVIE or TV */}
          <span className={`px-2 py-0.5 text-[9px] font-extrabold tracking-wider rounded-md uppercase backdrop-blur-md border ${
            isTv 
              ? 'bg-purple-500/30 text-purple-300 border-purple-500/40' 
              : 'bg-blue-500/30 text-blue-300 border-blue-500/40'
          }`}>
            {isTv ? 'TV Series' : 'Movie'}
          </span>

          {/* Rating Badge if available */}
          {item.rating && item.rating > 0 ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-dark-950/80 backdrop-blur-sm border border-white/10">
              <svg className="w-2.5 h-2.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-[10px] font-bold text-white">{item.rating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>

        {/* Bottom "Coming Soon" Text (Plain text only, no button container) */}
        <div className="absolute inset-x-0 bottom-6 px-2 z-10 text-center pointer-events-none">
          <span className="text-[11px] font-black tracking-widest text-red-500 uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            Coming Soon
          </span>
        </div>
      </div>

      {/* Title & Release Date below card */}
      <div className="mt-2 px-0.5" style={{ height: '42px', overflow: 'hidden' }}>
        <h3 className="text-xs font-semibold text-dark-100 line-clamp-1 leading-snug">
          {item.title}
        </h3>
        <p className="text-[10px] text-red-400/90 font-medium mt-0.5 flex items-center gap-1">
          <span>📅</span>
          <span className="truncate">{item.release_date || 'Coming Soon'}</span>
        </p>
      </div>
    </div>
  );
}
