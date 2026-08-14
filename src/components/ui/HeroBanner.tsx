'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { truncate } from '@/lib/utils';

interface Movie {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  backdrop_url: string | null;
  poster_url: string | null;
  rating: number;
  release_year: number | null;
  genres: string[];
}

interface HeroBannerProps {
  movies: Movie[];
}

export default function HeroBanner({ movies }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback((index: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
    }, 300);
  }, []);

  useEffect(() => {
    if (movies.length <= 1) return;
    const interval = setInterval(() => {
      goToSlide((currentIndex + 1) % movies.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [currentIndex, movies.length, goToSlide]);

  if (movies.length === 0) return null;

  const movie = movies[currentIndex];

  return (
    <section className="relative min-h-[480px] sm:min-h-[540px] lg:h-[75vh] w-full overflow-hidden">
      {/* Background Image */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        {movie.backdrop_url ? (
          <Image
            src={movie.backdrop_url}
            alt={movie.title}
            fill
            unoptimized
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full bg-dark-900" />
        )}
      </div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-dark-950 to-transparent" />

      {/* Content — centred vertically so it sits high, not at the very bottom */}
      <div className="relative h-full flex items-center pt-20 sm:pt-16 pb-6 sm:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className={`max-w-2xl transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            {/* Sinhala Dubbed Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/30 mb-3 sm:mb-4">
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-[11px] sm:text-xs font-semibold text-brand-300 tracking-wide">සිංහල හඩකැවූ - SINHALA DUBBED</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-4xl lg:text-6xl font-display font-bold text-white leading-tight mb-3 sm:mb-4">
              {movie.title}
            </h1>

            {/* Meta Info */}
            <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
              {movie.rating > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/15 border border-yellow-500/20">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold text-yellow-300">{movie.rating.toFixed(1)}</span>
                </div>
              )}
              {movie.release_year && (
                <span className="text-xs sm:text-sm text-dark-300 font-medium">{movie.release_year}</span>
              )}
              {movie.genres.slice(0, 3).map((genre) => (
                <span key={genre} className="px-2.5 py-1 text-[11px] sm:text-xs rounded-full bg-white/5 border border-white/10 text-dark-300">
                  {genre}
                </span>
              ))}
            </div>

            {/* Description */}
            {movie.description && (
              <p className="text-xs sm:text-base text-dark-300 leading-relaxed mb-5 max-w-xl line-clamp-3 sm:line-clamp-none">
                {truncate(movie.description, 160)}
              </p>
            )}

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href={`/movies/${movie.slug}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-dark-950 font-semibold rounded-xl hover:bg-dark-100 transition-all duration-200 shadow-xl shadow-white/10"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Watch Now
              </Link>
              <Link
                href={`/movies/${movie.slug}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-semibold rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                More Info
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      {movies.length > 1 && (
        <div className="absolute bottom-8 right-8 flex items-center gap-2">
          {movies.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-1 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'w-8 bg-brand-500'
                  : 'w-3 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
