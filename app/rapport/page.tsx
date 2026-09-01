'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AppShell, useSession } from '@/components/AppShell';
import { flightScope } from '@/lib/scope';
import { loadFlightStats, sumFlightStats } from '@/lib/flight-stats';
import { PERIOD_LABEL, PERIOD_ORDER, rangeLabel, resolveRange, type Period } from '@/lib/period';
import { todayAtAirport } from '@police/shared';
import { useIsMobile } from '@/hooks/useIsMobile';
import { card, btnPrimary, sectionHeading } from '@/ui/theme';
import {
  IconPlane,
  IconUser,
  IconPlaneDepart,
  IconBag,
  IconAlert,
  IconDownload,
} from '@/components/icons';

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
  // Journée d'exploitation de l'aéroport du profil : elle bascule à minuit sur
  // place, pas à minuit UTC.
  const today = todayAtAirport(scope.airport);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const { from, to } = resolveRange(period, customFrom, customTo, today);

  const load = useCallback(async (rg: { from: string; to: string }) => {
    setLoading(true);
    setStats(null);

    // Les compteurs viennent de `flight_stats`, agrégés par Postgres, une ligne
    // par vol. La page rapatriait auparavant les passagers et les bagages pour
    // les compter ici : au-delà de 1000 lignes PostgREST tronque en silence, et
    // le bilan d'un mois s'arrêtait à 1000 passagers. C'est aussi la source que
    // lit l'écran Vols, donc les deux pages ne peuvent plus se contredire.
    //
    // `alerts_open` ne compte que les alertes non résolues : une alerte levée
    // (bagage scanné avant le check-in du passager) n'est pas une fraude et ne
    // doit pas gonfler le chiffre. Le classeur Excel garde la trace complète.
    try {
      const rows = await loadFlightStats(rg, scope);
      const t = sumFlightStats(rows);
      setStats({
        flights: t.flights,
        passengers: t.pax,
        boarded: t.boarded,
        declared: t.declared,
        confirmed: t.confirmed,
        alerts: t.alerts,
      });
    } catch {
      // Mieux vaut des tuiles vides qu'un bilan partiel pris pour un total.
      setStats(null);
    }
    setLoading(false);
  }, [scope.airport, scope.airline]);

  useEffect(() => {
    void load({ from, to });
  }, [load, from, to]);

  const downloadHref = `/api/report/period?from=${from}&to=${to}&label=${encodeURIComponent(PERIOD_LABEL[period])}`;
  const ecart = stats ? stats.declared - stats.confirmed : 0;
  const boardRate = stats && stats.passengers > 0 ? Math.round((stats.boarded / stats.passengers) * 100) : 0;

  return (
    <div data-rv-auto style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      <div style={isMobile ? { ...s.head, ...s.headMobile } : s.head}>
        <div>
          <h1 style={s.title}>Rapports</h1>
          <div style={s.sub}>{rangeLabel(period, from, to)}</div>
        </div>
        <a style={{ ...btnPrimary, ...(loading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }} href={downloadHref} download>
          <IconDownload size={16} /> Télécharger Excel
        </a>
      </div>

      {/* Sélecteur de période */}
      <div style={s.tabs}>
        {PERIOD_ORDER.map((p) => (
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

};
