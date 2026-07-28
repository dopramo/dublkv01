import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import WatchClient from './WatchClient';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { slug: string };
  searchParams: { mode?: string };
}

async function getMovie(slug: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await getMovie(params.slug);
  return {
    title: movie ? `Watch ${movie.title} | DubLK` : 'Watch Movie | DubLK',
    robots: { index: false, follow: false },
  };
}

export default async function WatchPage({ params, searchParams }: Props) {
  const movie = await getMovie(params.slug);
  if (!movie) notFound();

  const isFreeMode = searchParams.mode === 'free';

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black pt-16 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading player..." />
      </div>
    }>
      <WatchClient movie={movie} isFreeMode={isFreeMode} />
    </Suspense>
  );
}
