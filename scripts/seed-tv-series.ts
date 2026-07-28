/**
 * DubLK TV Series Seeding Script
 * 
 * Searches TMDB for the 14 requested TV series, fetches seasons/episodes,
 * constructs episode server configurations, and inserts into Supabase.
 * 
 * Usage: npx tsx scripts/seed-tv-series.ts
 */

import { createClient } from '@supabase/supabase-js';
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jpkcywwrszbypoivftea.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TMDB_TOKEN = process.env.TMDB_API_KEY || '';

const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action & Adventure', 10762: 'Kids', 10765: 'Sci-Fi & Fantasy'
};

const TV_SERIES_LIST = [
  { query: 'The Adventures of Tintin', year: 1991 },
  { query: 'Ben 10', year: 2005 },
  { query: 'Ben 10: Alien Force', year: 2008 },
  { query: 'Ben 10: Ultimate Alien', year: 2010 },
  { query: 'Scooby-Doo! Mystery Incorporated', year: 2010 },
  { query: 'Lucky Luke', year: 1984 },
  { query: 'Asterix', year: 1989 },
  { query: 'The Batman', year: 2004 },
  { query: 'Sonic the Hedgehog', year: 1993 },
  { query: 'Avatar: The Last Airbender', year: 2005 },
  { query: 'X-Men', year: 1992 },
  { query: 'Spider-Man', year: 1994 },
  { query: 'Young Justice', year: 2010 },
  { query: 'Teen Titans', year: 2003 },
];

function slugify(title: string, year?: number): string {
  let slug = 'tv-' + title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (year) slug += `-${year}`;
  return slug;
}

async function searchTMDB(query: string) {
  const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US', page: '1' });
  const res = await fetch(`https://api.themoviedb.org/3/search/tv?${params}`, {
    headers: { accept: 'application/json', Authorization: `Bearer ${TMDB_TOKEN}` },
  });
  if (!res.ok) throw new Error(`TMDB TV search failed: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

async function getTVDetails(tmdbId: number) {
  const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`, {
    headers: { accept: 'application/json', Authorization: `Bearer ${TMDB_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getSeasonDetails(tmdbId: number, seasonNumber: number) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?language=en-US`, {
      headers: { accept: 'application/json', Authorization: `Bearer ${TMDB_TOKEN}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  console.log('📺 DubLK TV Series Seeding Script\n');
  console.log(`📊 Processing ${TV_SERIES_LIST.length} TV Series...\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TV_SERIES_LIST.length; i++) {
    const item = TV_SERIES_LIST[i];
    process.stdout.write(`[${i + 1}/${TV_SERIES_LIST.length}] ${item.query}... `);

    try {
      const searchResults = await searchTMDB(item.query);
      if (searchResults.length === 0) {
        console.log('❌ NOT FOUND');
        failCount++;
        continue;
      }

      const bestMatch = searchResults[0];
      const details = await getTVDetails(bestMatch.id);
      const firstAirYear = bestMatch.first_air_date ? parseInt(bestMatch.first_air_date.split('-')[0]) : item.year;
      const slug = slugify(bestMatch.name, firstAirYear);

      // Check if exists
      const { data: existing } = await supabase
        .from('movies')
        .select('id')
        .eq('tmdb_id', bestMatch.id)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`⏭️ SKIPPED (already exists)`);
        successCount++;
        continue;
      }

      const genres = (bestMatch.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean);

      // Build seasons (Season 1 and Season 2 if available, or top seasons)
      const numSeasons = Math.min(details?.number_of_seasons || 1, 3);
      const seasonsData = [];

      for (let s = 1; s <= numSeasons; s++) {
        const seasonInfo = await getSeasonDetails(bestMatch.id, s);
        const tmdbEpisodes = seasonInfo?.episodes || [];
        const episodeList = [];

        const episodeCount = tmdbEpisodes.length > 0 ? Math.min(tmdbEpisodes.length, 12) : 10;

        for (let ep = 1; ep <= episodeCount; ep++) {
          const tmdbEp = tmdbEpisodes[ep - 1];
          const epTitle = tmdbEp?.name || `Episode ${ep}`;
          
          // Generate sample 6 servers matching prompt UI
          const defaultServers = [
            { id: `s1-${s}-${ep}`, name: 'SERVER 1', input_type: 'url', url: `https://vidsrc.me/embed/tv/${bestMatch.id}/${s}/${ep}`, enabled: true },
            { id: `s2-${s}-${ep}`, name: 'SERVER 2', input_type: 'url', url: `https://embed.su/embed/tv/${bestMatch.id}/${s}/${ep}`, enabled: true },
            { id: `s3-${s}-${ep}`, name: 'SERVER 3', input_type: 'url', url: `https://2embed.org/embed/tv/${bestMatch.id}/${s}/${ep}`, enabled: true },
            { id: `s4-${s}-${ep}`, name: 'SERVER 4', input_type: 'url', url: `https://autoembed.co/tv/tmdb/${bestMatch.id}-${s}-${ep}`, enabled: true },
            { id: `s5-${s}-${ep}`, name: 'SERVER 5', input_type: 'url', url: `https://multiembed.mov/directstream.php?video_id=${bestMatch.id}&s=${s}&e=${ep}`, enabled: true },
            { id: `s6-${s}-${ep}`, name: 'SERVER 6', input_type: 'url', url: `https://vidlink.pro/tv/${bestMatch.id}/${s}/${ep}`, enabled: true },
          ];

          episodeList.push({
            episode_number: ep,
            title: epTitle,
            description: tmdbEp?.overview || '',
            thumbnail_url: tmdbEp?.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}` : null,
            servers: defaultServers,
          });
        }

        seasonsData.push({
          season_number: s,
          name: `SEASON ${s}`,
          episodes: episodeList,
        });
      }

      // Insert into movies table with is_tv payload
      const { error: insertError } = await supabase.from('movies').insert({
        tmdb_id: bestMatch.id,
        title: bestMatch.name,
        slug,
        description: bestMatch.overview || details?.overview || null,
        poster_url: bestMatch.poster_path ? `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}` : null,
        backdrop_url: bestMatch.backdrop_path ? `https://image.tmdb.org/t/p/original${bestMatch.backdrop_path}` : null,
        genres: genres.length > 0 ? genres : ['Animation', 'Action'],
        rating: bestMatch.vote_average || 8.0,
        release_year: firstAirYear,
        is_published: true,
        free_servers: {
          is_tv: true,
          media_type: 'tv',
          status: 'Completed', // 'Completed' or 'Ongoing'
          seasons: seasonsData,
        },
        vip_servers: [],
      });

      if (insertError) {
        console.log(`❌ DB ERROR: ${insertError.message}`);
        failCount++;
      } else {
        console.log(`✅ ${bestMatch.name} (${firstAirYear}) [Seasons: ${seasonsData.length}]`);
        successCount++;
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (err: any) {
      console.log(`❌ ERROR: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n✨ TV Series Seeding Complete: ${successCount} added, ${failCount} failed.`);
}

main().catch(console.error);
