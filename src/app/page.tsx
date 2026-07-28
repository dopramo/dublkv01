import { createAdminClient } from '@/lib/supabase/admin';
import HomeClient from '@/app/HomeClient';
import MovieRow from '@/components/ui/MovieRow';
import TVSeriesRow from '@/components/ui/TVSeriesRow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getMediaItems() {
  const supabase = createAdminClient();
  const { data: items, error } = await supabase
    .from('movies')
    .select('*')
    .eq('is_published', true);

  if (error) {
    console.error('Failed to fetch media:', error);
    return [];
  }

  // Sort by latest update timestamp (falling back to creation date)
  const sorted = [...(items || [])].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at).getTime();
    const timeB = new Date(b.updated_at || b.created_at).getTime();
    return timeB - timeA;
  });

  return sorted;
}

export default async function HomePage() {
  const allMedia = await getMediaItems();

  // Separate Movies vs TV Series
  const movies = allMedia.filter(m => !m.free_servers?.is_tv);
  const tvSeries = allMedia.filter(m => m.free_servers?.is_tv);

  // Hero banner uses top rated items (movies or tv) with backdrops
  const heroMovies = [...allMedia]
    .filter((m) => m.backdrop_url)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  // 1. Recently Added Movies
  const recentlyAddedMovies = movies.slice(0, 20);

  // 2. Recently Added Tv series
  const recentlyAddedTVSeries = tvSeries.slice(0, 20);

  // 3. Top Rated Movies
  const topRatedMovies = [...movies]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  // 4. Top Rated Tv series
  const topRatedTVSeries = [...tvSeries]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  return (
    <div>
      {/* Hero Banner */}
      <HomeClient heroMovies={heroMovies} />

      {/* Rows in exact requested order */}
      <div className="relative mt-4 sm:-mt-6 lg:-mt-12 z-10 space-y-8 sm:space-y-10 pb-16">
        <MovieRow title="Recently Added Movies" movies={recentlyAddedMovies} icon="🎬" />
        <TVSeriesRow title="Recently Added Tv series" seriesList={recentlyAddedTVSeries} icon="📺" />
        <MovieRow title="Top Rated Movies" movies={topRatedMovies} icon="⭐" />
        <TVSeriesRow title="Top Rated Tv series" seriesList={topRatedTVSeries} icon="🔥" />
      </div>
    </div>
  );
}
