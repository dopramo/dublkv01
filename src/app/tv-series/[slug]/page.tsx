import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTVCredits, type TMDBCredits } from '@/lib/tmdb';
import TVSeriesDetailClient from './TVSeriesDetailClient';

interface Props {
  params: {
    slug: string;
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getTVSeries(slug: string) {
  const supabase = createAdminClient();
  const { data: item, error } = await supabase
    .from('movies')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !item) {
    return null;
  }

  return item;
}

async function getRelatedTVSeries(genres: string[], excludeId: string) {
  const supabase = createAdminClient();
  const { data: items } = await supabase
    .from('movies')
    .select('*')
    .eq('is_published', true)
    .neq('id', excludeId)
    .overlaps('genres', genres)
    .limit(12);

  if (!items) return [];
  // Filter only TV series
  return items.filter((item: any) => item.free_servers?.is_tv);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const series = await getTVSeries(params.slug);
  if (!series) {
    return { title: 'TV Series Not Found | DubLK' };
  }

  return {
    title: `Watch ${series.title} (Sinhala Dubbed) | DubLK`,
    description: series.description || `Watch ${series.title} dubbed in Sinhala on DubLK.`,
    openGraph: {
      title: `${series.title} - Sinhala Dubbed | DubLK`,
      description: series.description || undefined,
      images: series.backdrop_url ? [{ url: series.backdrop_url }] : series.poster_url ? [{ url: series.poster_url }] : [],
    },
  };
}

export default async function WatchTVPage({ params }: Props) {
  const series = await getTVSeries(params.slug);

  if (!series) {
    notFound();
  }

  const [relatedSeries, credits] = await Promise.all([
    getRelatedTVSeries(series.genres || [], series.id),
    series.tmdb_id ? getTVCredits(series.tmdb_id).catch(() => ({ cast: [], crew: [] } as TMDBCredits)) : Promise.resolve({ cast: [], crew: [] } as TMDBCredits),
  ]);

  return <TVSeriesDetailClient series={series} relatedSeries={relatedSeries} credits={credits} />;
}
