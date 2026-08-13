import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('coming_soon')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Coming soon query info:', error.message);
      return NextResponse.json({ comingSoon: [] });
    }

    return NextResponse.json({ comingSoon: data || [] });
  } catch (err: any) {
    console.error('Failed to fetch coming soon media:', err);
    return NextResponse.json({ comingSoon: [] });
  }
}
