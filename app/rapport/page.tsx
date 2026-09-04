'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AppShell, useSession } from '@/components/AppShell';
import { flightScope } from '@/lib/scope';
import { loadFlightStats, sumFlightStats } from '@/lib/flight-stats';
import { PERIOD_LABEL, PERIOD_ORDER, rangeLabel, resolveRange, type Period } from '@/lib/period';
import { hasFlightDeparted, todayAtAirport } from '@police/shared';
import { useIsMobile } from '@/hooks/useIsMobile';
import { btnPrimary, input, label as fieldLabel, sectionHeading } from '@/ui/theme';
import { IconDownload } from '@/components/icons';
import { Gauge } from '@/components/Gauge';

interface Stats {
  flights: number;
  departed: number;
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
  // PÃ©rimÃ¨tre du profil : un superviseur ne totalise que les vols de son
  // aÃ©roport et de sa compagnie. Sans cela, le rapport agrÃ©geait tous les vols.
  const scope = flightScope(profile);
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<Period>('jour');
  // JournÃ©e d'exploitation de l'aÃ©roport du profil : elle bascule Ã  minuit sur
  // place, pas Ã  minuit UTC.
  const today = todayAtAirport(scope.airport);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const { from, to } = resolveRange(period, customFrom, customTo, today);

  const load = useCallback(async (rg: { from: string; to: string }) => {
    setLoading(true);
    setStats(null);

    // Les compteurs viennent de `flight_stats`, agrÃ©gÃ©s par Postgres, une ligne
    // par vol. La page rapatriait auparavant les passagers et les bagages pour
    // les compter ici : au-delÃ  de 1000 lignes PostgREST tronque en silence, et
    // le bilan d'un mois s'arrÃªtait Ã  1000 passagers. C'est aussi la source que
    // lit l'Ã©cran Vols, donc les deux pages ne peuvent plus se contredire.
    //
    // `alerts_open` ne compte que les alertes non rÃ©solues : une alerte levÃ©e
    // (bagage scannÃ© avant le check-in du passager) n'est pas une fraude et ne
    // doit pas gonfler le chiffre. Le classeur Excel garde la trace complÃ¨te.
    try {
      const rows = await loadFlightStats(rg, scope);
      const t = sumFlightStats(rows);
      setStats({
        flights: t.flights,
        departed: rows.filter((r) => hasFlightDeparted(r.status)).length,
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
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

  return (
    <div data-rv-auto style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      <div style={isMobile ? { ...s.head, ...s.headMobile } : s.head}>
        <div>
          <h1 style={s.title}>Rapports</h1>
          <div style={s.sub}>{rangeLabel(period, from, to)}</div>
        </div>
        <a style={{ ...btnPrimary, ...(loading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }} href={downloadHref} download>
          <IconDownload size={16} /> TÃ©lÃ©charger le rapport
        </a>
      </div>

      {/* SÃ©lecteur de pÃ©riode */}
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

      {/* Champs de date personnalisÃ©e */}
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

      <h2 style={sectionHeading}>Bilan de la pÃ©riode</h2>

      {/* MÃªmes jauges que le tableau de bord : le chiffre du centre rapportÃ© Ã 
          une rÃ©fÃ©rence dite en clair dessous. Tant que les compteurs ne sont
          pas arrivÃ©s, l'anneau reste vide plutÃ´t que d'afficher un faux zÃ©ro. */}
      <div style={isMobile ? { ...s.grid, gridTemplateColumns: '1fr' } : s.grid}>
        <Gauge
          label="Vols traitÃ©s"
          value={stats?.flights ?? 0}
          total={stats?.flights ?? 0}
          ratio={stats && stats.flights > 0 ? stats.departed / stats.flights : 0}
          caption={stats ? (stats.flights > 0 ? `${plural(stats.departed, 'dÃ©collÃ©')} sur ${stats.flights}` : 'aucun vol') : undefined}
          loading={loading || !stats}
        />
        <Gauge
          label="Passagers embarquÃ©s"
          value={stats?.boarded ?? 0}
          total={stats?.passengers ?? 0}
          caption={stats ? `sur ${plural(stats.passengers, 'enregistrÃ©')}` : undefined}
          loading={loading || !stats}
        />
        <Gauge
          label="Bagages confirmÃ©s"
          value={stats?.confirmed ?? 0}
          total={stats?.declared ?? 0}
          caption={stats ? `sur ${plural(stats.declared, 'dÃ©clarÃ©')}` : undefined}
          loading={loading || !stats}
        />
        <Gauge
          label="Ã‰cart bagages"
          value={ecart}
          total={stats?.declared ?? 0}
          caption={stats ? (ecart !== 0 ? `sur ${plural(stats.declared, 'dÃ©clarÃ©')}` : 'aucun Ã©cart') : undefined}
          danger={ecart !== 0}
          loading={loading || !stats}
        />
        <Gauge
          label="Bagages Ã©cartÃ©s"
          value={stats?.alerts ?? 0}
          total={(stats?.declared ?? 0) + (stats?.alerts ?? 0)}
          caption={stats ? (stats.alerts > 0 ? `sur ${plural(stats.flights, 'vol')}` : 'aucun Ã©cart') : undefined}
          danger={(stats?.alerts ?? 0) > 0}
          loading={loading || !stats}
        />
      </div>

    </div>
  );
}

const s: Record<string, CSSProperties> = {
  content: { padding: 28, maxWidth: 1160, margin: '0 auto', width: '100%' },
  contentMobile: { padding: '16px 14px' },

  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  headMobile: { flexDirection: 'column', gap: 12 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    color: 'var(--content-primary)',
  },
  sub: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 4 },

  // Puces de filtre : pilule bordÃ©e, blanche au repos ; l'active est noire.
  tabs: { display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' },
  tab: {
    flex: '1 1 auto',
    minWidth: 80,
    background: 'var(--bg-elevated)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--border-neutral)',
    color: 'var(--content-primary)',
    borderRadius: 9999,
    padding: '9px 16px',
    fontWeight: 500,
    fontSize: 14,
  },
  tabActive: {
    background: 'var(--interactive-accent)',
    borderColor: 'var(--interactive-accent)',
    color: 'var(--interactive-control)',
  },

  customRow: { display: 'flex', gap: 12, marginBottom: 22, alignItems: 'flex-end', flexWrap: 'wrap' },
  customField: { display: 'flex', flexDirection: 'column', gap: 6 },
  customLabel: { ...fieldLabel },
  dateInput: {
    ...input,
    // 16 px : en dessous, iOS Safari zoome automatiquement Ã  la mise au point
    // et l'Ã©cran reste dÃ©calÃ© aprÃ¨s la saisie.
    fontSize: 16,
    maxWidth: '100%',
  },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 22 },
};
