import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Cookie-based client — used only to verify the caller's identity and admin status.
 * Subject to RLS. READ ONLY.
 */
function getAuthClient() {
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

/**
 * Service-role client — bypasses RLS entirely.
 * Used for admin write operations (inserting purchases for any user, etc.)
 *
 * The key must be the SERVICE ROLE JWT (starts with "eyJ...") from
 * Supabase Dashboard › Settings › API › Project API keys › service_role.
 *
 * If only a Management PAT (sbp_...) is present we fall back to anon key
 * and these writes will be blocked by RLS — update .env.local / Netlify env vars.
 */
function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const isServiceJwt = serviceKey.startsWith('eyJ');

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    isServiceJwt ? serviceKey : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(data?.is_admin === true || data?.role === 'admin');
}

// ─── GET — List all users with their purchases ────────────────────────────────
export async function GET(request: NextRequest) {
  const authClient  = getAuthClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user || !(await isAdmin(authClient, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Use service client so we can read all profiles regardless of RLS
  const db = getServiceClient();

  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const { data: purchases, error: purchasesError } = await db
    .from('purchases')
    .select(`
      *,
      movies:movie_id (id, title)
    `)
    .order('created_at', { ascending: false });

  if (purchasesError) {
    return NextResponse.json({ error: purchasesError.message }, { status: 500 });
  }

  const profilesWithPurchases = (profiles || []).map((profile) => ({
    ...profile,
    purchases: (purchases || []).filter((p: any) => p.user_id === profile.id),
  }));

  return NextResponse.json({ users: profilesWithPurchases });
}

// ─── PATCH — Update a user's profile (e.g. toggle is_admin) ──────────────────
export async function PATCH(request: NextRequest) {
  const authClient = getAuthClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user || !(await isAdmin(authClient, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  if (updates.role) {
    updates.is_admin = updates.role === 'admin';
  }

  // Use service client to bypass RLS on profiles
  const db = getServiceClient();

  let { data: profile, error } = await db
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  // If role column is missing in database schema, strip role and retry with is_admin
  if (error && (error.message?.includes('role') || error.code === 'PGRST204')) {
    delete updates.role;
    const retry = await db
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    profile = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile });
}

// ─── POST — Manually grant access to a user (admin-created purchase) ─────────
export async function POST(request: NextRequest) {
  const authClient = getAuthClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user || !(await isAdmin(authClient, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId, type, movieId } = await request.json();

  if (!userId || !type) {
    return NextResponse.json({ error: 'userId and type required' }, { status: 400 });
  }

  if (!['single', 'full'].includes(type)) {
    return NextResponse.json({ error: 'type must be "single" or "full"' }, { status: 400 });
  }

  // ✅ Use service client — bypasses RLS so we can insert for any userId
  const db = getServiceClient();

  // Check if user already has an active verified VIP Access of this type
  const { data: existing } = await db
    .from('purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('status', 'verified')
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `User already has active ${type === 'full' ? 'VIP Lifetime' : 'VIP 1 Month'} Access` },
      { status: 400 }
    );
  }

  const { data: purchase, error } = await db
    .from('purchases')
    .insert({
      user_id: userId,
      movie_id: movieId || null,
      type: type,         // 'full' for Lifetime, 'single' for 1 Month
      amount: 0,          // admin-granted, no charge
      status: 'verified',
      payment_method: 'admin_grant',
    })
    .select(`
      *,
      movies:movie_id (id, title)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ purchase });
}

// ─── DELETE — Delete a user account OR revoke access (delete a purchase) ────
export async function DELETE(request: NextRequest) {
  const authClient = getAuthClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user || !(await isAdmin(authClient, user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { targetUserId, purchaseId } = await request.json();

  const db = getServiceClient();

  // If targetUserId is provided, delete the entire user account
  if (targetUserId) {
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own admin account.' }, { status: 400 });
    }

    // Delete user purchases first
    await db.from('purchases').delete().eq('user_id', targetUserId);

    // Delete user profile
    await db.from('profiles').delete().eq('id', targetUserId);

    // Delete auth user from Supabase Auth
    try {
      if (db.auth && db.auth.admin) {
        await db.auth.admin.deleteUser(targetUserId);
      }
    } catch (authErr) {
      console.warn('Could not delete auth user (requires service role key):', authErr);
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  }

  // If purchaseId is provided, revoke that purchase
  if (purchaseId) {
    const { error } = await db
      .from('purchases')
      .delete()
      .eq('id', purchaseId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'targetUserId or purchaseId required' }, { status: 400 });
}
