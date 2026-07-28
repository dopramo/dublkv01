import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMovieCredits, type TMDBCredits } from '@/lib/tmdb';
import MovieDetailClient from './MovieDetailClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { slug: string };
}

async function getMovie(slug: string) {
  const supabase = createAdminClient();
  const { data: movie, error } = await supabase
    .from('movies')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !movie) return null;
  return movie;
}

async function getRelatedMovies(genres: string[], excludeId: string) {
  const supabase = createAdminClient();
  const { data: movies } = await supabase
    .from('movies')
    .select('*')
    .eq('is_published', true)
    .neq('id', excludeId)
    .overlaps('genres', genres)
    .limit(12);

  if (!movies) return [];
  return movies.filter((m: any) => !m.free_servers?.is_tv);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getMovie(params.slug);
  if (!movie) return { title: 'Movie Not Found' };

  return {
    title: `${movie.title} (Sinhala Dubbed)`,
    description: movie.description || `Watch ${movie.title} dubbed in Sinhala on DubLK.`,
    openGraph: {
      title: `${movie.title} - Sinhala Dubbed | DubLK`,
      description: movie.description || `Watch ${movie.title} dubbed in Sinhala.`,
      images: movie.backdrop_url ? [{ url: movie.backdrop_url }] : [],
      type: 'video.movie',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${movie.title} - Sinhala Dubbed | DubLK`,
      description: movie.description || `Watch ${movie.title} dubbed in Sinhala.`,
      images: movie.backdrop_url ? [movie.backdrop_url] : [],
    },
  };
}

export default async function MovieDetailPage({ params }: Props) {
  const movie = await getMovie(params.slug);
  if (!movie) notFound();

  // Fetch credits + related movies in parallel; credits failure is non-fatal
  const [relatedMovies, credits] = await Promise.all([
    getRelatedMovies(movie.genres || [], movie.id),
    movie.tmdb_id ? getMovieCredits(movie.tmdb_id).catch(() => ({ cast: [], crew: [] } as TMDBCredits)) : Promise.resolve({ cast: [], crew: [] } as TMDBCredits),
  ]);

  return <MovieDetailClient movie={movie} relatedMovies={relatedMovies} credits={credits} />;
}
