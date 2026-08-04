'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import PricingModal from '@/components/payment/PricingModal';

interface ServerOption {
  id?: string;
  name: string;
  url?: string;
  embed_code?: string;
  input_type?: 'embed' | 'url';
  enabled?: boolean;
}

interface EpisodeData {
  episode_number: number;
  title: string;
  description?: string;
  thumbnail_url?: string | null;
  servers: ServerOption[];
  vip_servers?: ServerOption[];
  is_unreleased?: boolean;
}

interface SeasonData {
  season_number: number;
  name: string;
  episodes: EpisodeData[];
}

interface WatchTVClientProps {
  series: {
    id: string;
    title: string;
    slug: string;
    tmdb_id?: number;
    poster_url?: string | null;
    backdrop_url?: string | null;
    rating?: number;
    release_year?: number | null;
    genres?: string[];
    description?: string | null;
    free_servers?: {
      is_tv?: boolean;
      status?: 'Completed' | 'Ongoing' | string;
      seasons?: SeasonData[];
    };
  };
  initialMode?: 'free' | 'vip';
}

function extractSrcFromEmbed(input: string): string {
  if (!input) return '';
  const str = input.trim();
  if (str.toLowerCase().includes('<iframe')) {
    const match = str.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return str;
}

function getEmbedUrl(server: ServerOption | null): string {
  if (!server) return '';
  const rawInput = server.embed_code || server.url || '';
  const url = extractSrcFromEmbed(rawInput);
  if (!url) return '';

  if (url.includes('drive.google.com') && url.includes('/preview')) return url;
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  const idMatch = url.match(/drive\.google\.com.*[?&]id=([^&]+)/);
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;

  return url;
}

export default function WatchTVClient({ series, initialMode = 'free' }: WatchTVClientProps) {
  const { user, openAuthModal } = useAuth();
  const router = useRouter();
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [hasVipAccess, setHasVipAccess] = useState(false);
  const [streamMode, setStreamMode] = useState<'free' | 'vip'>(initialMode);

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

  const tvData = series.free_servers || {};
  const seasons: SeasonData[] = tvData.seasons && tvData.seasons.length > 0 ? tvData.seasons : [
    {
      season_number: 1,
      name: 'SEASON 1',
      episodes: Array.from({ length: 10 }, (_, i) => ({
        episode_number: i + 1,
        title: `Episode ${i + 1}`,
        servers: [
          { name: 'SERVER 1', input_type: 'url', url: `https://vidsrc.me/embed/tv/${series.tmdb_id || 13278}/1/${i + 1}` },
          { name: 'SERVER 2', input_type: 'url', url: `https://embed.su/embed/tv/${series.tmdb_id || 13278}/1/${i + 1}` },
          { name: 'SERVER 3', input_type: 'url', url: `https://2embed.org/embed/tv/${series.tmdb_id || 13278}/1/${i + 1}` },
          { name: 'SERVER 4', input_type: 'url', url: `https://autoembed.co/tv/tmdb/${series.tmdb_id || 13278}-1-${i + 1}` },
          { name: 'SERVER 5', input_type: 'url', url: `https://multiembed.mov/directstream.php?video_id=${series.tmdb_id || 13278}&s=1&e=${i + 1}` },
          { name: 'SERVER 6', input_type: 'url', url: `https://vidlink.pro/tv/${series.tmdb_id || 13278}/1/${i + 1}` },
        ]
      }))
    }
  ];

  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(0);
  const [activeServerIdx, setActiveServerIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentSeason = seasons[selectedSeasonIdx] || seasons[0];
  const currentEpisode = currentSeason?.episodes?.[activeEpisodeIdx] || currentSeason?.episodes?.[0];

  const defaultServersForEp: ServerOption[] = Array.from({ length: 6 }, (_, i) => ({
    name: `SERVER ${i + 1}`,
    input_type: 'url',
    url: `https://vidsrc.me/embed/tv/${series.tmdb_id || 13278}/${currentSeason.season_number}/${currentEpisode?.episode_number || 1}`,
  }));

  const episodeServers: ServerOption[] = (() => {
    if (streamMode === 'vip') {
      const vipList = (currentEpisode?.vip_servers || []).filter((s: ServerOption) => (s.embed_code && s.embed_code.trim()) || (s.url && s.url.trim()));
      if (vipList.length > 0) return vipList;
    }
    const freeList = currentEpisode?.servers && currentEpisode.servers.length > 0 ? currentEpisode.servers : defaultServersForEp;
    return freeList;
  })();

  const currentServer = episodeServers[activeServerIdx] || episodeServers[0];
  const embedUrl = currentServer ? getEmbedUrl(currentServer) : null;

  const seriesInitials = series.title
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 4);

  const epCodeLabel = `${seriesInitials} EP${String(currentEpisode?.episode_number || 1).padStart(2, '0')}`;
  const seriesStatus = tvData.status || 'Completed';

  const handleUpgradeVip = () => {
    if (!user) {
      openAuthModal(() => {});
      return;
    }
    setShowPricing(true);
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 min-h-screen bg-dark-950 text-white page-enter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Main Grid: PC (2 columns: Player Left, Controls Right), Mobile (Stacked) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

          {/* LEFT: Video Player Screen */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">

            <div
              ref={playerContainerRef}
              className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 group"
            >
              {/* Player Overlay: Top Left Episode Code Badge */}
              <div className="absolute top-4 left-4 z-20 pointer-events-none">
                <span className="text-sm sm:text-base font-bold tracking-wider text-white text-shadow drop-shadow-md">
                  {epCodeLabel}
                </span>
              </div>

              {/* If playing: render iframe */}
              {isPlaying && embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-full border-0 relative z-10"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              ) : (
                /* Poster / Play Overlay Screen */
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-cover bg-center cursor-pointer"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgba(10,10,12,0.4), rgba(10,10,12,0.85)), url(${series.backdrop_url || series.poster_url || '/placeholder-backdrop.jpg'})`
                  }}
                  onClick={() => setIsPlaying(true)}
                >
                  {/* Purple Circle Play Button */}
                  <div className="flex flex-col items-center gap-2 group/play hover:scale-110 transition-transform duration-300">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-2xl shadow-purple-500/40 border border-purple-400/30">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-white/90 group-hover/play:text-white">Play Episode</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: Controls (Seasons, Servers, Episodes) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">

            {/* 1. SEASONS Selector Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {seasons.map((s, idx) => {
                const isActive = idx === selectedSeasonIdx;
                return (
                  <button
                    key={s.season_number}
                    onClick={() => {
                      setSelectedSeasonIdx(idx);
                      setActiveEpisodeIdx(0);
                      setActiveServerIdx(0);
                      setIsPlaying(true);
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-200 flex-shrink-0 ${
                      isActive
                        ? 'bg-[#00ff73] text-black shadow-lg shadow-[#00ff73]/25 font-extrabold scale-[1.02]'
                        : 'bg-dark-800/90 hover:bg-dark-700 text-white border border-white/10'
                    }`}
                  >
                    {s.name || `SEASON ${s.season_number}`}
                  </button>
                );
              })}
            </div>

            {/* 2. SERVER Selector */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">SERVER</h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-3 gap-2">
                {episodeServers.slice(0, 6).map((srv, idx) => {
                  const isActive = idx === activeServerIdx;
                  const labelName = `SERVER ${idx + 1}`;
                  return (
                    <button
                      key={srv.id || idx}
                      onClick={() => {
                        setActiveServerIdx(idx);
                        setIsPlaying(true);
                      }}
                      className={`py-3 px-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-200 text-center ${
                        isActive
                          ? 'bg-[#00ff73] text-black shadow-md shadow-[#00ff73]/20 font-extrabold'
                          : 'bg-dark-800/90 hover:bg-dark-700 text-white border border-white/10'
                      }`}
                    >
                      {labelName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. EPISODES Selector Grid */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">EPISODES</h3>
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 max-h-[340px] overflow-y-auto pr-1 scrollbar-hide">
                {currentSeason.episodes.map((ep, idx) => {
                  const isActive = idx === activeEpisodeIdx;
                  const isUnreleased = ep.is_unreleased;

                  if (isUnreleased) {
                    return (
                      <button
                        key={ep.episode_number}
                        disabled
                        className="py-3 px-2 rounded-xl text-xs font-bold bg-dark-900/40 text-gray-600 border border-white/5 cursor-not-allowed text-center"
                      >
                        EP {ep.episode_number}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={ep.episode_number}
                      onClick={() => {
                        setActiveEpisodeIdx(idx);
                        setActiveServerIdx(0);
                        setIsPlaying(true);
                      }}
                      className={`py-3 px-2 rounded-xl text-xs font-bold transition-all duration-200 text-center ${
                        isActive
                          ? 'bg-[#00ff73] text-black font-extrabold shadow-md shadow-[#00ff73]/20 scale-105'
                          : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      EP {ep.episode_number}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM: SERIES FINISHED / STATUS CARD */}
        <div className="w-full bg-dark-900/90 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div>
            <span className="text-xs font-extrabold text-[#00ff73] tracking-widest uppercase block mb-1">
              SERIES {seriesStatus.toUpperCase() === 'COMPLETED' ? 'FINISHED' : 'ONGOING'}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {series.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase border ${
              streamMode === 'vip' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-[#00ff73]/15 text-[#00ff73] border-[#00ff73]/30'
            }`}>
              {streamMode === 'vip' ? 'VIP UNLOCKED' : 'FREE MODE'}
            </span>
          </div>
        </div>

        {/* Notice Card for Free Stream Users */}
        <div className="w-full rounded-2xl bg-dark-900 border border-white/10 p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 animate-fade-in">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 text-red-500 font-extrabold text-base sm:text-lg">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>විශේෂ දැනුම්දීමයි</span>
            </div>
            <p className="text-xs sm:text-sm text-dark-300 leading-relaxed font-sans">
              මෙම වෙබ් අඩවිය නොමිලේ පවත්වාගෙන යාම සඳහා වන අධික පිරිවැය ආවරණය කරගැනීමට කුඩා වෙළඳ දැන්වීම් කිහිපයක් ඇතුළත් කර ඇත. කරුණාකර ඒවා Skip කර නැවත මෙම පිටුවට පැමිණෙන්න. කිසිදු දැන්වීම් බාධාවකින් තොරව සුපිරි අත්දැකීමක් ලබා ගැනීමට Sign Up වී VIP Upgrade කරගන්න. සිදුවන අපහසුතාවයට අපගේ කණගාටුව!
            </p>
          </div>

          {hasVipAccess ? (
            <button
              onClick={() => {
                // Switch to VIP stream mode
                setActiveServerIdx(0);
                setIsPlaying(true);
              }}
              className="flex-shrink-0 px-6 py-3.5 rounded-xl font-bold text-white text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <span className="text-base">👑</span>
              <span>You are a VIP Member — Switch to VIP Mode</span>
            </button>
          ) : (
            <button
              onClick={handleUpgradeVip}
              className="flex-shrink-0 px-6 py-3.5 rounded-xl font-bold text-white text-xs sm:text-sm bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 shadow-lg shadow-fuchsia-500/25 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <span className="text-base">👑</span>
              <span>Upgrade to VIP</span>
            </button>
          )}
        </div>

      </div>

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
