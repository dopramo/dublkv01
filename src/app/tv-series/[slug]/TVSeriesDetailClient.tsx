'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import WatchTVClient from './WatchTVClient';
import TVSeriesRow from '@/components/ui/TVSeriesRow';
import PricingModal from '@/components/payment/PricingModal';
import type { TMDBCredits } from '@/lib/tmdb';

interface TVSeriesDetailClientProps {
  series: any;
  relatedSeries: any[];
  credits: TMDBCredits;
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export default function TVSeriesDetailClient({ series, relatedSeries, credits }: TVSeriesDetailClientProps) {
  const { user, openAuthModal } = useAuth();
  const router = useRouter();
  const [watching, setWatching] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [hasVipAccess, setHasVipAccess] = useState(false);

  const tvData = series.free_servers || {};
  const seasons = tvData.seasons || [];
  const totalSeasons = seasons.length || 1;

  // Check VIP access for current user
  useEffect(() => {
    async function checkAccess() {
      if (!user) {
        setHasVipAccess(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (profile?.is_admin) {
          setHasVipAccess(true);
          return;
        }

        const { data: purchases } = await supabase
          .from('purchases')
          .select('type, movie_id, status')
          .eq('user_id', user.id)
          .eq('status', 'verified');

        if (purchases && purchases.length > 0) {
          const hasFull = purchases.some((p: any) => p.type === 'full');
          const hasSingle = purchases.some((p: any) => p.type === 'single' && p.movie_id === series.id);
          if (hasFull || hasSingle) {
            setHasVipAccess(true);
            return;
          }
        }
        setHasVipAccess(false);
      } catch {
        setHasVipAccess(false);
      }
    }
    checkAccess();
  }, [user, series.id]);

  const handlePlayFree = () => {
    setWatching(true);
  };

  const handlePlayVip = () => {
    if (!user) {
      openAuthModal(() => {});
      return;
    }
    if (hasVipAccess) {
      setWatching(true);
    } else {
      setShowPricing(true);
    }
  };

  // If user clicked "Play", render full custom TV player UI
  if (watching) {
    return <WatchTVClient series={series} />;
  }

  return (
    <div className="page-enter">
      {/* Hero Section — compact, content pushed up */}
      <section className="relative h-[35vh] sm:h-[45vh] lg:h-[50vh] w-full overflow-hidden">
        {series.backdrop_url ? (
          <Image
            src={series.backdrop_url}
            alt={series.title}
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full bg-dark-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-dark-950 via-dark-950/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/50 to-dark-950/10" />
      </section>

      {/* Content — overlaps hero with larger negative margin */}
      <div className="relative -mt-48 sm:-mt-56 lg:-mt-64 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0 w-44 sm:w-52 mx-auto md:mx-0">
              <div className="aspect-[2/3] relative rounded-2xl overflow-hidden shadow-2xl shadow-brand-500/10 border border-white/10">
                <Image
                  src={series.poster_url || '/placeholder-poster.jpg'}
                  alt={series.title}
                  fill
                  className="object-cover"
                  sizes="208px"
                />
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 pt-2">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/30 mb-3">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                <span className="text-xs font-semibold text-brand-300 tracking-wide">සිංහල හඩකැවූ - SINHALA DUBBED</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-white mb-4 leading-tight">
                {series.title}
              </h1>

              {/* Meta */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {series.rating > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/15 border border-yellow-500/20">
                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-semibold text-yellow-300">{series.rating.toFixed(1)}</span>
                  </div>
                )}
                {series.release_year && <span className="text-sm text-dark-300">{series.release_year}</span>}
                <span className="text-sm text-dark-300">{totalSeasons} Season{totalSeasons > 1 ? 's' : ''}</span>
                {series.genres && series.genres.map((genre: string) => (
                  <span key={genre} className="px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-dark-300">
                    {genre}
                  </span>
                ))}
              </div>

              {/* Description */}
              {series.description && (
                <p className="text-dark-300 leading-relaxed mb-6 max-w-2xl text-sm sm:text-base">
                  {series.description}
                </p>
              )}

              {/* Two-button action row matching Movie detail page */}
              <div className="flex flex-row items-center gap-3 sm:gap-5 mt-6 w-full sm:w-auto">

                {/* ── Play (With Ads) ── */}
                <button
                  onClick={handlePlayFree}
                  className="relative flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 min-w-[130px] sm:min-w-[175px] px-5 sm:px-7 py-3.5 sm:py-4 rounded-xl font-bold text-white transition-all duration-300 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:scale-[0.97] group"
                >
                  <span className="absolute -top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[8px] sm:text-[9px] font-extrabold tracking-wider uppercase bg-emerald-950/95 border border-emerald-400/40 text-emerald-300 shadow-sm backdrop-blur-md">
                    WITH ADS
                  </span>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 drop-shadow transition-transform duration-300 group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  <span className="whitespace-nowrap text-base sm:text-lg tracking-wide">Play</span>
                </button>

                {/* ── Play (Without Ads) ── */}
                <button
                  onClick={handlePlayVip}
                  className="relative flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 min-w-[130px] sm:min-w-[175px] px-5 sm:px-7 py-3.5 sm:py-4 rounded-xl font-bold text-white transition-all duration-300 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 shadow-[0_4px_20px_rgba(217,4,201,0.35)] hover:shadow-[0_6px_25px_rgba(217,4,201,0.5)] hover:-translate-y-0.5 active:scale-[0.97] group"
                >
                  <span className="absolute -top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[8px] sm:text-[9px] font-extrabold tracking-wider uppercase bg-purple-950/95 border border-fuchsia-400/40 text-fuchsia-200 shadow-sm backdrop-blur-md">
                    {hasVipAccess ? 'VIP UNLOCKED' : 'WITHOUT ADS'}
                  </span>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 drop-shadow transition-transform duration-300 group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  <span className="whitespace-nowrap text-base sm:text-lg tracking-wide">Play</span>
                </button>

              </div>
            </div>
          </div>

          {/* Cast & Crew Section */}
          {(credits.cast.length > 0 || credits.crew.length > 0) && (
            <div className="mt-12 space-y-10">
              {credits.cast.length > 0 && (
                <div>
                  <h2 className="text-xl font-display font-bold text-white mb-5 flex items-center gap-2">
                    <span className="text-brand-400">🎭</span> Cast
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
                    {credits.cast.map((person) => (
                      <div key={person.id} className="text-center group cursor-default">
                        {/* Avatar */}
                        <div
                          className="relative mx-auto mb-2 max-w-[80px] transition-transform duration-300 group-hover:scale-105"
                          style={{ width: '80px', height: '80px' }}
                        >
                          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/30 to-brand-500/30 p-[2px] group-hover:from-emerald-400 group-hover:to-brand-400 transition-all duration-300">
                            <div className="w-full h-full rounded-full overflow-hidden bg-dark-800">
                              {person.profile_path ? (
                                <Image
                                  src={`${TMDB_IMAGE_BASE}/w185${person.profile_path}`}
                                  alt={person.name}
                                  fill
                                  className="object-cover rounded-full"
                                  sizes="80px"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs font-medium text-white leading-tight truncate">{person.name}</p>
                        {person.character && (
                          <p className="text-[10px] text-dark-400 leading-tight truncate mt-0.5">{person.character}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {credits.crew.length > 0 && (
                <div>
                  <h2 className="text-xl font-display font-bold text-white mb-5 flex items-center gap-2">
                    <span className="text-brand-400">🎬</span> Crew
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {credits.crew.map((person, i) => (
                      <div
                        key={`${person.id}-${i}`}
                        className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-brand-500/30 hover:bg-white/[0.07] transition-all duration-200"
                      >
                        <div
                          className="relative flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
                          style={{ width: '36px', height: '36px' }}
                        >
                          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/30 to-brand-500/30 p-[2px] group-hover:from-emerald-400 group-hover:to-brand-400 transition-all duration-300">
                            <div className="w-full h-full rounded-full overflow-hidden bg-dark-800">
                              {person.profile_path ? (
                                <Image
                                  src={`${TMDB_IMAGE_BASE}/w45${person.profile_path}`}
                                  alt={person.name}
                                  width={32}
                                  height={32}
                                  className="object-cover w-full h-full rounded-full"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-dark-700">
                                  <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{person.name}</p>
                          <p className="text-xs text-brand-400">{person.job}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related TV Series */}
      {relatedSeries && relatedSeries.length > 0 && (
        <div className="mt-16 pb-16">
          <TVSeriesRow title="You May Also Like" seriesList={relatedSeries} icon="📺" />
        </div>
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        movieId={series.id}
        movieTitle={series.title}
        movieSlug={series.slug}
      />
    </div>
  );
}
