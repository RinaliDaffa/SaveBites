import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('listings')
      .select('*, merchants(name, category)')
      .eq('is_active', true)
      .eq('is_sold_out', false)
      .ilike('title', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[LISTINGS SEARCH] error:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('[LISTINGS SEARCH] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}