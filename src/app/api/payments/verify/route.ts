import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const isServiceJwt = serviceKey.startsWith('eyJ');

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    isServiceJwt ? serviceKey : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function canMaintainUser(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    const isAdm = Boolean(data?.is_admin === true || data?.role === 'admin');
    return isAdm || data?.role === 'editor' || data?.role === 'moderator';
  } catch {
    return false;
  }
}

// GET - List payments (pending, verified, rejected, or all)
export async function GET(request: NextRequest) {
  const authClient = getSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  
  if (!user || !(await canMaintainUser(authClient, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const statusFilter = request.nextUrl.searchParams.get('status');

  const db = getServiceClient();

  let query = db
    .from('purchases')
    .select(`
      *,
      profiles:user_id (email, full_name),
      movies:movie_id (title)
    `)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: purchases, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purchases: purchases || [] });
}

// PATCH - Verify, reject, or reset payment status
export async function PATCH(request: NextRequest) {
  const authClient = getSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  
  if (!user || !(await canMaintainUser(authClient, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { purchaseId, status } = await request.json();

  if (!purchaseId || !['verified', 'rejected', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const db = getServiceClient();

  const { data: purchase, error } = await db
    .from('purchases')
    .update({ status })
    .eq('id', purchaseId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purchase });
}
