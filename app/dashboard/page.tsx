'use client';

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { flightScope, scopeFlightQuery } from '@/lib/scope';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useUrlParam } from '@/hooks/useUrlParam';
import type { Flight, FraudAlert, Baggage, PassengerLeg } from '@police/shared';
import {
  FLIGHT_STATUS_LABEL,
  FLIGHT_STATUS_ORDER,
  formatRoute,
  hasFlightDeparted,
  SOUTE_LABEL,
  todayAtAirport,
} from '@police/shared';
import { createClient } from '@/supabase/client';
import { useFlightData, type PassengerRow } from '@/useFlightData';
import { loadFlightStats, sumFlightStats, type FlightStatsTotals } from '@/lib/flight-stats';
import { AppShell, useSession } from '@/components/AppShell';
import { Gauge } from '@/components/Gauge';
import { RushPanel } from '@/components/RushPanel';
import {
  card,
  btnPrimary,
  btnSecondary,
  btnText,
  sectionHeading,
  eyebrow,
  badge,
  input as inputStyle,
  label as labelStyle,
  modalOverlay,
  modalPanel,
} from '@/ui/theme';
import {
  IconPlane,
  IconPlaneDepart,
  IconPlaneArrive,
  IconAlert,
  IconPlus,
  IconBack,
  IconDownload,
  IconClose,
} from '@/components/icons';

const STATUS_LABEL = FLIGHT_STATUS_LABEL;
// Pastilles de statut, pilules sÃ©mantiques (fond + texte) : vert quand le vol
// avance, ambre quand il attend, rouge quand il est annulÃ©.
const STATUS_STYLE: Record<Flight['status'], { bg: string; color: string }> = {
  scheduled: { bg: 'var(--bg-neutral)', color: 'var(--content-secondary)' },
  delayed: { bg: 'var(--warning-bg)', color: 'var(--warning-content)' },
  boarding: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  closed: { bg: 'var(--bg-neutral)', color: 'var(--content-primary)' },
  departed: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  arrived: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  cancelled: { bg: 'var(--negative-bg)', color: 'var(--negative)' },
};

// La journÃ©e d'exploitation bascule Ã  minuit Ã  l'aÃ©roport du superviseur.
// toISOString() renvoyait la date UTC : Ã  Kinshasa (UTC+1), de 00h00 Ã  01h00,
// le tableau de bord affichait encore les vols de la veille.

function formatTime(ts: string | null): string {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatToday(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DashboardPage() {
  return (
    <AppShell>
      {/* useSearchParams impose une frontiÃ¨re Suspense au prÃ©rendu statique. */}
      <Suspense fallback={null}>
        <Dashboard />
      </Suspense>
    </AppShell>
  );
}

function Dashboard() {
  const profile    = useSession();
  const isMobile   = useIsMobile();
  const scope = flightScope(profile);
  const airportCode = scope.airport;
  const [flights, setFlights] = useState<Flight[]>([]);
  const [alertsByFlight, setAlertsByFlight] = useState<Record<string, number>>({});
  // Passagers et bagages du jour, agrÃ©gÃ©s par la vue flight_stats : les jauges
  // de la vue d'ensemble rapportent l'embarquÃ© Ã  l'enregistrÃ© et le confirmÃ©
  // au dÃ©clarÃ©, sans rapatrier une seule ligne de passager.
  const [totals, setTotals] = useState<FlightStatsTotals | null>(null);
  // Le vol ouvert vit dans l'URL (?vol=<id>) : F5 rouvre le mÃªme vol au lieu
  // de renvoyer Ã  la vue d'ensemble, et Retour referme le dÃ©tail.
  const [selectedId, setSelectedId] = useUrlParam('vol');
  const [showForm, setShowForm] = useState(false);

  async function loadFlights() {
    const supabase = createClient();
    const today = todayAtAirport(airportCode);
    // PÃ©rimÃ¨tre du profil : son aÃ©roport ET sa compagnie. Sans le filtre
    // transporteur, un profil KQ voyait les vols ET du mÃªme aÃ©roport.
    const { data: fl } = await scopeFlightQuery(
      supabase.from('flights').select('*').eq('date', today),
      scope,
    ).order('departure_time', { ascending: true });
    const list = (fl as Flight[] | null) ?? [];
    setFlights(list);

    // Compteurs du jour. Un Ã©chec ne vide pas la vue : les jauges de
    // passagers et de bagages attendent simplement le prochain chargement.
    try {
      setTotals(sumFlightStats(await loadFlightStats({ from: today, to: today }, scope)));
    } catch {
      // Les jauges de vols restent affichÃ©es, elles ne dÃ©pendent pas de la vue.
    }

    const ids = list.map((f) => f.id);
    if (ids.length > 0) {
      // Seul le compteur par vol est affichÃ© ici : on ne rapatrie que flight_id,
      // pas les lignes complÃ¨tes. Sur un vol Ã  forte fraude (des centaines
      // d'alertes), charger tout le dÃ©tail, noms passagers et Ã©tiquettes
      // compris, pour n'afficher qu'un nombre serait inutile et coÃ»teux.
      const { data: al } = await supabase
        .from('fraud_alerts')
        .select('flight_id')
        .eq('resolved', false)
        .in('flight_id', ids);
      const rows = (al as { flight_id: string }[] | null) ?? [];
      const map: Record<string, number> = {};
      for (const a of rows) map[a.flight_id] = (map[a.flight_id] ?? 0) + 1;
      setAlertsByFlight(map);
    } else {
      setAlertsByFlight({});
    }
  }

  // Recharge quand le profil est connu (profile.id passe de undefined â†’ UUID)
  // ou quand l'airport_code change (changement de site).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (profile !== null) void loadFlights(); }, [profile?.id, airportCode]);

  const departures = useMemo(() => flights.filter((f) => f.origin === airportCode), [flights, airportCode]);
  const arrivals   = useMemo(() => flights.filter((f) => f.destination === airportCode), [flights, airportCode]);
  const selected = flights.find((f) => f.id === selectedId) ?? null;
  const canManage = profile?.role === 'admin' || profile?.role === 'supervisor';
  const totalAlerts = Object.values(alertsByFlight).reduce((a, b) => a + b, 0);

  return (
    <div data-rv-auto style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      {selected ? (
        <FlightDetail hub={airportCode} flight={selected} onBack={() => setSelectedId(null)} canManage={canManage} onUpdated={loadFlights} isMobile={isMobile} />
      ) : (
        <Overview
          hub={airportCode}
          flights={flights}
          departures={departures}
          arrivals={arrivals}
          totals={totals}
          totalAlerts={totalAlerts}
          alerts={alertsByFlight}
          canManage={canManage}
          isMobile={isMobile}
          onSelect={setSelectedId}
          onAdd={() => setShowForm(true)}
        />
      )}

      {showForm ? (
        <FlightFormModal
          hub={airportCode}
          onClose={() => setShowForm(false)}
          onCreated={async (id) => {
            setShowForm(false);
            await loadFlights();
            setSelectedId(id);
          }}
        />
      ) : null}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Vue d'ensemble
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Overview({
  hub,
  flights,
  departures,
  arrivals,
  totals,
  totalAlerts,
  alerts,
  canManage,
  isMobile,
  onSelect,
  onAdd,
}: {
  hub: string;
  flights: Flight[];
  departures: Flight[];
  arrivals: Flight[];
  totals: FlightStatsTotals | null;
  totalAlerts: number;
  alerts: Record<string, number>;
  canManage: boolean;
  isMobile: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const departed = flights.filter((f) => hasFlightDeparted(f.status)).length;
  const flightsWithAlerts = Object.values(alerts).filter((n) => n > 0).length;

  return (
    <div>
      <div style={isMobile ? { ...s.pageHeader, ...s.pageHeaderMobile } : s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Tableau de bord</h1>
          <div style={s.pageSub}>{formatToday()}</div>
        </div>
        {canManage ? (
          <button style={btnPrimary} onClick={onAdd}>
            <IconPlus size={16} /> Nouveau vol
          </button>
        ) : null}
      </div>

      {/* Chaque jauge rapporte le chiffre du centre Ã  une rÃ©fÃ©rence dite en
          clair dessous : un Â« 8 Â» seul ne dit rien, Â« 8 dont 3 fermÃ©s Â» dit oÃ¹
          en est la journÃ©e. */}
      <div style={isMobile ? { ...s.statGrid, gridTemplateColumns: '1fr' } : s.statGrid}>
        <Gauge
          label="Vols du jour"
          value={flights.length}
          total={flights.length}
          ratio={flights.length > 0 ? departed / flights.length : 0}
          caption={flights.length > 0 ? `${departed} dÃ©collÃ©${departed > 1 ? 's' : ''} sur ${flights.length}` : 'aucun vol'}
        />
        <Gauge
          label="Passagers embarquÃ©s"
          value={totals?.boarded ?? 0}
          total={totals?.pax ?? 0}
          caption={totals ? `sur ${totals.pax} enregistrÃ©s` : 'en attente des compteurs'}
        />
        <Gauge
          label="Bagages confirmÃ©s"
          value={totals?.confirmed ?? 0}
          total={totals?.declared ?? 0}
          caption={totals ? `sur ${totals.declared} dÃ©clarÃ©s` : 'en attente des compteurs'}
        />
        <Gauge
          label="Bagages Ã©cartÃ©s"
          value={totalAlerts}
          total={flights.length}
          caption={
            totalAlerts > 0
              ? `${flightsWithAlerts} vol${flightsWithAlerts > 1 ? 's' : ''} concernÃ©${flightsWithAlerts > 1 ? 's' : ''}`
              : 'aucun Ã©cart'
          }
          danger={totalAlerts > 0}
        />
      </div>

      {/* Pas de liste des bagages Ã©cartÃ©s ici : la vue d'ensemble n'affiche que
          le compteur (carte Â« Bagages Ã©cartÃ©s Â» ci-dessus). Le dÃ©tail par alerte
          reste consultable en ouvrant le vol concernÃ©. */}

      {flights.length === 0 ? (
        <div style={s.emptyCard}>
          <IconPlane size={34} />
          <div style={{ fontWeight: 600, marginTop: 10 }}>Aucun vol programmÃ© aujourd&apos;hui</div>
          <div style={{ color: 'var(--content-secondary)', marginTop: 4 }}>
            {canManage ? 'CrÃ©ez un premier vol pour commencer le suivi.' : 'Aucun vol Ã  afficher pour le moment.'}
          </div>
          {canManage ? (
            <button style={{ ...btnPrimary, marginTop: 16 }} onClick={onAdd}>
              <IconPlus size={16} /> Ajouter un vol du jour
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <FlightSection hub={hub} title="DÃ©parts" icon={<IconPlaneDepart size={16} />} flights={departures} alerts={alerts} onSelect={onSelect} />
          {/* La section ArrivÃ©es n'apparaÃ®t que s'il y a un vol Ã  rÃ©ceptionner :
              un titre suivi de Â« Aucun vol Â» n'apporte rien Ã  un poste qui ne
              fait que des dÃ©parts. */}
          {arrivals.length > 0 ? (
            <FlightSection hub={hub} title="ArrivÃ©es" icon={<IconPlaneArrive size={16} />} flights={arrivals} alerts={alerts} onSelect={onSelect} />
          ) : null}
        </>
      )}
    </div>
  );
}

function FlightSection({
  hub,
  title,
  icon,
  flights,
  alerts,
  onSelect,
}: {
  hub: string;
  title: string;
  icon: React.ReactNode;
  flights: Flight[];
  alerts: Record<string, number>;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <h2 style={{ ...sectionHeading, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {title} <span style={s.countPill}>{flights.length}</span>
      </h2>
      {flights.length === 0 ? (
        <div style={s.sectionEmpty}>Aucun vol</div>
      ) : (
        <div style={s.cardGrid}>
          {flights.map((f) => (
            <FlightCard key={f.id} hub={hub} flight={f} alertCount={alerts[f.id] ?? 0} onSelect={() => onSelect(f.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlightCard({ hub, flight, alertCount, onSelect }: { hub: string; flight: Flight; alertCount: number; onSelect: () => void }) {
  return (
    <button style={s.flightCard} onClick={onSelect}>
      <div style={s.flightCardTop}>
        <span style={s.flightCardNumber}>{flight.flight_number}</span>
        <StatusBadge status={flight.status} />
      </div>
      <div style={s.flightCardRoute}>{formatRoute(flight)}</div>
      <div style={s.flightCardFoot}>
        <span style={{ color: 'var(--content-secondary)', fontSize: 13 }}>
          {flight.origin === hub ? `DÃ©part ${formatTime(flight.departure_time)}` : `ArrivÃ©e ${formatTime(flight.arrival_time)}`}
        </span>
        {alertCount > 0 ? (
          <span style={s.alertPill}>
            <IconAlert size={12} /> {alertCount}
          </span>
        ) : null}
      </div>
    </button>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DÃ©tail d'un vol
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FlightDetail({
  hub,
  flight,
  onBack,
  canManage,
  onUpdated,
  isMobile,
}: {
  hub: string;
  flight: Flight;
  onBack: () => void;
  canManage: boolean;
  onUpdated: () => void;
  isMobile: boolean;
}) {
  const {
    passengers,
    alerts,
    baggageDeclared,
    baggageConfirmed,
    baggageInHold,
    baggageRush,
    baggageArrived,
    baggageExpected,
    boardedCount,
    offloadedCount,
    rushForward,
    toPull,
    reload,
  } = useFlightData(flight.id);

  // Une alerte rÃ©solue reste consultable mais ne pÃ¨se plus sur les compteurs.
  const activeAlerts = useMemo(() => alerts.filter((a) => !a.resolved), [alerts]);
  // Passagers actifs : les dÃ©barquÃ©s restent listÃ©s (barrÃ©s) mais ne comptent plus.
  const activePax = passengers.length - offloadedCount;
  // Physiquement prÃ©sents (scannÃ©s) : les annoncÃ©s pas encore arrivÃ©s sont Ã  part.
  const rushActive = useMemo(
    () => rushForward.filter((b) => b.rush_status === 'approved' || b.rush_status === 'pending'),
    [rushForward],
  );
  const rushPending = useMemo(() => rushForward.filter((b) => b.rush_status === 'pending'), [rushForward]);
  const rushExpected = useMemo(() => rushForward.filter((b) => b.rush_status === 'expected'), [rushForward]);

  // Passager dont on affiche la fiche. Le tableau ne montre qu'un compteur
  // Â« 1/2 Â» : savoir QUEL bagage manque demande d'ouvrir le dÃ©tail.
  const [detailPax, setDetailPax] = useState<PassengerRow | null>(null);

  async function changeStatus(status: Flight['status']) {
    await createClient().from('flights').update({ status }).eq('id', flight.id);
    onUpdated();
  }

  return (
    <div>
      <button type="button" style={s.backBtn} onClick={onBack}>
        <IconBack size={16} /> Tableau de bord
      </button>

      <div style={isMobile ? { ...s.detailHeader, ...s.detailHeaderMobile } : s.detailHeader}>
        <div>
          <div style={s.detailRoute}>
            <h1 style={s.pageTitle}>{flight.flight_number}</h1>
            <span style={s.routeChip}>{formatRoute(flight)}</span>
            <StatusBadge status={flight.status} />
          </div>
          <div style={s.pageSub}>
            {flight.origin === hub ? `DÃ©part ${formatTime(flight.departure_time)}` : `ArrivÃ©e ${formatTime(flight.arrival_time)}`} Â· {formatToday()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {canManage ? (
            <select style={s.statusSelect} value={flight.status} onChange={(e) => changeStatus(e.target.value as Flight['status'])}>
              {FLIGHT_STATUS_ORDER.map((st) => (
                <option key={st} value={st}>
                  {FLIGHT_STATUS_LABEL[st]}
                </option>
              ))}
            </select>
          ) : null}
          <a href={`/api/report?flightId=${flight.id}`} style={btnSecondary}>
            <IconDownload size={16} /> Rapport
          </a>
        </div>
      </div>

      <div style={isMobile ? { ...s.statGrid, gridTemplateColumns: '1fr' } : s.statGrid}>
        <Gauge
          label="Passagers embarquÃ©s"
          value={boardedCount}
          total={activePax}
          caption={`sur ${activePax} enregistrÃ©${activePax > 1 ? 's' : ''}`}
        />
        <Gauge
          label="Bagages confirmÃ©s"
          value={baggageConfirmed}
          total={baggageDeclared}
          caption={`sur ${baggageDeclared} dÃ©clarÃ©${baggageDeclared > 1 ? 's' : ''}`}
        />
        <Gauge
          label="ChargÃ©s en soute"
          value={baggageInHold}
          total={baggageConfirmed}
          caption={`sur ${baggageConfirmed} confirmÃ©${baggageConfirmed > 1 ? 's' : ''}`}
        />
        {/* RÃ©ception Ã  destination. En alerte seulement une fois le dÃ©chargement
            commencÃ© : avant Ã§a, 0 sur N est normal, pas un manquant. */}
        <Gauge
          label="ArrivÃ©s Ã  destination"
          value={baggageArrived}
          total={baggageExpected}
          caption={`sur ${baggageExpected} attendu${baggageExpected > 1 ? 's' : ''}`}
          danger={baggageArrived > 0 && baggageArrived < baggageExpected}
        />
        <Gauge
          label="Restants Ã  rÃ©acheminer"
          value={baggageRush}
          total={baggageDeclared}
          caption={baggageRush > 0 ? `sur ${baggageDeclared} dÃ©clarÃ©${baggageDeclared > 1 ? 's' : ''}` : 'aucun restant'}
          danger={baggageRush > 0}
        />
        <Gauge
          label="ExpÃ©dition rush"
          value={rushActive.length}
          total={rushActive.length + rushExpected.length}
          caption={
            rushPending.length > 0
              ? `${rushPending.length} Ã  valider`
              : rushExpected.length > 0
                ? `${rushExpected.length} attendu${rushExpected.length > 1 ? 's' : ''}`
                : rushActive.length > 0
                  ? 'tous prÃ©sents'
                  : 'aucun bagage sans passager'
          }
          danger={rushPending.length > 0}
        />
        {offloadedCount > 0 ? (
          <Gauge
            label="DÃ©barquÃ©s"
            value={offloadedCount}
            total={passengers.length}
            caption={`sur ${passengers.length} passager${passengers.length > 1 ? 's' : ''}`}
            danger
          />
        ) : null}
        {/* Les alertes levÃ©es (check-in scannÃ© aprÃ¨s le bagage) ne comptent plus
            comme des Ã©cartÃ©s : sinon une inversion d'ordre de scan gonfle le
            compteur de fraude et noie les vrais rejets. */}
        <Gauge
          label="Bagages Ã©cartÃ©s"
          value={activeAlerts.length}
          total={baggageDeclared + activeAlerts.length}
          caption={activeAlerts.length > 0 ? 'Ã  intercepter sur le tapis' : 'aucun Ã©cart'}
          danger={activeAlerts.length > 0}
        />
      </div>

      {toPull.length > 0 ? <PullBanner bags={toPull} /> : null}

      {alerts.length > 0 ? <FraudAlerts alerts={alerts} active={activeAlerts} /> : null}

      <RushPanel flightId={flight.id} bags={rushForward} canManage={canManage} onChanged={reload} mode="compact" />

      <h2 style={sectionHeading}>Passagers</h2>
      {isMobile ? (
        // Mobile : cartes empilÃ©es (un tableau Ã  7 colonnes serait illisible).
        passengers.length === 0 ? (
          <div style={s.tdEmpty}>Aucun passager scannÃ© pour le moment.</div>
        ) : (
          <div style={s.paxCardList}>
            {passengers.map((p) => (
              <PassengerCardMobile
                key={p.id}
                p={p}
                fallbackRoute={formatRoute(flight, 'â†’')}
                onOpen={() => setDetailPax(p)}
              />
            ))}
          </div>
        )
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Passager</th>
                <th style={s.th}>SiÃ¨ge</th>
                <th style={s.th}>Classe</th>
                <th style={s.th}>Route</th>
                <th style={s.th}>PNR</th>
                <th style={s.th}>Bagages</th>
                <th style={s.th}>EmbarquÃ©</th>
              </tr>
            </thead>
            <tbody>
              {passengers.length === 0 ? (
                <tr>
                  <td style={s.tdEmpty} colSpan={7}>
                    Aucun passager scannÃ© pour le moment.
                  </td>
                </tr>
              ) : (
                passengers.map((p) => (
                  <PassengerRowView
                    key={p.id}
                    p={p}
                    fallbackRoute={formatRoute(flight, 'â†’')}
                    onOpen={() => setDetailPax(p)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailPax ? (
        <PassengerDetailModal
          p={detailPax}
          fallbackRoute={formatRoute(flight, 'â†’')}
          canManage={canManage}
          onChanged={reload}
          onClose={() => setDetailPax(null)}
        />
      ) : null}
    </div>
  );
}

function PassengerCardMobile({
  p,
  fallbackRoute,
  onOpen,
}: {
  p: PassengerRow;
  fallbackRoute: string;
  onOpen: () => void;
}) {
  const complete = p.declared_baggage_count > 0 && p.confirmedCount >= p.declared_baggage_count;
  const bagColor = p.declared_baggage_count === 0 ? 'var(--content-secondary)' : complete ? 'var(--positive)' : 'var(--warning-content)';
  return (
    <div style={{ ...s.paxCard, cursor: 'pointer', ...(p.offloaded ? { opacity: 0.6 } : {}) }} onClick={onOpen}>
      <div style={s.paxCardHead}>
        <button
          type="button"
          style={{ ...s.paxNameBtn, ...s.paxCardName, ...(p.offloaded ? { textDecoration: 'line-through' } : {}) }}
          onClick={onOpen}
        >
          {p.full_name}
        </button>
        {p.offloaded ? (
          <span style={{ ...badge, background: 'var(--negative-bg)', color: 'var(--negative)' }}>
            <span style={{ ...s.statusDot, background: 'currentColor' }} /> DÃ©barquÃ©
          </span>
        ) : p.boarded ? (
          <span style={{ ...badge, background: 'var(--positive-bg)', color: 'var(--positive)' }}>
            <span style={{ ...s.statusDot, background: 'currentColor' }} /> EmbarquÃ©
          </span>
        ) : (
          <span style={{ ...badge, color: 'var(--content-secondary)' }}>En attente</span>
        )}
      </div>
      <div style={s.paxCardRoute}>{p.route ?? fallbackRoute}</div>
      <div style={s.paxCardMeta}>
        <PaxMeta label="SiÃ¨ge" value={p.seat ?? 'N/A'} />
        <PaxMeta label="Classe" value={p.class ?? 'N/A'} />
        <PaxMeta label="PNR" value={p.pnr} />
        <PaxMeta label="Bagages" value={`${p.confirmedCount}/${p.declared_baggage_count}`} color={bagColor} />
      </div>
    </div>
  );
}

function PaxMeta({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={s.paxMeta}>
      <span style={s.paxMetaLabel}>{label}</span>
      <span style={{ ...s.paxMetaValue, ...(color ? { color, fontWeight: 700 } : {}) }}>{value}</span>
    </div>
  );
}

function PassengerRowView({
  p,
  fallbackRoute,
  onOpen,
}: {
  p: PassengerRow;
  fallbackRoute: string;
  onOpen: () => void;
}) {
  const complete = p.declared_baggage_count > 0 && p.confirmedCount >= p.declared_baggage_count;
  const color = p.declared_baggage_count === 0 ? 'var(--content-secondary)' : complete ? 'var(--positive)' : 'var(--warning-content)';
  return (
    // Toute la ligne est cliquable pour le confort, mais le nom reste un vrai
    // bouton : c'est lui qui rend la fiche atteignable au clavier.
    <tr style={{ cursor: 'pointer', ...(p.offloaded ? { opacity: 0.6 } : {}) }} onClick={onOpen}>
      <td style={s.td}>
        <button
          type="button"
          style={{ ...s.paxNameBtn, ...(p.offloaded ? { textDecoration: 'line-through' } : {}) }}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          {p.full_name}
        </button>
      </td>
      <td style={s.td}>{p.seat ?? 'N/A'}</td>
      <td style={s.td}>{p.class ?? 'N/A'}</td>
      <td style={s.td}>{p.route ?? fallbackRoute}</td>
      <td style={s.td}>{p.pnr}</td>
      <td style={{ ...s.td, color, fontWeight: 600 }}>
        {p.confirmedCount}/{p.declared_baggage_count}
      </td>
      <td style={s.td}>
        {p.offloaded ? (
          <span style={{ ...badge, background: 'var(--negative-bg)', color: 'var(--negative)' }}>
            <span style={{ ...s.statusDot, background: 'currentColor' }} />
            DÃ©barquÃ©
          </span>
        ) : p.boarded ? (
          <span style={{ ...badge, background: 'var(--positive-bg)', color: 'var(--positive)' }}>
            <span style={{ ...s.statusDot, background: 'currentColor' }} />
            EmbarquÃ©
          </span>
        ) : (
          <span style={{ color: 'var(--content-secondary)' }}>En attente</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Bagages annulÃ©s encore en soute : le statut ne suffit pas, il faut que
 * quelqu'un aille physiquement les sortir. Le bandeau reste affichÃ© tant que
 * le retrait n'a pas Ã©tÃ© confirmÃ© par scan (Ã©cran Soute du PDA).
 */
function PullBanner({ bags }: { bags: Baggage[] }) {
  return (
    <div style={{ ...s.alert, marginBottom: 24, alignItems: 'flex-start' }}>
      <span style={s.alertTag}>
        <IconAlert size={15} /> Ã€ retirer
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>
          {bags.length} bagage{bags.length > 1 ? 's' : ''} annulÃ©{bags.length > 1 ? 's' : ''} encore en soute
        </strong>
        <div style={{ color: 'var(--content-secondary)', marginTop: 4 }}>
          {bags
            .map((b) => `${b.tag_number}${b.soute ? ` (${SOUTE_LABEL[b.soute].toLowerCase()})` : ''}`)
            .join(' Â· ')}
        </div>
        <div style={{ color: 'var(--content-secondary)', marginTop: 4 }}>
          Faire rescanner chaque bagage dans l&apos;Ã©cran Soute du PDA pour confirmer le retrait.
        </div>
      </div>
    </div>
  );
}

function FraudAlerts({ alerts, active }: { alerts: FraudAlert[]; active: FraudAlert[] }) {
  // RepliÃ©e par dÃ©faut : une vingtaine de rejets empilÃ©s remplissaient l'Ã©cran
  // et repoussaient la liste des passagers hors de vue. Le dÃ©tail reste Ã  un
  // clic : sur un systÃ¨me anti-fraude, on ne masque pas un rejet sans recours.
  const [open, setOpen] = useState(false);
  const cleared = alerts.filter((a) => a.resolved);
  const last = active[0] ?? alerts[0];

  return (
    <div style={s.alertsBox}>
      <button
        type="button"
        style={s.alertSummary}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={s.alertTag}>
          <IconAlert size={15} /> Ã‰cartÃ© +{active.length}
        </span>
        <span style={s.alertSummaryText}>
          {active.length} bagage{active.length > 1 ? 's' : ''} Ã©cartÃ©{active.length > 1 ? 's' : ''}
          {last ? ` Â· dernier Ã  ${new Date(last.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          {cleared.length > 0 ? ` Â· ${cleared.length} levÃ©${cleared.length > 1 ? 's' : ''}` : ''}
        </span>
        <span style={s.alertSummaryAction}>{open ? 'Masquer' : 'Voir le dÃ©tail'}</span>
      </button>

      {open ? (
        <>
          {active.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
          {cleared.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </>
      ) : null}
    </div>
  );
}

function AlertRow({ alert: a }: { alert: FraudAlert }) {
  // RÃ¨gle 1 : l'Ã©tiquette n'est rattachÃ©e Ã  aucun boarding pass, donc ni nom ni
  // PNR Ã  afficher. PrÃ©tendre Â« Passager inconnu Â· PNR N/A Â» n'aide personne ;
  // c'est la note de diagnostic qui porte l'information exploitable.
  const identified = Boolean(a.passenger_name || a.pnr);

  return (
    <div style={a.resolved ? { ...s.alert, background: 'var(--bg-neutral)' } : s.alert}>
      <span style={a.resolved ? { ...s.alertTag, ...s.alertTagCleared } : s.alertTag}>
        <IconAlert size={15} /> {a.resolved ? 'LevÃ©' : 'Ã‰cartÃ©'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Ã‰tiquette {a.tag_number ?? 'N/A'}</strong>
        {identified ? (
          <>
            {' '}
            Â· {a.passenger_name ?? 'Nom inconnu'} Â· PNR {a.pnr ?? 'N/A'}
          </>
        ) : null}
        <div style={{ color: 'var(--content-secondary)' }}>
          {a.reason}
          {a.gate ? ` Â· ${a.gate}` : ''} Â· {new Date(a.created_at).toLocaleString('fr-FR')}
        </div>
        {a.note ? <div style={{ color: 'var(--content-secondary)', marginTop: 4 }}>{a.note}</div> : null}
      </div>
    </div>
  );
}

/**
 * Fiche passager. Le tableau se limite Ã  Â« 1/2 Â» sur les bagages ; pour agir,
 * le superviseur a besoin de savoir QUELLE Ã©tiquette manque et oÃ¹ en sont
 * celles qui sont passÃ©es. Les donnÃ©es sont chargÃ©es Ã  l'ouverture plutÃ´t
 * qu'avec la liste : sur un vol Ã  111 passagers, prÃ©charger les Ã©tiquettes et
 * les escales de tout le monde pour n'en consulter qu'une serait du gÃ¢chis.
 */
function PassengerDetailModal({
  p,
  fallbackRoute,
  canManage,
  onChanged,
  onClose,
}: {
  p: PassengerRow;
  fallbackRoute: string;
  canManage: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const profile = useSession();
  const [legs, setLegs] = useState<PassengerLeg[]>([]);
  const [bags, setBags] = useState<Baggage[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // p est une photographie prise Ã  l'ouverture : le dÃ©barquement fait ici doit
  // se voir sans refermer la fiche.
  const [offloaded, setOffloaded] = useState(p.offloaded);
  // Confirmation en deux temps (motif obligatoire Ã  l'Ã©cran, facultatif Ã  la saisie).
  const [confirm, setConfirm] = useState<{ kind: 'bag'; bag: Baggage } | { kind: 'offload' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [{ data: legRows }, { data: bagRows }] = await Promise.all([
        supabase.from('passenger_legs').select('*').eq('passenger_id', p.id).order('leg_order'),
        supabase.from('baggage').select('*').eq('passenger_id', p.id).eq('kind', 'passenger').order('tag_number'),
      ]);
      if (cancelled) return;
      setLegs((legRows as PassengerLeg[] | null) ?? []);
      setBags((bagRows as Baggage[] | null) ?? []);

      // Nom des agents qui ont scannÃ©, plutÃ´t qu'un UUID illisible.
      const ids = [p.scanned_by, p.boarded_by].filter((v): v is string => Boolean(v));
      if (ids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const pr of (profs as { id: string; full_name: string }[] | null) ?? []) map[pr.id] = pr.full_name;
        setAgents(map);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [p.id, p.scanned_by, p.boarded_by, refreshKey]);

  const route = legs.length > 0 ? null : (p.route ?? fallbackRoute);
  const confirmed = bags.filter((b) => b.is_confirmed && !b.cancelled).length;
  const activeBags = bags.filter((b) => !b.cancelled).length;

  function agentName(id: string | null): string {
    if (!id) return 'agent inconnu';
    return agents[id] ?? 'agent inconnu';
  }

  /** Annule UN bagage. Une garde .eq('cancelled', false) Ã©vite le double clic. */
  async function cancelBag(bag: Baggage, why: string) {
    setBusy(true);
    await createClient()
      .from('baggage')
      .update({
        cancelled: true,
        cancelled_at: new Date().toISOString(),
        cancelled_by: profile?.id ?? null,
        cancel_reason: why.trim() || null,
      })
      .eq('id', bag.id)
      .eq('cancelled', false);
    setBusy(false);
    setConfirm(null);
    setReason('');
    setRefreshKey((k) => k + 1);
    onChanged();
  }

  /**
   * DÃ©barque le passager : marquage (jamais de suppression) + annulation de
   * tous ses bagages encore actifs. Un bagage dÃ©jÃ  en soute passe dans le
   * bandeau Â« Ã  retirer Â» du vol jusqu'au scan de retrait.
   */
  async function offloadPassenger(why: string) {
    setBusy(true);
    const supabase = createClient();
    const stamp = new Date().toISOString();
    await supabase
      .from('passengers')
      .update({
        offloaded: true,
        offloaded_at: stamp,
        offloaded_by: profile?.id ?? null,
        offload_reason: why.trim() || null,
      })
      .eq('id', p.id)
      .eq('offloaded', false);
    await supabase
      .from('baggage')
      .update({
        cancelled: true,
        cancelled_at: stamp,
        cancelled_by: profile?.id ?? null,
        cancel_reason: 'Passager dÃ©barquÃ©',
      })
      .eq('passenger_id', p.id)
      .eq('kind', 'passenger')
      .eq('cancelled', false);
    setBusy(false);
    setConfirm(null);
    setReason('');
    setOffloaded(true);
    setRefreshKey((k) => k + 1);
    onChanged();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div
        style={isMobile ? { ...s.paxModal, ...s.paxModalMobile } : s.paxModal}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={s.modalHead}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ ...sectionHeading, margin: 0, fontSize: isMobile ? 17 : 20, overflowWrap: 'anywhere' }}>
              {p.full_name}
            </h2>
            <div style={s.paxModalSub}>
              PNR {p.pnr} Â· SiÃ¨ge {p.seat ?? 'N/A'} Â· Classe {p.class ?? 'N/A'}
              {p.sequence_number ? ` Â· SÃ©quence ${p.sequence_number}` : ''}
            </div>
          </div>
          <button type="button" style={s.modalClose} onClick={onClose} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>

        <section style={s.paxSection}>
          <h3 style={s.paxSectionTitle}>ItinÃ©raire</h3>
          {route ? (
            <div style={s.paxLineValue}>{route}</div>
          ) : (
            legs.map((l) => (
              <div key={l.id} style={s.paxLeg}>
                <span style={s.stopIndex}>{l.leg_order}</span>
                <span style={s.paxLineValue}>
                  {l.origin} â†’ {l.destination}
                </span>
                <span style={s.paxLineLabel}>{l.flight_number ?? ''}</span>
              </div>
            ))
          )}
        </section>

        <section style={s.paxSection}>
          <h3 style={s.paxSectionTitle}>Suivi</h3>
          {offloaded ? (
            <div style={{ ...s.paxLine, color: 'var(--negative)', fontWeight: 600 }}>
              Passager dÃ©barquÃ© par le superviseur
              {p.offloaded && p.offloaded_at ? ` Ã  ${formatTime(p.offloaded_at)}` : ''}
              {p.offload_reason ? ` Â· ${p.offload_reason}` : ''}
            </div>
          ) : null}
          {/* Sur mobile, libellÃ© au-dessus de la valeur : cÃ´te Ã  cÃ´te, Â« 08:42 par
              Jean Mukeba Â» se coupe en plein milieu sur un Ã©cran de 320 px. */}
          <div style={isMobile ? { ...s.paxLine, ...s.paxLineMobile } : s.paxLine}>
            <span style={isMobile ? s.paxLineLabelMobile : s.paxLineLabel}>EnregistrÃ©</span>
            <span style={s.paxLineValue}>
              {formatTime(p.scanned_at)} par {agentName(p.scanned_by)}
            </span>
          </div>
          <div style={isMobile ? { ...s.paxLine, ...s.paxLineMobile } : s.paxLine}>
            <span style={isMobile ? s.paxLineLabelMobile : s.paxLineLabel}>Embarquement</span>
            <span style={s.paxLineValue}>
              {p.boarded
                ? `${formatTime(p.boarded_at)} par ${agentName(p.boarded_by)}`
                : 'Pas encore embarquÃ©'}
            </span>
          </div>
        </section>

        <section style={s.paxSection}>
          <h3 style={s.paxSectionTitle}>
            Bagages Â· {confirmed} au tapis sur {offloaded ? activeBags : p.declared_baggage_count} dÃ©clarÃ©
            {(offloaded ? activeBags : p.declared_baggage_count) > 1 ? 's' : ''}
          </h3>
          {loading ? (
            <div style={s.paxLineLabel}>Chargementâ€¦</div>
          ) : bags.length === 0 ? (
            <div style={s.paxLineLabel}>Aucun bagage dÃ©clarÃ© sur le boarding pass.</div>
          ) : (
            bags.map((b) => (
              <BaggageDetailRow
                key={b.id}
                b={b}
                isMobile={isMobile}
                onCancel={
                  canManage && !b.cancelled && !offloaded
                    ? () => { setConfirm({ kind: 'bag', bag: b }); setReason(''); }
                    : undefined
                }
              />
            ))
          )}
        </section>

        {confirm ? (
          <section style={{ ...s.paxSection, gap: 10 }}>
            <h3 style={s.confirmTitle}>
              {confirm.kind === 'bag'
                ? confirm.bag.in_hold
                  ? `DÃ©barquer le bagage ${confirm.bag.tag_number} de la soute ?`
                  : `Annuler le bagage ${confirm.bag.tag_number} ?`
                : `DÃ©barquer ${p.full_name} ?`}
            </h3>
            <div style={{ color: 'var(--content-secondary)', fontSize: 13 }}>
              {confirm.kind === 'bag'
                ? confirm.bag.in_hold
                  ? 'Ce bagage est dÃ©jÃ  en soute : il devra Ãªtre physiquement retirÃ© (bandeau Â« Ã  retirer Â» sur le vol).'
                  : 'Le bagage sera refusÃ© Ã  tous les scans. Action tracÃ©e dans le journal.'
                : 'Tous ses bagages seront annulÃ©s, son boarding pass sera refusÃ© Ã  la porte. Action tracÃ©e dans le journal.'}
            </div>
            <input
              style={s.input}
              placeholder="Motif (no-show, refus d'embarquement, bagage refusÃ© au rayon Xâ€¦)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} disabled={busy} onClick={() => { setConfirm(null); setReason(''); }}>
                Retour
              </button>
              <button
                type="button"
                style={{ ...btnPrimary, background: 'var(--negative)' }}
                disabled={busy}
                onClick={() =>
                  confirm.kind === 'bag' ? void cancelBag(confirm.bag, reason) : void offloadPassenger(reason)
                }
              >
                {busy
                  ? 'En coursâ€¦'
                  : confirm.kind === 'bag'
                    ? confirm.bag.in_hold
                      ? 'DÃ©barquer ce bagage'
                      : 'Annuler ce bagage'
                    : 'DÃ©barquer le passager'}
              </button>
            </div>
          </section>
        ) : canManage && !offloaded ? (
          <section style={s.paxSection}>
            <button
              type="button"
              style={{ ...btnSecondary, color: 'var(--negative)', alignSelf: 'flex-start' }}
              onClick={() => { setConfirm({ kind: 'offload' }); setReason(''); }}
            >
              DÃ©barquer le passager
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** Une Ã©tiquette et son parcours rÃ©el, Ã©tape par Ã©tape. */
function BaggageDetailRow({ b, isMobile, onCancel }: { b: Baggage; isMobile: boolean; onCancel?: () => void }) {
  const steps: string[] = [];
  if (b.is_confirmed) steps.push(`Au tapis ${formatTime(b.scanned_at)}`);
  if (b.on_dolly) steps.push(`Dolly ${formatTime(b.on_dolly_at)}`);
  if (b.soute) steps.push(`${SOUTE_LABEL[b.soute]} ${formatTime(b.soute_at)}`);
  if (b.in_hold) steps.push(`ChargÃ© ${formatTime(b.in_hold_at)}`);
  if (b.rush) steps.push(`Rush ${formatTime(b.rush_at)}`);
  if (b.arrived) steps.push(`ArrivÃ© ${formatTime(b.arrived_at)}`);

  return (
    // Le parcours d'un bagage tient sur une ligne en desktop (Â« Au tapis 08:43 Â·
    // Dolly 09:02 Â· Soute avant 09:10 Â») mais pas Ã  cÃ´tÃ© d'un numÃ©ro Ã  10
    // chiffres sur un tÃ©lÃ©phone : on empile.
    <div style={isMobile ? { ...s.paxBag, ...s.paxBagMobile } : s.paxBag}>
      <span
        style={{
          ...(isMobile ? s.paxBagTagMobile : s.paxBagTag),
          ...(b.cancelled ? { textDecoration: 'line-through', color: 'var(--content-secondary)' } : {}),
        }}
      >
        {b.tag_number}
      </span>
      {b.cancelled ? (
        <span style={{ ...s.paxLineValue, color: 'var(--negative)' }}>
          {b.in_hold ? 'DÃ©barquÃ©' : 'AnnulÃ©'} {formatTime(b.cancelled_at)}
          {b.cancel_reason ? ` Â· ${b.cancel_reason}` : ''}
          {b.in_hold ? (b.pulled ? ` Â· retirÃ© de la soute ${formatTime(b.pulled_at)}` : ' Â· Ã  retirer de la soute') : ''}
        </span>
      ) : b.is_confirmed ? (
        <span style={s.paxLineValue}>{steps.join(' Â· ')}</span>
      ) : (
        // Le cas qui n'apparaÃ®t nulle part ailleurs : dÃ©clarÃ© au comptoir, mais
        // jamais prÃ©sentÃ© au tapis. Ni le compteur ni les alertes ne le disent.
        <span style={{ ...s.paxLineValue, color: 'var(--warning-content)' }}>
          DÃ©clarÃ© au comptoir, jamais scannÃ© au tapis
        </span>
      )}
      {onCancel ? (
        // MÃªme mÃ©canique (annulation tracÃ©e), deux libellÃ©s : un bagage dÃ©jÃ 
        // chargÃ© se Â« dÃ©barque Â» de la soute, un bagage pas encore parti
        // s'Â« annule Â». C'est le vocabulaire du terrain, pas deux Ã©tats.
        <button
          type="button"
          style={s.bagActionBtn}
          onClick={onCancel}
        >
          {b.in_hold ? 'DÃ©barquer' : 'Annuler'}
        </button>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: Flight['status'] }) {
  const st = STATUS_STYLE[status];
  return (
    <span style={{ ...badge, background: st.bg, color: st.color }}>
      <span style={{ ...s.statusDot, background: 'currentColor' }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Modale crÃ©ation de vol
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FlightFormModal({ hub, onClose, onCreated }: { hub: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({
    flight_number: '',
    other_airport: '',
    stops: [] as string[],
    date: todayAtAirport(hub),
    time: '',
    status: 'scheduled' as Flight['status'],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addStop() {
    set('stops', [...form.stops, '']);
  }
  function setStop(index: number, value: string) {
    set('stops', form.stops.map((v, i) => (i === index ? value : v)));
  }
  function removeStop(index: number) {
    set('stops', form.stops.filter((_, i) => i !== index));
  }

  const cleanStops = form.stops.map((v) => v.trim().toUpperCase()).filter((v) => v.length > 0);
  const endAirport = form.other_airport.trim().toUpperCase() || '???';
  const routePreview = [hub, ...cleanStops, endAirport];

  function toTimestamp(time: string): string | null {
    if (!time) return null;
    return new Date(`${form.date}T${time}:00`).toISOString();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const other = form.other_airport.trim().toUpperCase();
    const stops = form.stops.map((v) => v.trim().toUpperCase()).filter((v) => v.length > 0);
    const payload = {
      flight_number: form.flight_number.trim().toUpperCase(),
      origin: hub,
      destination: other,
      stops,
      date: form.date,
      departure_time: toTimestamp(form.time),
      arrival_time: null,
      status: form.status,
    };
    const { data, error: err } = await createClient().from('flights').insert(payload).select('id').single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onCreated((data as { id: string }).id);
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <form style={s.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={s.modalHead}>
          <h2 style={{ ...sectionHeading, margin: 0 }}>Nouveau vol au dÃ©part de {hub}</h2>
          <button type="button" style={s.modalClose} onClick={onClose} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>

        <div style={s.field}>
          <label style={s.label}>NumÃ©ro de vol</label>
          <input style={s.input} placeholder="ET0062" value={form.flight_number} onChange={(e) => set('flight_number', e.target.value)} required />
        </div>

        <div style={s.field}>
          <label style={s.label}>Destination finale</label>
          <input style={s.input} placeholder="FBM" value={form.other_airport} onChange={(e) => set('other_airport', e.target.value.toUpperCase())} required />
        </div>

        <div style={s.field}>
          <div style={s.stopsHead}>
            <label style={s.label}>Escales (transit)</label>
            <button type="button" style={s.addStopBtn} onClick={addStop}>
              <IconPlus size={13} /> Escale
            </button>
          </div>
          {form.stops.length === 0 ? (
            <div style={s.stopsHint}>Vol direct. Ajoutez une escale pour un vol avec transit.</div>
          ) : (
            form.stops.map((stop, i) => (
              <div key={i} style={s.stopRow}>
                <span style={s.stopIndex}>{i + 1}</span>
                <input style={{ ...s.input, flex: 1 }} placeholder="FKI" value={stop} onChange={(e) => setStop(i, e.target.value)} required />
                <button type="button" style={s.removeStopBtn} onClick={() => removeStop(i)} aria-label="Retirer">
                  <IconClose size={15} />
                </button>
              </div>
            ))
          )}
          <div style={s.routePreview}>
            {routePreview.map((code, i) => (
              <span key={i}>
                {i > 0 ? <span style={{ color: 'var(--content-secondary)' }}> â†’ </span> : null}
                <strong>{code}</strong>
              </span>
            ))}
          </div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Date</label>
            <input style={s.input} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Heure de dÃ©part</label>
            <input style={s.input} type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Statut</label>
          <select style={s.input} value={form.status} onChange={(e) => set('status', e.target.value as Flight['status'])}>
            {FLIGHT_STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {FLIGHT_STATUS_LABEL[st]}
              </option>
            ))}
          </select>
        </div>

        {error ? <p style={{ color: 'var(--negative)', margin: 0 }}>{error}</p> : null}

        <div style={s.modalActions}>
          <button type="button" style={btnSecondary} onClick={onClose}>
            Annuler
          </button>
          <button type="submit" style={btnPrimary} disabled={busy}>
            {busy ? 'CrÃ©ationâ€¦' : 'CrÃ©er le vol'}
          </button>
        </div>
      </form>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  content: { padding: 28, maxWidth: 1160, margin: '0 auto', width: '100%' },
  contentMobile: { padding: '16px 14px' },

  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' },
  pageHeaderMobile: { flexDirection: 'column', gap: 12, marginBottom: 16 },
  // Titre de page et numÃ©ro de vol : Figtree 700, mÃªme dessin que les hÃ©ros
  // du portail public, en 28 px.
  pageTitle: { margin: 0, fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--content-primary)' },
  pageSub: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 4 },

  // Jauges : trois par rangÃ©e sur un Ã©cran de bureau, une sur tÃ©lÃ©phone.
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 24 },

  countPill: { background: 'var(--bg-neutral)', border: 'none', borderRadius: 9999, padding: '1px 10px', fontSize: 12, fontWeight: 700, color: 'var(--content-secondary)' },
  sectionEmpty: { color: 'var(--content-tertiary)', fontSize: 14, fontStyle: 'italic', marginBottom: 18 },

  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 20 },
  flightCard: {
    ...card,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    cursor: 'pointer',
  },
  flightCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  flightCardNumber: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--content-primary)' },
  flightCardRoute: { fontSize: 15 },
  flightCardFoot: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  alertPill: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--negative-bg)', color: 'var(--negative)', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 600 },

  emptyCard: { ...card, padding: '44px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--content-primary)' },

  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },

  backBtn: { ...btnText, height: 'auto', padding: 0, marginBottom: 16, fontSize: 14, cursor: 'pointer' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 16, flexWrap: 'wrap' },
  detailHeaderMobile: { flexDirection: 'column', gap: 12, marginBottom: 14 },
  detailRoute: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  routeChip: { background: 'var(--bg-neutral)', border: 'none', borderRadius: 9999, padding: '4px 14px', fontSize: 14, color: 'var(--content-primary)' },
  statusSelect: { ...inputStyle, width: 'auto', fontWeight: 500 },

  alertsBox: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 },
  // Bandeau d'alerte : aplat rouge pÃ¢le, rayon 8, texte Ã  l'encre ; seule la
  // pastille porte le rouge plein.
  alert: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--negative-bg)', color: 'var(--content-primary)', border: 'none', borderRadius: 8, padding: 14 },
  alertTag: { display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--interactive-control)', background: 'var(--negative)', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 },
  // Alerte levÃ©e : la pastille passe en gris, le libellÃ© suffit.
  alertTagCleared: { background: 'var(--bg-neutral-hover)', color: 'var(--content-primary)' },
  alertSummary: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'var(--negative-bg)', border: 'none', borderRadius: 8, padding: 14, font: 'inherit', color: 'var(--content-primary)', cursor: 'pointer', textAlign: 'left' },
  alertSummaryText: { flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  alertSummaryAction: { color: 'var(--content-primary)', fontSize: 13, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '0.3em', whiteSpace: 'nowrap', flexShrink: 0 },

  tableWrap: { ...card, padding: 0, overflowX: 'auto' },

  paxCardList: { display: 'flex', flexDirection: 'column', gap: 10 },
  paxCard: { ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  paxCardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  paxCardName: { fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em' },
  paxCardRoute: { color: 'var(--content-secondary)', fontSize: 13, fontWeight: 600 },
  paxCardMeta: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  paxMeta: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  // LibellÃ© de mÃ©ta (Â« SiÃ¨ge Â», Â« PNR Â») : l'eyebrow, ramenÃ© Ã  11 px pour
  // tenir Ã  quatre par ligne sur un Ã©cran de 320 px.
  paxMetaLabel: { ...eyebrow, margin: 0, fontSize: 11 },
  paxMetaValue: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'transparent' },
  th: { textAlign: 'left', padding: 14, color: 'var(--content-tertiary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--divider)' },
  td: { padding: 14, color: 'var(--content-primary)', borderBottom: '1px solid var(--divider)' },
  tdEmpty: { padding: '32px 14px', textAlign: 'center', color: 'var(--content-secondary)' },

  // Pas de soulignement ni de couleur d'accent : sur une centaine de lignes Ã§a
  // ferait un mur de liens. Le survol de ligne (globals.css) et le curseur
  // suffisent Ã  indiquer que c'est cliquable.
  paxNameBtn: { background: 'transparent', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'inherit', cursor: 'pointer', textAlign: 'left' },

  overlay: { ...modalOverlay },
  modal: { ...modalPanel, width: 460, maxWidth: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto' },
  paxModal: { ...modalPanel, width: 560, maxWidth: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '90vh', overflowY: 'auto' },
  // TÃ©lÃ©phone : la fiche prend toute la largeur disponible et respire moins.
  // Sur un Ã©cran de 320 px, 24 px de marge de chaque cÃ´tÃ© mangeaient un sixiÃ¨me
  // de la ligne.
  paxModalMobile: { width: '100%', padding: 16, gap: 16, maxHeight: '92vh' },
  paxModalSub: { color: 'var(--content-secondary)', fontSize: 13, marginTop: 4 },
  paxSection: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--divider)', paddingTop: 16 },
  paxSectionTitle: { ...eyebrow, margin: 0 },
  // Question de confirmation : une vraie phrase, pas un eyebrow en capitales.
  confirmTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--negative)' },
  // Lien d'action d'une ligne de bagage (Â« Annuler Â», Â« DÃ©barquer Â»).
  bagActionBtn: { ...btnText, height: 'auto', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--negative)', cursor: 'pointer' },
  paxLine: { display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' },
  paxLineMobile: { flexDirection: 'column', gap: 1, alignItems: 'stretch' },
  paxLineLabel: { color: 'var(--content-secondary)', fontSize: 13, minWidth: 110 },
  paxLineLabelMobile: { color: 'var(--content-secondary)', fontSize: 12 },
  paxLineValue: { fontSize: 14, color: 'var(--content-primary)', overflowWrap: 'anywhere' },
  paxLeg: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  paxBag: { display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', paddingTop: 4 },
  paxBagMobile: { flexDirection: 'column', gap: 1, alignItems: 'stretch', paddingTop: 8 },
  paxBagTag: { fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, minWidth: 110 },
  paxBagTagMobile: { fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600 },
  modalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  // Cible tactile : 40 px de cÃ´tÃ©, sinon la croix est presque impossible Ã 
  // toucher au pouce sur un tÃ©lÃ©phone.
  modalClose: { background: 'transparent', border: 'none', color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, cursor: 'pointer' },
  row: { display: 'flex', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  label: { ...labelStyle },
  input: { ...inputStyle },
  stopsHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  // Petit bouton secondaire (32 px) : ajouter une escale n'est pas l'action
  // principale du formulaire.
  addStopBtn: { ...btnSecondary, height: 32, padding: '0 12px', fontSize: 12, cursor: 'pointer' },
  stopsHint: { color: 'var(--content-secondary)', fontSize: 13, fontStyle: 'italic' },
  stopRow: { display: 'flex', alignItems: 'center', gap: 8 },
  stopIndex: { width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-neutral)', border: 'none', display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--content-secondary)', flexShrink: 0 },
  removeStopBtn: { background: 'var(--bg-neutral)', border: 'none', color: 'var(--content-secondary)', borderRadius: 9999, width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' },
  routePreview: { background: 'var(--bg-neutral)', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 14, marginTop: 2 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
};
