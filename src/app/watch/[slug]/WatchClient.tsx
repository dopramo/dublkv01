'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeServerIdx, setActiveServerIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);

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

          {/* RIGHT: Controls (Server Selector & Mode) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">

            {/* Mode Banner */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">STREAM MODE</span>
                <span className="text-sm font-extrabold text-[#00ff73]">
                  {isFreeMode ? 'FREE MODE (WITH ADS)' : 'VIP UNLOCKED (NO ADS)'}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${isFreeMode ? 'bg-emerald-500/20 text-emerald-300' : 'bg-fuchsia-500/20 text-fuchsia-300'}`}>
                {isFreeMode ? 'FREE' : 'VIP'}
              </span>
            </div>

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

            {/* Info Cards */}
            <div className="p-4 rounded-xl bg-dark-900 border border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Release Year:</span>
                <span className="text-white font-semibold">{movie.release_year || 'N/A'}</span>
              </div>
              {movie.runtime && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Runtime:</span>
                  <span className="text-white font-semibold">{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
                </div>
              )}
              {movie.rating > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">TMDB Rating:</span>
                  <span className="text-yellow-400 font-semibold">⭐ {movie.rating.toFixed(1)}</span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* BOTTOM: MOVIE STATUS CARD matching TV Series player */}
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

      </div>
    </div>
  );
}
