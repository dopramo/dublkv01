import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

function getSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

async function canMaintain(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return Boolean(data?.is_admin === true || data?.role === 'admin' || data?.role === 'editor' || data?.role === 'moderator');
  } catch {
    return false;
  }
}

// GET - List all coming soon items
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !(await canMaintain(supabase, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const adminClient = createAdminClient();
  const { data: comingSoon, error } = await adminClient
    .from('coming_soon')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list coming soon items:', error.message);
    return NextResponse.json({ comingSoon: [] });
  }

  return NextResponse.json({ comingSoon: comingSoon || [] });
}

// POST - Add a new coming soon item
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !(await canMaintain(supabase, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { title, type, poster_url, backdrop_url, description, release_date, genres, rating, tmdb_id } = body;

  if (!title || !poster_url) {
    return NextResponse.json({ error: 'Title and Poster URL are required' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('coming_soon')
    .insert([{
      title,
      type: type || 'movie',
      poster_url,
      backdrop_url: backdrop_url || null,
      description: description || '',
      release_date: release_date || 'Coming Soon',
      genres: genres || [],
      rating: rating || 0,
      tmdb_id: tmdb_id || null,
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comingSoon: data });
}

// PATCH - Update a coming soon item
export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !(await canMaintain(supabase, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('coming_soon')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ comingSoon: data });
}

// DELETE - Remove a coming soon item
export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !(await canMaintain(supabase, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('coming_soon')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
