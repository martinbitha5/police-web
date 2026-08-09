'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { flightScope, scopeFlightQuery } from '@/lib/scope';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Flight, FraudAlert, Baggage, PassengerLeg } from '@police/shared';
import { formatRoute, SOUTE_LABEL, todayAtAirport } from '@police/shared';
import { createClient } from '@/supabase/client';
import { useFlightData, type PassengerRow } from '@/useFlightData';
import { AppShell, useSession } from '@/components/AppShell';
import { card, btnPrimary, btnGhost, sectionHeading, badge, modalOverlay, modalPanel } from '@/ui/theme';
import {
  IconPlane,
  IconPlaneDepart,
  IconPlaneArrive,
  IconAlert,
  IconBag,
  IconUser,
  IconPlus,
  IconBack,
  IconDownload,
  IconClose,
} from '@/components/icons';

const STATUS_LABEL: Record<Flight['status'], string> = {
  scheduled: 'Programmé',
  boarding: 'Embarquement',
  closed: 'Porte fermée',
  cancelled: 'Annulé',
};
// Pastilles de statut — pilules sémantiques Wise (fond + texte).
const STATUS_STYLE: Record<Flight['status'], { bg: string; color: string }> = {
  scheduled: { bg: 'var(--bg-neutral)', color: 'var(--content-secondary)' },
  boarding: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  closed: { bg: 'var(--negative-bg)', color: 'var(--negative)' },
  cancelled: { bg: 'var(--warning-bg)', color: 'var(--warning-content)' },
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
      <Dashboard />
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function loadFlights() {
    const supabase = createClient();
    // Périmètre du profil : son aéroport ET sa compagnie. Sans le filtre
    // transporteur, un profil KQ voyait les vols ET du même aéroport.
    const { data: fl } = await scopeFlightQuery(
      supabase.from('flights').select('*').eq('date', todayAtAirport(airportCode)),
      scope,
    ).order('departure_time', { ascending: true });
    const list = (fl as Flight[] | null) ?? [];
    setFlights(list);

    const ids = list.map((f) => f.id);
    if (ids.length > 0) {
      // Seul le compteur par vol est affiché ici : on ne rapatrie que flight_id,
      // pas les lignes complètes. Sur un vol à forte fraude (des centaines
      // d'alertes), charger tout le détail — noms passagers et étiquettes
      // compris — pour n'afficher qu'un nombre serait inutile et coûteux.
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
    <div style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      {selected ? (
        <FlightDetail hub={airportCode} flight={selected} onBack={() => setSelectedId(null)} canManage={canManage} onUpdated={loadFlights} isMobile={isMobile} />
      ) : (
        <Overview
          hub={airportCode}
          flights={flights}
          departures={departures}
          arrivals={arrivals}
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
  totalAlerts: number;
  alerts: Record<string, number>;
  canManage: boolean;
  isMobile: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
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

      <div style={isMobile ? { ...s.statGrid, gridTemplateColumns: 'repeat(2, 1fr)' } : s.statGrid}>
        <Stat label="Vols du jour" value={String(flights.length)} icon={<IconPlane size={20} />} />
        <Stat label="Départs" value={String(departures.length)} icon={<IconPlaneDepart size={20} />} />
        <Stat label="Arrivées" value={String(arrivals.length)} icon={<IconPlaneArrive size={20} />} />
        <Stat
          label="Bagages écartés"
          value={String(totalAlerts)}
          icon={<IconAlert size={20} />}
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
            {canManage ? 'Crée un premier vol pour commencer le suivi.' : 'Aucun vol à afficher pour le moment.'}
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
          <FlightSection hub={hub} title="Arrivées" icon={<IconPlaneArrive size={16} />} flights={arrivals} alerts={alerts} onSelect={onSelect} />
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
  } = useFlightData(flight.id);

  // Une alerte résolue reste consultable mais ne pèse plus sur les compteurs.
  const activeAlerts = useMemo(() => alerts.filter((a) => !a.resolved), [alerts]);

  // Passager dont on affiche la fiche. Le tableau ne montre qu'un compteur
  // « 1/2 » : savoir QUEL bagage manque demande d'ouvrir le détail.
  const [detailPax, setDetailPax] = useState<PassengerRow | null>(null);

  async function changeStatus(status: Flight['status']) {
    await createClient().from('flights').update({ status }).eq('id', flight.id);
    onUpdated();
  }

  return (
    <div>
      <button style={s.backBtn} onClick={onBack}>
        <IconBack size={16} /> Tableau de bord
      </button>

      <div style={isMobile ? { ...s.detailHeader, ...s.detailHeaderMobile } : s.detailHeader}>
        <div>
          <div style={s.detailRoute}>
            <h1 style={{ margin: 0, fontSize: 28 }}>{flight.flight_number}</h1>
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
              <option value="scheduled">Programmé</option>
              <option value="boarding">Embarquement</option>
              <option value="closed">Porte fermée</option>
              <option value="cancelled">Annulé</option>
            </select>
          ) : null}
          <a href={`/api/report?flightId=${flight.id}`} style={btnGhost}>
            <IconDownload size={16} /> Rapport
          </a>
        </div>
      </div>

      <div style={isMobile ? { ...s.statGrid, gridTemplateColumns: 'repeat(2, 1fr)' } : s.statGrid}>
        <Stat label="Passagers" value={String(passengers.length)} icon={<IconUser size={20} />} />
        <Stat label="Embarqués" value={`${boardedCount} / ${passengers.length}`} icon={<IconPlaneDepart size={20} />} />
        <Stat label="Bagages confirmés" value={`${baggageConfirmed} / ${baggageDeclared}`} icon={<IconBag size={20} />} />
        <Stat label="Chargés en soute" value={`${baggageInHold} / ${baggageConfirmed}`} icon={<IconBag size={20} />} />
        {/* Réception à destination. En alerte seulement une fois le déchargement
            commencé : avant ça, 0 sur N est normal, pas un manquant. */}
        <Stat
          label="Arrivés à destination"
          value={`${baggageArrived} / ${baggageExpected}`}
          icon={<IconPlaneArrive size={20} />}
          danger={baggageArrived > 0 && baggageArrived < baggageExpected}
        />
        <Stat label="Rush (réacheminés)" value={String(baggageRush)} icon={<IconBag size={20} />} danger={baggageRush > 0} />
        {/* Les alertes levées (check-in scanné après le bagage) ne comptent plus
            comme des écartés : sinon une inversion d'ordre de scan gonfle le
            compteur de fraude et noie les vrais rejets. */}
        <Stat
          label="Bagages écartés"
          value={String(activeAlerts.length)}
          icon={<IconAlert size={20} />}
          danger={activeAlerts.length > 0}
        />
      </div>

      {alerts.length > 0 ? <FraudAlerts alerts={alerts} active={activeAlerts} /> : null}

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
    <div style={{ ...s.paxCard, cursor: 'pointer' }} onClick={onOpen}>
      <div style={s.paxCardHead}>
        <button type="button" style={{ ...s.paxNameBtn, ...s.paxCardName }} onClick={onOpen}>
          {p.full_name}
        </button>
        {p.boarded ? (
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
    <tr style={{ cursor: 'pointer' }} onClick={onOpen}>
      <td style={s.td}>
        <button type="button" style={s.paxNameBtn} onClick={(e) => { e.stopPropagation(); onOpen(); }}>
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
        {p.boarded ? (
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

function FraudAlerts({ alerts, active }: { alerts: FraudAlert[]; active: FraudAlert[] }) {
  // Repliée par défaut : une vingtaine de rejets empilés remplissaient l'écran
  // et repoussaient la liste des passagers hors de vue. Le détail reste à un
  // clic — sur un système anti-fraude, on ne masque pas un rejet sans recours.
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
          <IconAlert size={15} /> ÉCARTÉ +{active.length}
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
      <span style={a.resolved ? { ...s.alertTag, background: 'var(--content-secondary)' } : s.alertTag}>
        <IconAlert size={15} /> {a.resolved ? 'LEVÉ' : 'ÉCARTÉ'}
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
  onClose,
}: {
  p: PassengerRow;
  fallbackRoute: string;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [legs, setLegs] = useState<PassengerLeg[]>([]);
  const [bags, setBags] = useState<Baggage[]>([]);
  const [agents, setAgents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [{ data: legRows }, { data: bagRows }] = await Promise.all([
        supabase.from('passenger_legs').select('*').eq('passenger_id', p.id).order('leg_order'),
        supabase.from('baggage').select('*').eq('passenger_id', p.id).order('tag_number'),
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
  }, [p.id, p.scanned_by, p.boarded_by]);

  const route = legs.length > 0 ? null : (p.route ?? fallbackRoute);
  const confirmed = bags.filter((b) => b.is_confirmed).length;

  function agentName(id: string | null): string {
    if (!id) return 'agent inconnu';
    return agents[id] ?? 'agent inconnu';
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div
        style={isMobile ? { ...s.paxModal, ...s.paxModalMobile } : s.paxModal}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={s.modalHead}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 20, letterSpacing: '-0.03em', overflowWrap: 'anywhere' }}>
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
            Bagages · {confirmed} au tapis sur {p.declared_baggage_count} déclaré
            {p.declared_baggage_count > 1 ? 's' : ''}
          </h3>
          {loading ? (
            <div style={s.paxLineLabel}>Chargement…</div>
          ) : bags.length === 0 ? (
            <div style={s.paxLineLabel}>Aucun bagage déclaré sur le boarding pass.</div>
          ) : (
            bags.map((b) => <BaggageDetailRow key={b.id} b={b} isMobile={isMobile} />)
          )}
        </section>
      </div>
    </div>
  );
}

/** Une étiquette et son parcours réel, étape par étape. */
function BaggageDetailRow({ b, isMobile }: { b: Baggage; isMobile: boolean }) {
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
      <span style={isMobile ? s.paxBagTagMobile : s.paxBagTag}>{b.tag_number}</span>
      {b.is_confirmed ? (
        <span style={s.paxLineValue}>{steps.join(' · ')}</span>
      ) : (
        // Le cas qui n'apparaît nulle part ailleurs : déclaré au comptoir, mais
        // jamais présenté au tapis. Ni le compteur ni les alertes ne le disent.
        <span style={{ ...s.paxLineValue, color: 'var(--warning-content)' }}>
          Déclaré au comptoir, jamais scanné au tapis
        </span>
      )}
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

function Stat({ label, value, icon, danger }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div style={s.stat}>
      <div style={s.statIcon}>{icon}</div>
      <div>
        <div style={s.statLabel}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: danger ? 'var(--negative)' : 'var(--content-primary)', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
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
          <h2 style={{ margin: 0, fontSize: 20 }}>Nouveau vol au départ de {hub}</h2>
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
            <div style={s.stopsHint}>Vol direct. Ajoute une escale pour un vol avec transit.</div>
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
            <option value="scheduled">Programmé</option>
            <option value="boarding">Embarquement</option>
            <option value="closed">Porte fermée</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>

        {error ? <p style={{ color: 'var(--negative)', margin: 0 }}>{error}</p> : null}

        <div style={s.modalActions}>
          <button type="button" style={btnGhost} onClick={onClose}>
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
  pageTitle: { margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--content-primary)' },
  pageSub: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 4 },

  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 24 },
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
  flightCardNumber: { fontWeight: 700, fontSize: 18, letterSpacing: '-0.03em' },
  flightCardRoute: { fontSize: 15 },
  flightCardFoot: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  alertPill: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--negative-bg)', color: 'var(--negative)', borderRadius: 9999, padding: '2px 10px', fontSize: 12, fontWeight: 600 },

  emptyCard: { ...card, borderStyle: 'dashed', padding: '44px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--content-primary)' },

  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },

  backBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--content-link)', padding: 0, marginBottom: 16, fontSize: 14, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '0.3em' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 16, flexWrap: 'wrap' },
  detailHeaderMobile: { flexDirection: 'column', gap: 12, marginBottom: 14 },
  detailRoute: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  routeChip: { background: 'var(--bg-neutral)', border: 'none', borderRadius: 9999, padding: '4px 14px', fontSize: 14, color: 'var(--content-primary)' },
  statusSelect: { background: 'var(--bg-elevated)', border: '1px solid var(--border-neutral)', color: 'var(--content-primary)', borderRadius: 10, padding: '9px 12px' },

  alertsBox: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 },
  alert: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--negative-bg)', border: 'none', borderRadius: 16, padding: 14 },
  alertTag: { display: 'inline-flex', alignItems: 'center', gap: 5, color: '#fff', background: 'var(--negative)', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, whiteSpace: 'nowrap', flexShrink: 0 },
  alertSummary: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'var(--negative-bg)', border: 'none', borderRadius: 16, padding: 14, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' },
  alertSummaryText: { flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  alertSummaryAction: { color: 'var(--negative)', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 },

  tableWrap: { ...card, padding: 0, overflowX: 'auto' },

  paxCardList: { display: 'flex', flexDirection: 'column', gap: 10 },
  paxCard: { ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  paxCardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  paxCardName: { fontWeight: 600, fontSize: 15, letterSpacing: '-0.03em' },
  paxCardRoute: { color: 'var(--content-secondary)', fontSize: 13, fontWeight: 600 },
  paxCardMeta: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  paxMeta: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  paxMetaLabel: { color: 'var(--content-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 },
  paxMetaValue: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'transparent' },
  th: { textAlign: 'left', padding: 14, color: 'var(--content-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border-neutral)' },
  td: { padding: 14, color: 'var(--content-primary)', borderBottom: '1px solid var(--border-neutral)' },
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
  paxModalMobile: { width: '100%', padding: 16, gap: 16, maxHeight: '92vh', borderRadius: 18 },
  paxModalSub: { color: 'var(--content-secondary)', fontSize: 13, marginTop: 4 },
  paxSection: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-neutral)', paddingTop: 16 },
  paxSectionTitle: { margin: 0, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--content-secondary)', fontWeight: 600 },
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
  label: { fontSize: 12, color: 'var(--content-secondary)', fontWeight: 600 },
  input: { background: 'var(--bg-elevated)', border: '1px solid var(--border-neutral)', borderRadius: 10, padding: '10px 12px', color: 'var(--content-primary)', fontSize: 14 },
  stopsHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addStopBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--interactive-primary)', color: 'var(--interactive-primary)', borderRadius: 9999, padding: '4px 12px', fontSize: 12, fontWeight: 600 },
  stopsHint: { color: 'var(--content-secondary)', fontSize: 13, fontStyle: 'italic' },
  stopRow: { display: 'flex', alignItems: 'center', gap: 8 },
  stopIndex: { width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-neutral)', border: 'none', display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--content-secondary)', flexShrink: 0 },
  removeStopBtn: { background: 'transparent', border: '1px solid var(--border-neutral)', color: 'var(--negative)', borderRadius: 9999, padding: '8px 9px', flexShrink: 0, display: 'grid', placeItems: 'center' },
  routePreview: { background: 'var(--bg-neutral)', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 14, marginTop: 2 },
  toggle: { display: 'flex', gap: 8 },
  toggleBtn: { flex: 1, background: 'var(--bg-neutral)', border: 'none', color: 'var(--content-primary)', borderRadius: 9999, padding: '10px', fontSize: 13, fontWeight: 600 },
  toggleBtnActive: { background: 'var(--interactive-primary)', color: '#fff' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
};
