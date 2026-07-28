import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q) {
    return NextResponse.json({ movies: [] });
  }

  const supabase = createAdminClient();

  const { data: movies, error } = await supabase
    .from('movies')
    .select('id, slug, title, release_year, poster_url, genres, rating, free_servers')
    .eq('is_published', true)
    .ilike('title', `%${q}%`)
    .order('rating', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ movies: movies || [] });
}
