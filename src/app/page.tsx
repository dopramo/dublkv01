import { createAdminClient } from '@/lib/supabase/admin';
import HomeClient from '@/app/HomeClient';
import MovieRow from '@/components/ui/MovieRow';
import TVSeriesRow from '@/components/ui/TVSeriesRow';
import ComingSoonRow from '@/components/ui/ComingSoonRow';
import MediaRow from '@/components/ui/MediaRow';

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

async function getComingSoonItems() {
  try {
    const supabase = createAdminClient();
    const { data: items, error } = await supabase
      .from('coming_soon')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return items || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [allMedia, comingSoonItems] = await Promise.all([
    getMediaItems(),
    getComingSoonItems(),
  ]);

  // Separate Movies vs TV Series
  const movies = allMedia.filter(m => !m.free_servers?.is_tv);
  const tvSeries = allMedia.filter(m => m.free_servers?.is_tv);

  // Separate Coming Soon Movies vs TV Series
  const comingSoonMovies = comingSoonItems.filter(item => item.type !== 'tv');
  const comingSoonTVSeries = comingSoonItems.filter(item => item.type === 'tv');

  // Hero banner uses top rated items (movies or tv) with backdrops
  const heroMovies = [...allMedia]
    .filter((m) => m.backdrop_url)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  // 1. Recently Added Movies
  const recentlyAddedMovies = movies.slice(0, 20);

  // 2. Coming Soon Movies
  const comingSoonMoviesList = comingSoonMovies.slice(0, 20);

  // 3. Recently Added TV series
  const recentlyAddedTVSeries = tvSeries.slice(0, 20);

  // 4. Coming Soon TV series
  const comingSoonTVSeriesList = comingSoonTVSeries.slice(0, 20);

  // 5. Top Rated ( film + tv series )
  const topRatedMedia = [...allMedia]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  return (
    <div>
      {/* Hero Banner */}
      <HomeClient heroMovies={heroMovies} />

      {/* Rows in exact requested order */}
      <div className="relative mt-4 sm:-mt-6 lg:-mt-12 z-10 space-y-8 sm:space-y-10 pb-16">
        {/* 1 Recently added movies */}
        <MovieRow title="Recently Added Movies" movies={recentlyAddedMovies} icon="🎬" />

        {/* 2 Coming soon movies */}
        <ComingSoonRow title="Coming Soon Movies" comingSoonItems={comingSoonMoviesList} icon="⏳" />

        {/* 3 Recently added tv series */}
        <TVSeriesRow title="Recently Added TV Series" seriesList={recentlyAddedTVSeries} icon="📺" />

        {/* 4 Coming soon tv series */}
        <ComingSoonRow title="Coming Soon TV Series" comingSoonItems={comingSoonTVSeriesList} icon="⏳" />

        {/* 5 Top rated ( film + tv series ) */}
        <MediaRow title="Top Rated" items={topRatedMedia} icon="⭐" />
      </div>
    </div>
  );
}
