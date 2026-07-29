'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
  is_unreleased?: boolean;
}

interface SeasonData {
  season_number: number;
  name: string;
  episodes: EpisodeData[];
}

interface TVSeriesPayload {
  id: string;
  title: string;
  slug: string;
  poster_url: string | null;
  backdrop_url: string | null;
  rating: number;
  release_year: number | null;
  description: string | null;
  genres: string[];
  free_servers: {
    is_tv?: boolean;
    status?: string;
    seasons?: SeasonData[];
  };
}

interface WatchTVClientProps {
  series: TVSeriesPayload;
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
  return extractSrcFromEmbed(rawInput);
}

export default function WatchTVClient({ series }: WatchTVClientProps) {
  const router = useRouter();
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Seasons array
  const seasons: SeasonData[] = series.free_servers?.seasons || [
    {
      season_number: 1,
      name: 'SEASON 1',
      episodes: Array.from({ length: 12 }, (_, i) => ({
        episode_number: i + 1,
        title: `Episode ${i + 1}`,
        servers: [
          { name: 'SERVER 1', url: `https://vidsrc.me/embed/tv/${series.slug}/1/${i + 1}` },
          { name: 'SERVER 2', url: `https://embed.su/embed/tv/${series.slug}/1/${i + 1}` },
          { name: 'SERVER 3', url: `https://2embed.org/embed/tv/${series.slug}/1/${i + 1}` },
          { name: 'SERVER 4', url: `https://autoembed.co/tv/tmdb/${series.slug}-1-${i + 1}` },
          { name: 'SERVER 5', url: `https://multiembed.mov/directstream.php?video_id=${series.slug}&s=1&e=${i + 1}` },
          { name: 'SERVER 6', url: `https://vidlink.pro/tv/${series.slug}/1/${i + 1}` },
        ]
      }))
    }
  ];

  const [activeSeasonIdx, setActiveSeasonIdx] = useState(0);
  const [activeEpisodeIdx, setActiveEpisodeIdx] = useState(0);
  const [activeServerIdx, setActiveServerIdx] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const currentSeason = seasons[activeSeasonIdx] || seasons[0];
  const currentEpisode = currentSeason?.episodes?.[activeEpisodeIdx] || currentSeason?.episodes?.[0];

  // Available servers for current episode (fill up to 6 servers)
  const episodeServers: ServerOption[] = (() => {
    const raw = (currentEpisode?.servers || []).filter(s => s.enabled !== false);
    if (raw.length > 0) return raw;

    // Default fallback 6 servers if none explicitly configured
    return [
      { name: 'SERVER 1', url: `https://vidsrc.me/embed/tv/${series.slug}/${currentSeason.season_number}/${currentEpisode?.episode_number || 1}` },
      { name: 'SERVER 2', url: `https://embed.su/embed/tv/${series.slug}/${currentSeason.season_number}/${currentEpisode?.episode_number || 1}` },
      { name: 'SERVER 3', url: `https://2embed.org/embed/tv/${series.slug}/${currentSeason.season_number}/${currentEpisode?.episode_number || 1}` },
      { name: 'SERVER 4', url: `https://autoembed.co/tv/tmdb/${series.slug}-${currentSeason.season_number}-${currentEpisode?.episode_number || 1}` },
      { name: 'SERVER 5', url: `https://multiembed.mov/directstream.php?video_id=${series.slug}&s=${currentSeason.season_number}&e=${currentEpisode?.episode_number || 1}` },
      { name: 'SERVER 6', url: `https://vidlink.pro/tv/${series.slug}/${currentSeason.season_number}/${currentEpisode?.episode_number || 1}` },
    ];
  })();

  const currentServer = episodeServers[activeServerIdx] || episodeServers[0];
  const embedUrl = getEmbedUrl(currentServer);

  // Helper title initials e.g. "AKR" from title
  const titleInitials = series.title
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 4);

  const epCodeLabel = `${titleInitials} EP${String(currentEpisode?.episode_number || 1).padStart(2, '0')}`;
  const seriesStatus = series.free_servers?.status || 'Completed';

  // Handle Episode change
  const selectEpisode = (idx: number) => {
    setActiveEpisodeIdx(idx);
    setActiveServerIdx(0); // reset to server 1
    setIsPlaying(true);
    setIframeLoaded(false);
  };

  // Handle Season change
  const selectSeason = (idx: number) => {
    setActiveSeasonIdx(idx);
    setActiveEpisodeIdx(0);
    setActiveServerIdx(0);
    setIsPlaying(false);
    setIframeLoaded(false);
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 min-h-screen bg-dark-950 text-white">
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
                  onLoad={() => setIframeLoaded(true)}
                />
              ) : (
                /* Poster / Play Overlay Screen matching screenshot */
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
                    <span className="text-sm font-semibold text-white/90 group-hover/play:text-white">Play</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: Controls (Season, Server, Episodes) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">

            {/* 1. SEASON Selector */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-2">SEASON</h3>
              <div className="flex flex-wrap gap-2">
                {seasons.map((s, idx) => {
                  const isActive = idx === activeSeasonIdx;
                  return (
                    <button
                      key={s.season_number}
                      onClick={() => selectSeason(idx)}
                      className={`w-full py-3 px-4 rounded-xl text-sm font-bold tracking-wider transition-all duration-200 uppercase ${
                        isActive
                          ? 'bg-[#00ff73] text-black shadow-lg shadow-[#00ff73]/25 scale-[1.01]'
                          : 'bg-dark-800/90 hover:bg-dark-700 text-white border border-white/10'
                      }`}
                    >
                      {s.name || `SEASON ${s.season_number}`}
                    </button>
                  );
                })}
              </div>
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
                        className="py-2.5 rounded-xl text-xs font-bold border border-dashed border-gray-700 text-gray-500 cursor-not-allowed bg-dark-900/40 text-center"
                      >
                        EP {ep.episode_number}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={ep.episode_number}
                      onClick={() => selectEpisode(idx)}
                      className={`py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all duration-200 text-center ${
                        isActive
                          ? 'bg-[#00ff73] text-black shadow-md shadow-[#00ff73]/30 font-extrabold scale-105'
                          : 'bg-dark-800/90 hover:bg-dark-700 text-white border border-white/10'
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

        {/* BOTTOM: SERIES FINISHED / STATUS CARD matching screenshot */}
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
            <span className="px-5 py-2.5 rounded-xl bg-[#00ff73]/15 text-[#00ff73] border border-[#00ff73]/30 text-xs font-black tracking-wider uppercase">
              {seriesStatus.toUpperCase() === 'COMPLETED' ? 'COMPLETED' : 'ONGOING'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
