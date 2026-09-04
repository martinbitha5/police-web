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
// Pastilles de statut, pilules sémantiques (fond + texte) : vert quand le vol
// avance, ambre quand il attend, rouge quand il est annulé.
const STATUS_STYLE: Record<Flight['status'], { bg: string; color: string }> = {
  scheduled: { bg: 'var(--bg-neutral)', color: 'var(--content-secondary)' },
  delayed: { bg: 'var(--warning-bg)', color: 'var(--warning-content)' },
  boarding: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  closed: { bg: 'var(--bg-neutral)', color: 'var(--content-primary)' },
  departed: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  arrived: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  cancelled: { bg: 'var(--negative-bg)', color: 'var(--negative)' },
};

// La journée d'exploitation bascule à minuit à l'aéroport du superviseur.
// toISOString() renvoyait la date UTC : à Kinshasa (UTC+1), de 00h00 à 01h00,
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
      {/* useSearchParams impose une frontière Suspense au prérendu statique. */}
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
  // Passagers et bagages du jour, agrégés par la vue flight_stats : les jauges
  // de la vue d'ensemble rapportent l'embarqué à l'enregistré et le confirmé
  // au déclaré, sans rapatrier une seule ligne de passager.
  const [totals, setTotals] = useState<FlightStatsTotals | null>(null);
  // Le vol ouvert vit dans l'URL (?vol=<id>) : F5 rouvre le même vol au lieu
  // de renvoyer à la vue d'ensemble, et Retour referme le détail.
  const [selectedId, setSelectedId] = useUrlParam('vol');
  const [showForm, setShowForm] = useState(false);

  async function loadFlights() {
    const supabase = createClient();
    const today = todayAtAirport(airportCode);
    // Périmètre du profil : son aéroport ET sa compagnie. Sans le filtre
    // transporteur, un profil KQ voyait les vols ET du même aéroport.
    const { data: fl } = await scopeFlightQuery(
      supabase.from('flights').select('*').eq('date', today),
      scope,
    ).order('departure_time', { ascending: true });
    const list = (fl as Flight[] | null) ?? [];
    setFlights(list);

    // Compteurs du jour. Un échec ne vide pas la vue : les jauges de
    // passagers et de bagages attendent simplement le prochain chargement.
    try {
      setTotals(sumFlightStats(await loadFlightStats({ from: today, to: today }, scope)));
    } catch {
      // Les jauges de vols restent affichées, elles ne dépendent pas de la vue.
    }

    const ids = list.map((f) => f.id);
    if (ids.length > 0) {
      // Seul le compteur par vol est affiché ici : on ne rapatrie que flight_id,
      // pas les lignes complètes. Sur un vol à forte fraude (des centaines
      // d'alertes), charger tout le détail, noms passagers et étiquettes
      // compris, pour n'afficher qu'un nombre serait inutile et coûteux.
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

  // Recharge quand le profil est connu (profile.id passe de undefined → UUID)
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

// ─────────────────────────────────────────────────────────────
// Vue d'ensemble
// ─────────────────────────────────────────────────────────────

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

      {/* Chaque jauge rapporte le chiffre du centre à une référence dite en
          clair dessous : un « 8 » seul ne dit rien, « 8 dont 3 fermés » dit où
          en est la journée. */}
      <div style={isMobile ? { ...s.statGrid, gridTemplateColumns: '1fr' } : s.statGrid}>
        <Gauge
          label="Vols du jour"
          value={flights.length}
          total={flights.length}
          ratio={flights.length > 0 ? departed / flights.length : 0}
          caption={flights.length > 0 ? `${departed} décollé${departed > 1 ? 's' : ''} sur ${flights.length}` : 'aucun vol'}
        />
        <Gauge
          label="Passagers embarqués"
          value={totals?.boarded ?? 0}
          total={totals?.pax ?? 0}
          caption={totals ? `sur ${totals.pax} enregistrés` : 'en attente des compteurs'}
        />
        <Gauge
          label="Bagages confirmés"
          value={totals?.confirmed ?? 0}
          total={totals?.declared ?? 0}
          caption={totals ? `sur ${totals.declared} déclarés` : 'en attente des compteurs'}
        />
        <Gauge
          label="Bagages écartés"
          value={totalAlerts}
          total={flights.length}
          caption={
            totalAlerts > 0
              ? `${flightsWithAlerts} vol${flightsWithAlerts > 1 ? 's' : ''} concerné${flightsWithAlerts > 1 ? 's' : ''}`
              : 'aucun écart'
          }
          danger={totalAlerts > 0}
        />
      </div>

      {/* Pas de liste des bagages écartés ici : la vue d'ensemble n'affiche que
          le compteur (carte « Bagages écartés » ci-dessus). Le détail par alerte
          reste consultable en ouvrant le vol concerné. */}

      {flights.length === 0 ? (
        <div style={s.emptyCard}>
          <IconPlane size={34} />
          <div style={{ fontWeight: 600, marginTop: 10 }}>Aucun vol programmé aujourd&apos;hui</div>
          <div style={{ color: 'var(--content-secondary)', marginTop: 4 }}>
            {canManage ? 'Créez un premier vol pour commencer le suivi.' : 'Aucun vol à afficher pour le moment.'}
          </div>
          {canManage ? (
            <button style={{ ...btnPrimary, marginTop: 16 }} onClick={onAdd}>
              <IconPlus size={16} /> Ajouter un vol du jour
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <FlightSection hub={hub} title="Départs" icon={<IconPlaneDepart size={16} />} flights={departures} alerts={alerts} onSelect={onSelect} />
          {/* La section Arrivées n'apparaît que s'il y a un vol à réceptionner :
              un titre suivi de « Aucun vol » n'apporte rien à un poste qui ne
              fait que des départs. */}
          {arrivals.length > 0 ? (
            <FlightSection hub={hub} title="Arrivées" icon={<IconPlaneArrive size={16} />} flights={arrivals} alerts={alerts} onSelect={onSelect} />
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
          {flight.origin === hub ? `Départ ${formatTime(flight.departure_time)}` : `Arrivée ${formatTime(flight.arrival_time)}`}
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

// ─────────────────────────────────────────────────────────────
// Détail d'un vol
// ─────────────────────────────────────────────────────────────

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

  // Une alerte résolue reste consultable mais ne pèse plus sur les compteurs.
  const activeAlerts = useMemo(() => alerts.filter((a) => !a.resolved), [alerts]);
  // Passagers actifs : les débarqués restent listés (barrés) mais ne comptent plus.
  const activePax = passengers.length - offloadedCount;
  // Physiquement présents (scannés) : les annoncés pas encore arrivés sont à part.
  const rushActive = useMemo(
    () => rushForward.filter((b) => b.rush_status === 'approved' || b.rush_status === 'pending'),
    [rushForward],
  );
  const rushPending = useMemo(() => rushForward.filter((b) => b.rush_status === 'pending'), [rushForward]);
  const rushExpected = useMemo(() => rushForward.filter((b) => b.rush_status === 'expected'), [rushForward]);

  // Passager dont on affiche la fiche. Le tableau ne montre qu'un compteur
  // « 1/2 » : savoir QUEL bagage manque demande d'ouvrir le détail.
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
            {flight.origin === hub ? `Départ ${formatTime(flight.departure_time)}` : `Arrivée ${formatTime(flight.arrival_time)}`} · {formatToday()}
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
          label="Passagers embarqués"
          value={boardedCount}
          total={activePax}
          caption={`sur ${activePax} enregistré${activePax > 1 ? 's' : ''}`}
        />
        <Gauge
          label="Bagages confirmés"
          value={baggageConfirmed}
          total={baggageDeclared}
          caption={`sur ${baggageDeclared} déclaré${baggageDeclared > 1 ? 's' : ''}`}
        />
        <Gauge
          label="Chargés en soute"
          value={baggageInHold}
          total={baggageConfirmed}
          caption={`sur ${baggageConfirmed} confirmé${baggageConfirmed > 1 ? 's' : ''}`}
        />
        {/* Réception à destination. En alerte seulement une fois le déchargement
            commencé : avant ça, 0 sur N est normal, pas un manquant. */}
        <Gauge
          label="Arrivés à destination"
          value={baggageArrived}
          total={baggageExpected}
          caption={`sur ${baggageExpected} attendu${baggageExpected > 1 ? 's' : ''}`}
          danger={baggageArrived > 0 && baggageArrived < baggageExpected}
        />
        <Gauge
          label="Restants à réacheminer"
          value={baggageRush}
          total={baggageDeclared}
          caption={baggageRush > 0 ? `sur ${baggageDeclared} déclaré${baggageDeclared > 1 ? 's' : ''}` : 'aucun restant'}
          danger={baggageRush > 0}
        />
        <Gauge
          label="Expédition rush"
          value={rushActive.length}
          total={rushActive.length + rushExpected.length}
          caption={
            rushPending.length > 0
              ? `${rushPending.length} à valider`
              : rushExpected.length > 0
                ? `${rushExpected.length} attendu${rushExpected.length > 1 ? 's' : ''}`
                : rushActive.length > 0
                  ? 'tous présents'
                  : 'aucun bagage sans passager'
          }
          danger={rushPending.length > 0}
        />
        {offloadedCount > 0 ? (
          <Gauge
            label="Débarqués"
            value={offloadedCount}
            total={passengers.length}
            caption={`sur ${passengers.length} passager${passengers.length > 1 ? 's' : ''}`}
            danger
          />
        ) : null}
        {/* Les alertes levées (check-in scanné après le bagage) ne comptent plus
            comme des écartés : sinon une inversion d'ordre de scan gonfle le
            compteur de fraude et noie les vrais rejets. */}
        <Gauge
          label="Bagages écartés"
          value={activeAlerts.length}
          total={baggageDeclared + activeAlerts.length}
          caption={activeAlerts.length > 0 ? 'à intercepter sur le tapis' : 'aucun écart'}
          danger={activeAlerts.length > 0}
        />
      </div>

      {toPull.length > 0 ? <PullBanner bags={toPull} /> : null}

      {alerts.length > 0 ? <FraudAlerts alerts={alerts} active={activeAlerts} /> : null}

      <RushPanel flightId={flight.id} bags={rushForward} canManage={canManage} onChanged={reload} mode="compact" />

      <h2 style={sectionHeading}>Passagers</h2>
      {isMobile ? (
        // Mobile : cartes empilées (un tableau à 7 colonnes serait illisible).
        passengers.length === 0 ? (
          <div style={s.tdEmpty}>Aucun passager scanné pour le moment.</div>
        ) : (
          <div style={s.paxCardList}>
            {passengers.map((p) => (
              <PassengerCardMobile
                key={p.id}
                p={p}
                fallbackRoute={formatRoute(flight, '→')}
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
                <th style={s.th}>Siège</th>
                <th style={s.th}>Classe</th>
                <th style={s.th}>Route</th>
                <th style={s.th}>PNR</th>
                <th style={s.th}>Bagages</th>
                <th style={s.th}>Embarqué</th>
              </tr>
            </thead>
            <tbody>
              {passengers.length === 0 ? (
                <tr>
                  <td style={s.tdEmpty} colSpan={7}>
                    Aucun passager scanné pour le moment.
                  </td>
                </tr>
              ) : (
                passengers.map((p) => (
                  <PassengerRowView
                    key={p.id}
                    p={p}
                    fallbackRoute={formatRoute(flight, '→')}
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
          fallbackRoute={formatRoute(flight, '→')}
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
            <span style={{ ...s.statusDot, background: 'currentColor' }} /> Débarqué
          </span>
        ) : p.boarded ? (
          <span style={{ ...badge, background: 'var(--positive-bg)', color: 'var(--positive)' }}>
            <span style={{ ...s.statusDot, background: 'currentColor' }} /> Embarqué
          </span>
        ) : (
          <span style={{ ...badge, color: 'var(--content-secondary)' }}>En attente</span>
        )}
      </div>
      <div style={s.paxCardRoute}>{p.route ?? fallbackRoute}</div>
      <div style={s.paxCardMeta}>
        <PaxMeta label="Siège" value={p.seat ?? 'N/A'} />
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
            Débarqué
          </span>
        ) : p.boarded ? (
          <span style={{ ...badge, background: 'var(--positive-bg)', color: 'var(--positive)' }}>
            <span style={{ ...s.statusDot, background: 'currentColor' }} />
            Embarqué
          </span>
        ) : (
          <span style={{ color: 'var(--content-secondary)' }}>En attente</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Bagages annulés encore en soute : le statut ne suffit pas, il faut que
 * quelqu'un aille physiquement les sortir. Le bandeau reste affiché tant que
 * le retrait n'a pas été confirmé par scan (écran Soute du PDA).
 */
function PullBanner({ bags }: { bags: Baggage[] }) {
  return (
    <div style={{ ...s.alert, marginBottom: 24, alignItems: 'flex-start' }}>
      <span style={s.alertTag}>
        <IconAlert size={15} /> À retirer
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>
          {bags.length} bagage{bags.length > 1 ? 's' : ''} annulé{bags.length > 1 ? 's' : ''} encore en soute
        </strong>
        <div style={{ color: 'var(--content-secondary)', marginTop: 4 }}>
          {bags
            .map((b) => `${b.tag_number}${b.soute ? ` (${SOUTE_LABEL[b.soute].toLowerCase()})` : ''}`)
            .join(' · ')}
        </div>
        <div style={{ color: 'var(--content-secondary)', marginTop: 4 }}>
          Faire rescanner chaque bagage dans l&apos;écran Soute du PDA pour confirmer le retrait.
        </div>
      </div>
    </div>
  );
}

function FraudAlerts({ alerts, active }: { alerts: FraudAlert[]; active: FraudAlert[] }) {
  // Repliée par défaut : une vingtaine de rejets empilés remplissaient l'écran
  // et repoussaient la liste des passagers hors de vue. Le détail reste à un
  // clic : sur un système anti-fraude, on ne masque pas un rejet sans recours.
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
          <IconAlert size={15} /> Écarté +{active.length}
        </span>
        <span style={s.alertSummaryText}>
          {active.length} bagage{active.length > 1 ? 's' : ''} écarté{active.length > 1 ? 's' : ''}
          {last ? ` · dernier à ${new Date(last.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          {cleared.length > 0 ? ` · ${cleared.length} levé${cleared.length > 1 ? 's' : ''}` : ''}
        </span>
        <span style={s.alertSummaryAction}>{open ? 'Masquer' : 'Voir le détail'}</span>
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
  // Règle 1 : l'étiquette n'est rattachée à aucun boarding pass, donc ni nom ni
  // PNR à afficher. Prétendre « Passager inconnu · PNR N/A » n'aide personne ;
  // c'est la note de diagnostic qui porte l'information exploitable.
  const identified = Boolean(a.passenger_name || a.pnr);

  return (
    <div style={a.resolved ? { ...s.alert, background: 'var(--bg-neutral)' } : s.alert}>
      <span style={a.resolved ? { ...s.alertTag, ...s.alertTagCleared } : s.alertTag}>
        <IconAlert size={15} /> {a.resolved ? 'Levé' : 'Écarté'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Étiquette {a.tag_number ?? 'N/A'}</strong>
        {identified ? (
          <>
            {' '}
            · {a.passenger_name ?? 'Nom inconnu'} · PNR {a.pnr ?? 'N/A'}
          </>
        ) : null}
        <div style={{ color: 'var(--content-secondary)' }}>
          {a.reason}
          {a.gate ? ` · ${a.gate}` : ''} · {new Date(a.created_at).toLocaleString('fr-FR')}
        </div>
        {a.note ? <div style={{ color: 'var(--content-secondary)', marginTop: 4 }}>{a.note}</div> : null}
      </div>
    </div>
  );
}

/**
 * Fiche passager. Le tableau se limite à « 1/2 » sur les bagages ; pour agir,
 * le superviseur a besoin de savoir QUELLE étiquette manque et où en sont
 * celles qui sont passées. Les données sont chargées à l'ouverture plutôt
 * qu'avec la liste : sur un vol à 111 passagers, précharger les étiquettes et
 * les escales de tout le monde pour n'en consulter qu'une serait du gâchis.
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
  // p est une photographie prise à l'ouverture : le débarquement fait ici doit
  // se voir sans refermer la fiche.
  const [offloaded, setOffloaded] = useState(p.offloaded);
  // Confirmation en deux temps (motif obligatoire à l'écran, facultatif à la saisie).
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

      // Nom des agents qui ont scanné, plutôt qu'un UUID illisible.
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

  /** Annule UN bagage. Une garde .eq('cancelled', false) évite le double clic. */
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
   * Débarque le passager : marquage (jamais de suppression) + annulation de
   * tous ses bagages encore actifs. Un bagage déjà en soute passe dans le
   * bandeau « à retirer » du vol jusqu'au scan de retrait.
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
        cancel_reason: 'Passager débarqué',
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
              PNR {p.pnr} · Siège {p.seat ?? 'N/A'} · Classe {p.class ?? 'N/A'}
              {p.sequence_number ? ` · Séquence ${p.sequence_number}` : ''}
            </div>
          </div>
          <button type="button" style={s.modalClose} onClick={onClose} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>

        <section style={s.paxSection}>
          <h3 style={s.paxSectionTitle}>Itinéraire</h3>
          {route ? (
            <div style={s.paxLineValue}>{route}</div>
          ) : (
            legs.map((l) => (
              <div key={l.id} style={s.paxLeg}>
                <span style={s.stopIndex}>{l.leg_order}</span>
                <span style={s.paxLineValue}>
                  {l.origin} → {l.destination}
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
              Passager débarqué par le superviseur
              {p.offloaded && p.offloaded_at ? ` à ${formatTime(p.offloaded_at)}` : ''}
              {p.offload_reason ? ` · ${p.offload_reason}` : ''}
            </div>
          ) : null}
          {/* Sur mobile, libellé au-dessus de la valeur : côte à côte, « 08:42 par
              Jean Mukeba » se coupe en plein milieu sur un écran de 320 px. */}
          <div style={isMobile ? { ...s.paxLine, ...s.paxLineMobile } : s.paxLine}>
            <span style={isMobile ? s.paxLineLabelMobile : s.paxLineLabel}>Enregistré</span>
            <span style={s.paxLineValue}>
              {formatTime(p.scanned_at)} par {agentName(p.scanned_by)}
            </span>
          </div>
          <div style={isMobile ? { ...s.paxLine, ...s.paxLineMobile } : s.paxLine}>
            <span style={isMobile ? s.paxLineLabelMobile : s.paxLineLabel}>Embarquement</span>
            <span style={s.paxLineValue}>
              {p.boarded
                ? `${formatTime(p.boarded_at)} par ${agentName(p.boarded_by)}`
                : 'Pas encore embarqué'}
            </span>
          </div>
        </section>

        <section style={s.paxSection}>
          <h3 style={s.paxSectionTitle}>
            Bagages · {confirmed} au tapis sur {offloaded ? activeBags : p.declared_baggage_count} déclaré
            {(offloaded ? activeBags : p.declared_baggage_count) > 1 ? 's' : ''}
          </h3>
          {loading ? (
            <div style={s.paxLineLabel}>Chargement…</div>
          ) : bags.length === 0 ? (
            <div style={s.paxLineLabel}>Aucun bagage déclaré sur le boarding pass.</div>
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
                  ? `Débarquer le bagage ${confirm.bag.tag_number} de la soute ?`
                  : `Annuler le bagage ${confirm.bag.tag_number} ?`
                : `Débarquer ${p.full_name} ?`}
            </h3>
            <div style={{ color: 'var(--content-secondary)', fontSize: 13 }}>
              {confirm.kind === 'bag'
                ? confirm.bag.in_hold
                  ? 'Ce bagage est déjà en soute : il devra être physiquement retiré (bandeau « à retirer » sur le vol).'
                  : 'Le bagage sera refusé à tous les scans. Action tracée dans le journal.'
                : 'Tous ses bagages seront annulés, son boarding pass sera refusé à la porte. Action tracée dans le journal.'}
            </div>
            <input
              style={s.input}
              placeholder="Motif (no-show, refus d'embarquement, bagage refusé au rayon X…)"
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
                  ? 'En cours…'
                  : confirm.kind === 'bag'
                    ? confirm.bag.in_hold
                      ? 'Débarquer ce bagage'
                      : 'Annuler ce bagage'
                    : 'Débarquer le passager'}
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
              Débarquer le passager
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** Une étiquette et son parcours réel, étape par étape. */
function BaggageDetailRow({ b, isMobile, onCancel }: { b: Baggage; isMobile: boolean; onCancel?: () => void }) {
  const steps: string[] = [];
  if (b.is_confirmed) steps.push(`Au tapis ${formatTime(b.scanned_at)}`);
  if (b.on_dolly) steps.push(`Dolly ${formatTime(b.on_dolly_at)}`);
  if (b.soute) steps.push(`${SOUTE_LABEL[b.soute]} ${formatTime(b.soute_at)}`);
  if (b.in_hold) steps.push(`Chargé ${formatTime(b.in_hold_at)}`);
  if (b.rush) steps.push(`Rush ${formatTime(b.rush_at)}`);
  if (b.arrived) steps.push(`Arrivé ${formatTime(b.arrived_at)}`);

  return (
    // Le parcours d'un bagage tient sur une ligne en desktop (« Au tapis 08:43 ·
    // Dolly 09:02 · Soute avant 09:10 ») mais pas à côté d'un numéro à 10
    // chiffres sur un téléphone : on empile.
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
          {b.in_hold ? 'Débarqué' : 'Annulé'} {formatTime(b.cancelled_at)}
          {b.cancel_reason ? ` · ${b.cancel_reason}` : ''}
          {b.in_hold ? (b.pulled ? ` · retiré de la soute ${formatTime(b.pulled_at)}` : ' · à retirer de la soute') : ''}
        </span>
      ) : b.is_confirmed ? (
        <span style={s.paxLineValue}>{steps.join(' · ')}</span>
      ) : (
        // Le cas qui n'apparaît nulle part ailleurs : déclaré au comptoir, mais
        // jamais présenté au tapis. Ni le compteur ni les alertes ne le disent.
        <span style={{ ...s.paxLineValue, color: 'var(--warning-content)' }}>
          Déclaré au comptoir, jamais scanné au tapis
        </span>
      )}
      {onCancel ? (
        // Même mécanique (annulation tracée), deux libellés : un bagage déjà
        // chargé se « débarque » de la soute, un bagage pas encore parti
        // s'« annule ». C'est le vocabulaire du terrain, pas deux états.
        <button
          type="button"
          style={s.bagActionBtn}
          onClick={onCancel}
        >
          {b.in_hold ? 'Débarquer' : 'Annuler'}
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

// ─────────────────────────────────────────────────────────────
// Modale création de vol
// ─────────────────────────────────────────────────────────────

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
          <h2 style={{ ...sectionHeading, margin: 0 }}>Nouveau vol au départ de {hub}</h2>
          <button type="button" style={s.modalClose} onClick={onClose} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>

        <div style={s.field}>
          <label style={s.label}>Numéro de vol</label>
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
                {i > 0 ? <span style={{ color: 'var(--content-secondary)' }}> → </span> : null}
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
            <label style={s.label}>Heure de départ</label>
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
            {busy ? 'Création…' : 'Créer le vol'}
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
  // Titre de page et numéro de vol : Figtree 700, même dessin que les héros
  // du portail public, en 28 px.
  pageTitle: { margin: 0, fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--content-primary)' },
  pageSub: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 4 },

  // Jauges : trois par rangée sur un écran de bureau, une sur téléphone.
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
  // Bandeau d'alerte : aplat rouge pâle, rayon 8, texte à l'encre ; seule la
  // pastille porte le rouge plein.
  alert: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--negative-bg)', color: 'var(--content-primary)', border: 'none', borderRadius: 8, padding: 14 },
  alertTag: { display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--interactive-control)', background: 'var(--negative)', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 },
  // Alerte levée : la pastille passe en gris, le libellé suffit.
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
  // Libellé de méta (« Siège », « PNR ») : l'eyebrow, ramené à 11 px pour
  // tenir à quatre par ligne sur un écran de 320 px.
  paxMetaLabel: { ...eyebrow, margin: 0, fontSize: 11 },
  paxMetaValue: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'transparent' },
  th: { textAlign: 'left', padding: 14, color: 'var(--content-tertiary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--divider)' },
  td: { padding: 14, color: 'var(--content-primary)', borderBottom: '1px solid var(--divider)' },
  tdEmpty: { padding: '32px 14px', textAlign: 'center', color: 'var(--content-secondary)' },

  // Pas de soulignement ni de couleur d'accent : sur une centaine de lignes ça
  // ferait un mur de liens. Le survol de ligne (globals.css) et le curseur
  // suffisent à indiquer que c'est cliquable.
  paxNameBtn: { background: 'transparent', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: 'inherit', cursor: 'pointer', textAlign: 'left' },

  overlay: { ...modalOverlay },
  modal: { ...modalPanel, width: 460, maxWidth: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto' },
  paxModal: { ...modalPanel, width: 560, maxWidth: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '90vh', overflowY: 'auto' },
  // Téléphone : la fiche prend toute la largeur disponible et respire moins.
  // Sur un écran de 320 px, 24 px de marge de chaque côté mangeaient un sixième
  // de la ligne.
  paxModalMobile: { width: '100%', padding: 16, gap: 16, maxHeight: '92vh' },
  paxModalSub: { color: 'var(--content-secondary)', fontSize: 13, marginTop: 4 },
  paxSection: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--divider)', paddingTop: 16 },
  paxSectionTitle: { ...eyebrow, margin: 0 },
  // Question de confirmation : une vraie phrase, pas un eyebrow en capitales.
  confirmTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--negative)' },
  // Lien d'action d'une ligne de bagage (« Annuler », « Débarquer »).
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
  // Cible tactile : 40 px de côté, sinon la croix est presque impossible à
  // toucher au pouce sur un téléphone.
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
