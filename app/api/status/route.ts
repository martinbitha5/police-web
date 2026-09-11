import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadStatus } from '@/lib/status';

/**
 * État des services en JSON, public : consommé par la pastille du pied de
 * page et utilisable par des outils tiers (supervision, Slack, etc.).
 * Lecture anonyme : les vues sont ouvertes en lecture par la RLS.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const snap = await loadStatus(supabase);
    return NextResponse.json(
      {
        status: snap.overall,
        checked_at: snap.checkedAt,
        services: snap.services.map((s) => ({
          key: s.key,
          name: s.name,
          ok: s.ok,
          status_code: s.statusCode,
          latency_ms: s.latencyMs,
          checked_at: s.checkedAt,
          uptime_90d: s.uptime90,
        })),
      },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } },
    );
  } catch (e) {
    return NextResponse.json({ status: 'unknown', error: (e as Error).message }, { status: 500 });
  }
}
