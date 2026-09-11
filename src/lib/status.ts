import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lecture de l'état des services (page /status, pied de page, /api/status).
 *
 * Les mesures sont produites côté base par `run_service_checks()` (pg_cron,
 * toutes les cinq minutes) et exposées par deux vues publiques :
 *  - service_current : dernière mesure par service ;
 *  - service_uptime_daily : nombre de mesures et de mesures réussies par jour
 *    sur 90 jours.
 * Ici on ne fait que les assembler : barres journalières, taux de
 * disponibilité et état d'ensemble.
 */

export type OverallState = 'operational' | 'degraded' | 'down' | 'unknown';
export type DayState = 'none' | 'ok' | 'partial' | 'down';

export interface ServiceDay {
  day: string;          // AAAA-MM-JJ (UTC)
  state: DayState;
  ratio: number | null; // part des mesures réussies, null sans mesure
}

export interface ServiceSummary {
  key: string;
  name: string;
  url: string;
  ok: boolean | null;   // null : aucune mesure encore
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string | null;
  uptime90: number | null; // 0..100, null sans mesure
  days: ServiceDay[];   // 90 entrées, de la plus ancienne à aujourd'hui
}

export interface StatusSnapshot {
  overall: OverallState;
  checkedAt: string | null; // mesure la plus récente, tous services confondus
  services: ServiceSummary[];
}

interface CurrentRow {
  key: string; name: string; url: string; sort: number;
  ok: boolean | null; status_code: number | null; latency_ms: number | null; checked_at: string | null;
}
interface DailyRow { service_key: string; day: string; checks: number; ok_checks: number }

export const DAYS = 90;

/** Les 90 derniers jours en UTC, du plus ancien à aujourd'hui. */
export function lastDays(n = DAYS): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayState(ratio: number | null): DayState {
  if (ratio === null) return 'none';
  if (ratio >= 0.995) return 'ok';
  if (ratio >= 0.95) return 'partial';
  return 'down';
}

export function overallOf(services: ServiceSummary[]): OverallState {
  const measured = services.filter((s) => s.ok !== null);
  if (measured.length === 0) return 'unknown';
  const down = measured.filter((s) => s.ok === false).length;
  if (down === 0) return 'operational';
  return down === measured.length ? 'down' : 'degraded';
}

export const OVERALL_TEXT: Record<OverallState, string> = {
  operational: 'Tous les systèmes sont opérationnels',
  degraded: 'Un ou plusieurs services sont perturbés',
  down: 'Les services sont indisponibles',
  unknown: 'Les vérifications n’ont pas encore commencé',
};

export async function loadStatus(supabase: SupabaseClient): Promise<StatusSnapshot> {
  const [cur, daily] = await Promise.all([
    supabase.from('service_current').select('*').order('sort'),
    supabase.from('service_uptime_daily').select('*'),
  ]);
  if (cur.error) throw cur.error;
  if (daily.error) throw daily.error;

  const days = lastDays();
  const byService = new Map<string, Map<string, DailyRow>>();
  for (const r of (daily.data ?? []) as DailyRow[]) {
    if (!byService.has(r.service_key)) byService.set(r.service_key, new Map());
    byService.get(r.service_key)!.set(r.day, r);
  }

  const services: ServiceSummary[] = ((cur.data ?? []) as CurrentRow[]).map((c) => {
    const rows = byService.get(c.key) ?? new Map<string, DailyRow>();
    let checks = 0, okChecks = 0;
    const series: ServiceDay[] = days.map((day) => {
      const r = rows.get(day);
      if (!r || r.checks === 0) return { day, state: 'none', ratio: null };
      checks += r.checks; okChecks += r.ok_checks;
      const ratio = r.ok_checks / r.checks;
      return { day, state: dayState(ratio), ratio };
    });
    return {
      key: c.key, name: c.name, url: c.url,
      ok: c.ok, statusCode: c.status_code, latencyMs: c.latency_ms, checkedAt: c.checked_at,
      uptime90: checks > 0 ? Math.round((okChecks / checks) * 1000) / 10 : null,
      days: series,
    };
  });

  const checkedAt = services.reduce<string | null>((acc, s) => (s.checkedAt && (!acc || s.checkedAt > acc) ? s.checkedAt : acc), null);
  return { overall: overallOf(services), checkedAt, services };
}
