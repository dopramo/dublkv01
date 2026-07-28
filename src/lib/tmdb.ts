const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  runtime?: number;
  genres?: { id: number; name: string }[];
}

export interface TMDBSearchResult {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western',
};

function getHeaders() {
  return {
    accept: 'application/json',
    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
  };
}

export async function searchMovie(query: string, year?: number): Promise<TMDBMovie[]> {
  const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US', page: '1' });
  if (year) params.set('year', year.toString());
  
  const res = await fetch(`${TMDB_BASE_URL}/search/movie?${params}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  
  const data: TMDBSearchResult = await res.json();
  return data.results;
}

export async function getMovieDetails(tmdbId: number): Promise<TMDBMovie> {
  const res = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}?language=en-US`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`TMDB details failed: ${res.status}`);
  return res.json();
}

export async function getMovieCredits(tmdbId: number): Promise<TMDBCredits> {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}/credits?language=en-US`, {
      headers: getHeaders(),
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok) return { cast: [], crew: [] };
    const data = await res.json();
    return {
      cast: (data.cast || []).slice(0, 20),  // top 20 cast
      crew: (data.crew || []).filter((c: TMDBCrewMember) =>
        ['Director', 'Producer', 'Screenplay', 'Writer', 'Story', 'Director of Photography'].includes(c.job)
      ).slice(0, 10),
    };
  } catch {
    return { cast: [], crew: [] };
  }
}

export async function getTVCredits(tmdbId: number): Promise<TMDBCredits> {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/credits?language=en-US`, {
      headers: getHeaders(),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { cast: [], crew: [] };
    const data = await res.json();
    return {
      cast: (data.cast || []).slice(0, 20),
      crew: (data.crew || []).filter((c: TMDBCrewMember) =>
        ['Executive Producer', 'Producer', 'Creator', 'Writer', 'Director'].includes(c.job)
      ).slice(0, 10),
    };
  } catch {
    return { cast: [], crew: [] };
  }
}

export function getPosterUrl(path: string | null, size: string = 'w500'): string {
  if (!path) return '/placeholder-poster.jpg';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path: string | null, size: string = 'original'): string {
  if (!path) return '/placeholder-backdrop.jpg';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export interface TMDBTVSeries {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  seasons?: {
    season_number: number;
    episode_count: number;
    name: string;
  }[];
}

export async function searchTVSeries(query: string, year?: number): Promise<TMDBTVSeries[]> {
  const params = new URLSearchParams({ query, include_adult: 'false', language: 'en-US', page: '1' });
  if (year) params.set('first_air_date_year', year.toString());
  
  const res = await fetch(`${TMDB_BASE_URL}/search/tv?${params}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`TMDB TV search failed: ${res.status}`);
  
  const data = await res.json();
  return data.results || [];
}

export async function getTVSeriesDetails(tmdbId: number): Promise<TMDBTVSeries> {
  const res = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?language=en-US`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`TMDB TV details failed: ${res.status}`);
  return res.json();
}

export async function getTVSeasonDetails(tmdbId: number, seasonNumber: number) {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?language=en-US`, { headers: getHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function getGenreNames(genreIds: number[]): string[] {
  return genreIds.map(id => GENRE_MAP[id]).filter(Boolean);
}

export function getGenreNamesFromObjects(genres: { id: number; name: string }[]): string[] {
  return genres.map(g => g.name);
}

