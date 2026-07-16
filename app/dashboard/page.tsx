'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Flight, FraudAlert } from '@police/shared';
import { formatRoute } from '@police/shared';
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

const today = () => new Date().toISOString().slice(0, 10);

function formatTime(ts: string | null): string {
  if (!ts) return '—';
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
  const airportCode = profile?.airport_code ?? 'FIH';
  const [flights, setFlights] = useState<Flight[]>([]);
  const [alertsByFlight, setAlertsByFlight] = useState<Record<string, number>>({});
  const [recentAlerts, setRecentAlerts] = useState<FraudAlert[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function loadFlights() {
    const supabase = createClient();
    const { data: fl } = await supabase
      .from('flights')
      .select('*')
      .eq('date', today())
      .or(`origin.eq.${airportCode},destination.eq.${airportCode}`)
      .order('departure_time', { ascending: true });
    const list = (fl as Flight[] | null) ?? [];
    setFlights(list);

    const ids = list.map((f) => f.id);
    if (ids.length > 0) {
      const { data: al } = await supabase
        .from('fraud_alerts')
        .select('*')
        .in('flight_id', ids)
        .order('created_at', { ascending: false });
      const alerts = (al as FraudAlert[] | null) ?? [];
      const map: Record<string, number> = {};
      for (const a of alerts) map[a.flight_id] = (map[a.flight_id] ?? 0) + 1;
      setAlertsByFlight(map);
      setRecentAlerts(alerts.slice(0, 5));
    } else {
      setAlertsByFlight({});
      setRecentAlerts([]);
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
          recentAlerts={recentAlerts}
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
  recentAlerts,
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
  recentAlerts: FraudAlert[];
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

      {recentAlerts.length > 0 ? (
        <div style={s.alertBanner}>
          <div style={s.alertBannerHead}>
            <IconAlert size={18} />
            <strong>{totalAlerts} bagage{totalAlerts > 1 ? 's' : ''} écarté{totalAlerts > 1 ? 's' : ''}</strong>
          </div>
          <div style={s.alertBannerList}>
            {recentAlerts.map((a) => {
              const fl = flights.find((f) => f.id === a.flight_id);
              return (
                <button key={a.id} style={s.alertBannerItem} onClick={() => onSelect(a.flight_id)}>
                  <span style={{ fontWeight: 600 }}>{a.passenger_name ?? 'Passager inconnu'}</span>
                  <span style={{ color: 'var(--content-secondary)' }}>{a.reason}</span>
                  <span style={s.alertBannerFlight}>{fl?.flight_number ?? '—'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

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
  const { passengers, alerts, baggageDeclared, baggageConfirmed, baggageInHold, baggageRush, boardedCount } = useFlightData(flight.id);

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
        <Stat label="Rush (réacheminés)" value={String(baggageRush)} icon={<IconBag size={20} />} danger={baggageRush > 0} />
        <Stat label="Bagages écartés" value={String(alerts.length)} icon={<IconAlert size={20} />} danger={alerts.length > 0} />
      </div>

      {alerts.length > 0 ? <FraudAlerts alerts={alerts} /> : null}

      <h2 style={sectionHeading}>Passagers</h2>
      {isMobile ? (
        // Mobile : cartes empilées (un tableau à 7 colonnes serait illisible).
        passengers.length === 0 ? (
          <div style={s.tdEmpty}>Aucun passager scanné pour le moment.</div>
        ) : (
          <div style={s.paxCardList}>
            {passengers.map((p) => (
              <PassengerCardMobile key={p.id} p={p} fallbackRoute={formatRoute(flight, '→')} />
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
                passengers.map((p) => <PassengerRowView key={p.id} p={p} fallbackRoute={formatRoute(flight, '→')} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PassengerCardMobile({ p, fallbackRoute }: { p: PassengerRow; fallbackRoute: string }) {
  const complete = p.declared_baggage_count > 0 && p.confirmedCount >= p.declared_baggage_count;
  const bagColor = p.declared_baggage_count === 0 ? 'var(--content-secondary)' : complete ? 'var(--positive)' : 'var(--warning-content)';
  return (
    <div style={s.paxCard}>
      <div style={s.paxCardHead}>
        <span style={s.paxCardName}>{p.full_name}</span>
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
        <PaxMeta label="Siège" value={p.seat ?? '—'} />
        <PaxMeta label="Classe" value={p.class ?? '—'} />
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

function PassengerRowView({ p, fallbackRoute }: { p: PassengerRow; fallbackRoute: string }) {
  const complete = p.declared_baggage_count > 0 && p.confirmedCount >= p.declared_baggage_count;
  const color = p.declared_baggage_count === 0 ? 'var(--content-secondary)' : complete ? 'var(--positive)' : 'var(--warning-content)';
  return (
    <tr>
      <td style={s.td}>{p.full_name}</td>
      <td style={s.td}>{p.seat ?? '—'}</td>
      <td style={s.td}>{p.class ?? '—'}</td>
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

function FraudAlerts({ alerts }: { alerts: FraudAlert[] }) {
  return (
    <div style={s.alertsBox}>
      {alerts.map((a) => (
        <div key={a.id} style={s.alert}>
          <span style={s.alertTag}>
            <IconAlert size={15} /> ÉCARTÉ
          </span>
          <div style={{ flex: 1 }}>
            <strong>{a.passenger_name ?? 'Passager inconnu'}</strong> · PNR {a.pnr ?? '—'} · Tag {a.tag_number ?? '—'}
            <div style={{ color: 'var(--content-secondary)' }}>
              {a.reason} {a.gate ? `· ${a.gate}` : ''} · {new Date(a.created_at).toLocaleString('fr-FR')}
            </div>
          </div>
        </div>
      ))}
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
    date: today(),
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
          <h2 style={{ margin: 0, fontSize: 20 }}>Nouveau vol — départ {hub}</h2>
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

  alertBanner: { background: 'var(--negative-bg)', border: 'none', borderRadius: 16, marginBottom: 24, padding: 18 },
  alertBannerHead: { display: 'flex', alignItems: 'center', gap: 8, color: 'var(--negative)', marginBottom: 12 },
  alertBannerList: { display: 'flex', flexDirection: 'column', gap: 6 },
  alertBannerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    textAlign: 'left',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-neutral)',
    borderRadius: 12,
    padding: '9px 14px',
    color: 'var(--content-primary)',
    fontSize: 14,
  },
  alertBannerFlight: { marginLeft: 'auto', fontWeight: 700, fontSize: 13 },

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

  overlay: { ...modalOverlay },
  modal: { ...modalPanel, width: 460, maxWidth: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto' },
  modalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalClose: { background: 'transparent', border: 'none', color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', padding: 4 },
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
