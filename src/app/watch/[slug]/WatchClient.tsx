'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PricingModal from '@/components/payment/PricingModal';

interface StreamServer {
  url?: string;
  embed_code?: string;
  input_type?: 'embed' | 'url';
  name?: string;
  label?: string;
  enabled?: boolean;
}

interface WatchClientProps {
  movie: {
    id: string;
    title: string;
    slug: string;
    // Legacy columns
    server1_url: string | null;
    server2_url: string | null;
    // Server columns
    free_servers: StreamServer[] | null;
    vip_servers: StreamServer[] | null;
    poster_url: string | null;
    backdrop_url: string | null;
    rating: number;
    release_year: number | null;
    runtime: number | null;
    genres: string[];
  };
  isFreeMode: boolean;
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

function getEmbedUrl(server: StreamServer | null): string {
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

export default function WatchClient({ movie, isFreeMode }: WatchClientProps) {
  const { user, openAuthModal, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeServerIdx, setActiveServerIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [hasVipAccess, setHasVipAccess] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);

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
          const hasSingle = purchases.some((p: any) => p.type === 'single' && p.movie_id === movie.id);
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
  }, [user, movie.id]);

  // Available servers for current mode
  const availableServers: StreamServer[] = (() => {
    const rawList = isFreeMode
      ? (movie.free_servers || []).filter((s: any) => s.enabled !== false)
      : (movie.vip_servers || []).filter((s: any) => s.enabled !== false);

    if (rawList.length > 0) return rawList;

    const legacy: StreamServer[] = [];
    if (movie.server1_url) legacy.push({ url: movie.server1_url, name: 'SERVER 1' });
    if (movie.server2_url) legacy.push({ url: movie.server2_url, name: 'SERVER 2' });
    return legacy;
  })();

  // Fallback 6 servers if none configured
  const displayServers: StreamServer[] = availableServers.length > 0 ? availableServers : [
    { name: 'SERVER 1', url: `https://vidsrc.me/embed/movie/${movie.slug}` },
    { name: 'SERVER 2', url: `https://embed.su/embed/movie/${movie.slug}` },
    { name: 'SERVER 3', url: `https://2embed.org/embed/movie/${movie.slug}` },
    { name: 'SERVER 4', url: `https://autoembed.co/movie/tmdb/${movie.slug}` },
    { name: 'SERVER 5', url: `https://multiembed.mov/directstream.php?video_id=${movie.slug}` },
    { name: 'SERVER 6', url: `https://vidlink.pro/movie/${movie.slug}` },
  ];

  // Auth check for VIP mode
  useEffect(() => {
    if (isFreeMode) return;
    if (authLoading) return;
    if (!user) {
      router.replace(`/movies/${movie.slug}`);
    }
  }, [isFreeMode, user, authLoading, movie.slug, router]);

  const currentServer = displayServers[activeServerIdx] || displayServers[0];
  const embedUrl = currentServer ? getEmbedUrl(currentServer) : null;

  const titleInitials = movie.title
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 4);

  const movieCodeLabel = `${titleInitials} (${movie.release_year || 'MOVIE'})`;

  const handleServerSwitch = (idx: number) => {
    setActiveServerIdx(idx);
    setIsPlaying(true);
    setIframeLoaded(false);
  };

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
              {/* Overlay: Top Left Title Badge */}
              <div className="absolute top-4 left-4 z-20 pointer-events-none">
                <span className="text-sm sm:text-base font-bold tracking-wider text-white text-shadow drop-shadow-md">
                  {movieCodeLabel}
                </span>
              </div>

              {/* Player / Iframe */}
              {isPlaying && embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-full border-0 relative z-10"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  onLoad={() => setIframeLoaded(true)}
                />
              ) : (
                /* Poster / Play Overlay Screen */
                <div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-cover bg-center cursor-pointer"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgba(10,10,12,0.4), rgba(10,10,12,0.85)), url(${movie.backdrop_url || movie.poster_url || '/placeholder-backdrop.jpg'})`
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
                    <span className="text-sm font-semibold text-white/90 group-hover/play:text-white">Play Movie</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: Controls (Server Selector) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">

            {/* SERVER Selector */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-3">SERVER</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {displayServers.map((srv, idx) => {
                  const isActive = idx === activeServerIdx;
                  const labelName = `SERVER ${idx + 1}`;
                  return (
                    <button
                      key={srv.url || idx}
                      onClick={() => handleServerSwitch(idx)}
                      className={`py-3.5 px-3 rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-200 text-center ${
                        isActive
                          ? 'bg-[#00ff73] text-black shadow-lg shadow-[#00ff73]/25 font-extrabold scale-[1.02]'
                          : 'bg-dark-800/90 hover:bg-dark-700 text-white border border-white/10'
                      }`}
                    >
                      {labelName}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM: MOVIE STATUS CARD */}
        <div className="w-full bg-dark-900/90 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div>
            <span className="text-xs font-extrabold text-[#00ff73] tracking-widest uppercase block mb-1">
              FULL MOVIE STREAMING
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {movie.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-5 py-2.5 rounded-xl bg-[#00ff73]/15 text-[#00ff73] border border-[#00ff73]/30 text-xs font-black tracking-wider uppercase">
              {isFreeMode ? 'FREE MODE' : 'VIP UNLOCKED'}
            </span>
          </div>
        </div>

        {/* Notice Card for Free Stream Users */}
        {isFreeMode && (
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
                onClick={() => router.push(`/watch/${movie.slug}?mode=vip`)}
                className="flex-shrink-0 px-6 py-3.5 rounded-xl font-bold text-white text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap"
              >
                <span className="text-base">👑</span>
                <span>You are a VIP Member — Switch to VIP Mode</span>
              </button>
            ) : (
              <button
                onClick={handleUpgradeVip}
                className="flex-shrink-0 px-6 py-3.5 rounded-xl font-bold text-white text-xs sm:text-sm bg-gradient-to-r from-[#9b5ff7] to-[#5dcdfb] hover:from-[#8642f4] hover:to-[#38bdf8] shadow-lg shadow-[#9b5ff7]/25 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 whitespace-nowrap"
              >
                <span className="text-base">👑</span>
                <span>Upgrade to VIP</span>
              </button>
            )}
          </div>
        )}

      </div>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        movieId={movie.id}
        movieTitle={movie.title}
        movieSlug={movie.slug}
      />
    </div>
  );
}
