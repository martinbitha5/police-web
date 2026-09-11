'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createClient } from '@/supabase/client';
import { LegalShell } from '@/components/LegalShell';
import { loadStatus, OVERALL_TEXT, type OverallState, type ServiceSummary, type StatusSnapshot } from '@/lib/status';

/**
 * Page publique « État des systèmes » : état courant de chaque service, barres
 * de disponibilité sur 90 jours, maintenances planifiées et incidents passés.
 * Les mesures viennent de la base (tâche pg_cron), les incidents et les
 * maintenances sont saisis par un administrateur.
 */

type Tab = 'status' | 'maintenance' | 'incidents';

interface Incident { id: number; title: string; body: string | null; service_key: string | null; severity: string; started_at: string; resolved_at: string | null }
interface Maintenance { id: number; title: string; body: string | null; service_key: string | null; starts_at: string; ends_at: string }

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function monthLabel(d: Date): string {
  return `${MONTHS[d.getMonth()].charAt(0).toUpperCase()}${MONTHS[d.getMonth()].slice(1)} ${d.getFullYear()}`;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}

export default function StatusPage() {
  const [snap, setSnap] = useState<StatusSnapshot | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('status');

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    async function load() {
      try {
        const since = new Date(); since.setMonth(since.getMonth() - 3);
        const [s, inc, mnt] = await Promise.all([
          loadStatus(supabase),
          supabase.from('service_incident').select('*').gte('started_at', since.toISOString()).order('started_at', { ascending: false }),
          supabase.from('service_maintenance').select('*').gte('ends_at', new Date().toISOString()).order('starts_at'),
        ]);
        if (cancelled) return;
        setSnap(s);
        setIncidents((inc.data ?? []) as Incident[]);
        setMaintenance((mnt.data ?? []) as Maintenance[]);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void load();
    const t = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  const overall: OverallState = snap?.overall ?? 'unknown';

  return (
    <LegalShell title="État des systèmes">
      <p style={s.lead}>
        Disponibilité des services de Police Bagage, vérifiée automatiquement toutes les cinq minutes.
        Cette page est publique et se met à jour d’elle-même.
      </p>

      <nav style={s.tabs} aria-label="Sections">
        {([['status', 'État'], ['maintenance', 'Maintenance'], ['incidents', 'Incidents passés']] as [Tab, string][]).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)} style={{ ...s.tab, ...(tab === k ? s.tabActive : {}) }} aria-current={tab === k ? 'page' : undefined}>
            {t}
          </button>
        ))}
        <a href="/api/status" style={{ ...s.tab, marginLeft: 'auto' }} target="_blank" rel="noopener noreferrer">Format JSON</a>
      </nav>

      {error ? <p style={s.error}>Les mesures n’ont pas pu être chargées : {error}</p> : null}

      {tab === 'status' ? (
        <>
          <div style={s.banner} data-state={overall}>
            <span style={{ ...s.dot, background: dotColor(overall) }} aria-hidden />
            <span style={s.bannerText}>{OVERALL_TEXT[overall]}</span>
            {snap?.checkedAt ? <span style={s.bannerMeta}>Dernière vérification : {fmtTime(snap.checkedAt)}</span> : null}
          </div>

          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardTitle}>État actuel par service</span>
              <span style={s.cardMeta}>90 derniers jours</span>
            </div>
            {!snap ? (
              <div style={s.empty}>Chargement…</div>
            ) : snap.services.length === 0 ? (
              <div style={s.empty}>Aucun service surveillé pour le moment.</div>
            ) : (
              snap.services.map((svc) => <ServiceRow key={svc.key} svc={svc} />)
            )}
          </div>
        </>
      ) : null}

      {tab === 'maintenance' ? (
        <MonthList
          months={upcomingMonths(3)}
          items={maintenance.map((m) => ({ id: m.id, at: m.starts_at, title: m.title, body: m.body, meta: `Du ${fmtDateTime(m.starts_at)} au ${fmtDateTime(m.ends_at)}`, tag: 'Planifiée' }))}
          emptyText="Aucune maintenance prévue"
        />
      ) : null}

      {tab === 'incidents' ? (
        <MonthList
          months={pastMonths(3)}
          items={incidents.map((i) => ({ id: i.id, at: i.started_at, title: i.title, body: i.body, meta: i.resolved_at ? `Résolu le ${fmtDateTime(i.resolved_at)}` : `Depuis le ${fmtDateTime(i.started_at)}`, tag: i.resolved_at ? 'Résolu' : 'En cours' }))}
          emptyText="Aucun incident signalé"
        />
      ) : null}

      <p style={s.foot}>
        Pour être informé d’un incident, écrivez à <a href="mailto:contact@ats-handling-rdc.com" className="ft-link">contact@ats-handling-rdc.com</a>.
        Les données brutes sont disponibles au <a href="/api/status" className="ft-link">format JSON</a>.
      </p>
    </LegalShell>
  );
}

function dotColor(state: OverallState | 'ok' | 'partial' | 'down' | 'none'): string {
  switch (state) {
    case 'operational': case 'ok': return 'var(--positive)';
    case 'degraded': case 'partial': return 'var(--warning-content)';
    case 'down': return 'var(--negative)';
    default: return 'var(--content-tertiary)';
  }
}

function ServiceRow({ svc }: { svc: ServiceSummary }) {
  const state = svc.ok === null ? 'none' : svc.ok ? 'ok' : 'down';
  return (
    <div style={s.row}>
      <div style={s.rowHead}>
        <span style={s.rowName}>
          <span style={{ ...s.dotSmall, background: dotColor(state) }} aria-hidden />
          {svc.name}
        </span>
        <span style={s.rowUptime}>
          {svc.uptime90 === null ? 'Pas encore de mesure' : `${svc.uptime90.toLocaleString('fr-FR')} % de disponibilité`}
        </span>
      </div>
      <div style={s.bars} role="img" aria-label={`Disponibilité de ${svc.name} sur 90 jours`}>
        {svc.days.map((d) => (
          <span
            key={d.day}
            title={d.ratio === null ? `${d.day} : pas de mesure` : `${d.day} : ${Math.round(d.ratio * 1000) / 10} %`}
            style={{ ...s.bar, background: d.state === 'none' ? 'var(--bg-neutral-hover)' : dotColor(d.state) }}
          />
        ))}
      </div>
      <div style={s.barLegend}>
        <span>Il y a 90 jours</span>
        <span>{svc.latencyMs !== null && svc.ok ? `${svc.latencyMs} ms` : ''}</span>
        <span>Aujourd’hui</span>
      </div>
    </div>
  );
}

function upcomingMonths(n: number): Date[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth() + (n - 1 - i), 1));
}
function pastMonths(n: number): Date[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1));
}

function MonthList({ months, items, emptyText }: {
  months: Date[];
  items: { id: number; at: string; title: string; body: string | null; meta: string; tag: string }[];
  emptyText: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {months.map((m) => {
        const inMonth = items.filter((it) => { const d = new Date(it.at); return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth(); });
        return (
          <div key={m.toISOString()} style={s.card}>
            <div style={s.cardHead}><span style={s.cardTitle}>{monthLabel(m)}</span></div>
            {inMonth.length === 0 ? (
              <div style={s.empty}>{emptyText}</div>
            ) : (
              inMonth.map((it) => (
                <div key={it.id} style={s.item}>
                  <div style={s.itemHead}>
                    <span style={s.itemTitle}>{it.title}</span>
                    <span style={s.itemTag}>{it.tag}</span>
                  </div>
                  <div style={s.itemMeta}>{it.meta}</div>
                  {it.body ? <p style={s.itemBody}>{it.body}</p> : null}
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  lead: { margin: '14px 0 22px', fontSize: 16, lineHeight: 1.6, color: 'var(--content-secondary)' },
  tabs: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 18 },
  tab: {
    background: 'transparent', border: '1px solid var(--border-neutral)', color: 'var(--content-primary)',
    borderRadius: 9999, padding: '7px 14px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', textDecoration: 'none',
  },
  tabActive: { background: 'var(--interactive-accent)', borderColor: 'var(--interactive-accent)', color: 'var(--interactive-control)' },
  error: { color: 'var(--negative)', background: 'var(--negative-bg)', borderRadius: 8, padding: '10px 14px', fontSize: 14, margin: '0 0 16px' },

  banner: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '18px 20px', border: '1px solid var(--divider)', borderRadius: 12, marginBottom: 16, background: 'var(--bg-elevated)' },
  dot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  bannerText: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--content-primary)' },
  bannerMeta: { marginLeft: 'auto', fontSize: 13, color: 'var(--content-tertiary)' },

  card: { border: '1px solid var(--divider)', borderRadius: 12, background: 'var(--bg-elevated)', padding: '4px 20px 8px' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--divider)' },
  cardTitle: { fontSize: 14, fontWeight: 600, color: 'var(--content-primary)' },
  cardMeta: { fontSize: 12.5, color: 'var(--content-tertiary)' },
  empty: { padding: '28px 0', textAlign: 'center', color: 'var(--content-secondary)', fontSize: 14 },

  row: { padding: '16px 0', borderBottom: '1px solid var(--divider)' },
  rowHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 },
  rowName: { display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 600, color: 'var(--content-primary)' },
  dotSmall: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  rowUptime: { fontSize: 13, color: 'var(--content-secondary)', fontVariantNumeric: 'tabular-nums' },
  bars: { display: 'flex', gap: 2, height: 28 },
  bar: { flex: 1, borderRadius: 2, minWidth: 0 },
  barLegend: { display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--content-tertiary)', fontVariantNumeric: 'tabular-nums' },

  item: { padding: '14px 0', borderBottom: '1px solid var(--divider)' },
  itemHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  itemTitle: { fontSize: 15, fontWeight: 600, color: 'var(--content-primary)' },
  itemTag: { fontSize: 12, fontWeight: 600, color: 'var(--content-secondary)', border: '1px solid var(--divider)', borderRadius: 9999, padding: '2px 10px' },
  itemMeta: { fontSize: 13, color: 'var(--content-tertiary)', marginTop: 4 },
  itemBody: { margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--content-secondary)' },

  foot: { margin: '22px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--content-secondary)' },
};
