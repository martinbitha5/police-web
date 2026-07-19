'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createClient } from '@/supabase/client';
import { AppShell, useSession } from '@/components/AppShell';
import { flightScope, scopeFlightQuery } from '@/lib/scope';
import { useIsMobile } from '@/hooks/useIsMobile';
import { card, btnPrimary, sectionHeading } from '@/ui/theme';
import {
  IconPlane,
  IconUser,
  IconPlaneDepart,
  IconBag,
  IconAlert,
  IconDownload,
  IconReport,
} from '@/components/icons';

type Period = 'jour' | 'semaine' | 'mois' | 'annee' | 'perso';

const PERIOD_LABEL: Record<Period, string> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
  annee: 'Année',
  perso: 'Personnalisé',
};

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Calcule la plage [from, to] (incluse) pour les périodes prédéfinies, jusqu'à aujourd'hui. */
function rangeFor(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = iso(now);
  if (period === 'semaine') {
    const d = new Date(now);
    const dow = (d.getDay() + 6) % 7; // lundi = 0
    d.setDate(d.getDate() - dow);
    return { from: iso(d), to };
  }
  if (period === 'mois') {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
  if (period === 'annee') {
    return { from: iso(new Date(now.getFullYear(), 0, 1)), to };
  }
  return { from: to, to }; // jour (ou défaut)
}

function frDate(s: string): string {
  return new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Stats {
  flights: number;
  passengers: number;
  boarded: number;
  declared: number;
  confirmed: number;
  alerts: number;
}

export default function RapportPage() {
  return (
    <AppShell>
      <ReportView />
    </AppShell>
  );
}

function ReportView() {
  const profile = useSession();
  // Périmètre du profil : un superviseur ne totalise que les vols de son
  // aéroport et de sa compagnie. Sans cela, le rapport agrégeait tous les vols.
  const scope = flightScope(profile);
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<Period>('jour');
  const today = iso(new Date());
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Plage active : champs personnalisés si « Personnalisé », sinon plage calculée.
  const range =
    period === 'perso'
      ? { from: customFrom <= customTo ? customFrom : customTo, to: customFrom <= customTo ? customTo : customFrom }
      : rangeFor(period);
  const { from, to } = range;

  const load = useCallback(async (rg: { from: string; to: string }) => {
    setLoading(true);
    setStats(null);
    const { from, to } = rg;
    const supabase = createClient();

    const { data: fl } = await scopeFlightQuery(
      supabase.from('flights').select('id').gte('date', from).lte('date', to),
      scope,
    );
    const ids = ((fl as { id: string }[] | null) ?? []).map((f) => f.id);

    if (ids.length === 0) {
      setStats({ flights: 0, passengers: 0, boarded: 0, declared: 0, confirmed: 0, alerts: 0 });
      setLoading(false);
      return;
    }

    const [pax, bags, fraud] = await Promise.all([
      supabase.from('passengers').select('declared_baggage_count, boarded').in('flight_id', ids),
      supabase.from('baggage').select('is_confirmed').in('flight_id', ids),
      supabase.from('fraud_alerts').select('id', { count: 'exact', head: true }).in('flight_id', ids),
    ]);

    const passengers = (pax.data as { declared_baggage_count: number; boarded: boolean }[] | null) ?? [];
    const baggage = (bags.data as { is_confirmed: boolean }[] | null) ?? [];

    setStats({
      flights: ids.length,
      passengers: passengers.length,
      boarded: passengers.reduce((s, p) => s + (p.boarded ? 1 : 0), 0),
      declared: passengers.reduce((s, p) => s + p.declared_baggage_count, 0),
      confirmed: baggage.reduce((s, b) => s + (b.is_confirmed ? 1 : 0), 0),
      alerts: fraud.count ?? 0,
    });
    setLoading(false);
  }, [scope.airport, scope.airline]);

  useEffect(() => {
    void load({ from, to });
  }, [load, from, to]);

  const downloadHref = `/api/report/period?from=${from}&to=${to}&label=${encodeURIComponent(PERIOD_LABEL[period])}`;
  const ecart = stats ? stats.declared - stats.confirmed : 0;
  const boardRate = stats && stats.passengers > 0 ? Math.round((stats.boarded / stats.passengers) * 100) : 0;

  return (
    <div style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      <div style={isMobile ? { ...s.head, ...s.headMobile } : s.head}>
        <div>
          <h1 style={s.title}>Rapports</h1>
          <div style={s.sub}>
            {period === 'jour' ? frDate(to) : `Du ${frDate(from)} au ${frDate(to)}`}
          </div>
        </div>
        <a style={{ ...btnPrimary, ...(loading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }} href={downloadHref} download>
          <IconDownload size={16} /> Télécharger Excel
        </a>
      </div>

      {/* Sélecteur de période */}
      <div style={s.tabs}>
        {(['jour', 'semaine', 'mois', 'annee', 'perso'] as Period[]).map((p) => (
          <button
            key={p}
            style={{ ...s.tab, ...(period === p ? s.tabActive : {}) }}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {/* Champs de date personnalisée */}
      {period === 'perso' ? (
        <div style={isMobile ? { ...s.customRow, flexDirection: 'column', alignItems: 'stretch' } : s.customRow}>
          <label style={s.customField}>
            <span style={s.customLabel}>Du</span>
            <input type="date" max={today} style={s.dateInput} value={customFrom} onChange={(e) => setCustomFrom(e.target.value || today)} />
          </label>
          <label style={s.customField}>
            <span style={s.customLabel}>Au</span>
            <input type="date" max={today} style={s.dateInput} value={customTo} onChange={(e) => setCustomTo(e.target.value || today)} />
          </label>
        </div>
      ) : null}

      <h2 style={sectionHeading}>Bilan de la période</h2>

      <div style={isMobile ? { ...s.grid, gridTemplateColumns: 'repeat(2, 1fr)' } : s.grid}>
        <Stat label="Vols traités" value={stats?.flights} icon={<IconPlane size={20} />} loading={loading} />
        <Stat label="Passagers" value={stats?.passengers} icon={<IconUser size={20} />} loading={loading} />
        <Stat label="Embarqués" value={stats ? `${stats.boarded} (${boardRate}%)` : undefined} icon={<IconPlaneDepart size={20} />} loading={loading} />
        <Stat label="Bagages confirmés" value={stats ? `${stats.confirmed} / ${stats.declared}` : undefined} icon={<IconBag size={20} />} loading={loading} />
        <Stat label="Écart bagages" value={stats ? ecart : undefined} icon={<IconBag size={20} />} danger={ecart !== 0} loading={loading} />
        <Stat label="Alertes fraude" value={stats?.alerts} icon={<IconAlert size={20} />} danger={(stats?.alerts ?? 0) > 0} loading={loading} />
      </div>

      <div style={s.note}>
        <IconReport size={18} />
        <span>
          Le fichier Excel contient 5 feuilles : <strong>Résumé</strong> (statistiques comptables), <strong>Vols</strong>,{' '}
          <strong>Passagers</strong> (détail complet), <strong>Bagages</strong> (détail complet) et <strong>Alertes fraude</strong>.
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  danger,
  loading,
}: {
  label: string;
  value: number | string | undefined;
  icon: React.ReactNode;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <div style={s.stat}>
      <div style={s.statIcon}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={s.statLabel}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: danger ? 'var(--negative)' : 'var(--content-primary)', lineHeight: 1.1 }}>
          {loading ? '…' : (value ?? 'N/A')}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  content: { padding: 28, maxWidth: 1160, margin: '0 auto', width: '100%' },
  contentMobile: { padding: '16px 14px' },

  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  headMobile: { flexDirection: 'column', gap: 12 },
  title: { margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--content-primary)' },
  sub: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 4 },

  tabs: { display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' },
  tab: {
    flex: '1 1 auto',
    minWidth: 80,
    background: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--border-neutral)',
    color: 'var(--content-secondary)',
    borderRadius: 9999,
    padding: '10px 16px',
    fontWeight: 600,
    fontSize: 14,
  },
  tabActive: { background: 'var(--interactive-primary)', borderColor: 'var(--interactive-primary)', color: '#fff' },

  customRow: { display: 'flex', gap: 12, marginBottom: 22, alignItems: 'flex-end', flexWrap: 'wrap' },
  customField: { display: 'flex', flexDirection: 'column', gap: 6 },
  customLabel: { fontSize: 13, color: 'var(--content-secondary)', fontWeight: 600 },
  dateInput: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-neutral)',
    color: 'var(--content-primary)',
    borderRadius: 10,
    padding: '10px 13px',
    fontSize: 14,
  },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 },
  stat: { ...card, display: 'flex', alignItems: 'center', gap: 14, padding: 18 },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    background: 'var(--bg-neutral)',
    boxShadow: 'inset 0 0 0 1px var(--border-neutral)',
    color: 'var(--brand-forest)',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  statLabel: { color: 'var(--content-secondary)', fontSize: 13, marginBottom: 4 },

  note: {
    background: 'var(--bg-neutral)',
    border: 'none',
    borderRadius: 16,
    padding: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: 'var(--content-secondary)',
    fontSize: 14,
    lineHeight: 1.5,
  },
};
