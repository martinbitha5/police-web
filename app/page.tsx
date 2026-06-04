'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Flight, FraudAlert } from '@police/shared';
import { formatRoute } from '@police/shared';
import { createClient } from '@/supabase/client';
import { useFlightData, type PassengerRow } from '@/useFlightData';
import { AppShell, useSession } from '@/components/AppShell';
import { card, btnPrimary, btnGhost, sectionHeading, badge } from '@/ui/theme';
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

const HUB = process.env.NEXT_PUBLIC_HUB ?? 'FIH';

const STATUS_LABEL: Record<Flight['status'], string> = {
  scheduled: 'Programmé',
  boarding: 'Embarquement',
  closed: 'Fermé',
  cancelled: 'Annulé',
};
const STATUS_COLOR: Record<Flight['status'], string> = {
  scheduled: 'var(--muted)',
  boarding: 'var(--success)',
  closed: 'var(--danger)',
  cancelled: '#f59e0b',
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
  const profile  = useSession();
  const isMobile = useIsMobile();
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
      .order('departure_time', { ascending: true });
    const list = (fl as Flight[] | null) ?? [];
    setFlights(list);

    const ids = list.map((f) => f.id);
    if (ids.length > 0) {
      const { data: al } = await supabase
        .from('fraud_alerts')
        .select('*')
        .eq('resolved', false)
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

  useEffect(() => {
    loadFlights();
  }, []);

  const departures = useMemo(() => flights.filter((f) => f.origin === HUB), [flights]);
  const arrivals = useMemo(() => flights.filter((f) => f.destination === HUB), [flights]);
  const selected = flights.find((f) => f.id === selectedId) ?? null;
  const canManage = profile?.role === 'admin' || profile?.role === 'supervisor';
  const totalAlerts = Object.values(alertsByFlight).reduce((a, b) => a + b, 0);

  return (
    <div style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      {selected ? (
        <FlightDetail flight={selected} onBack={() => setSelectedId(null)} canManage={canManage} onUpdated={loadFlights} isMobile={isMobile} />
      ) : (
        <Overview
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
        <Stat label="Vols du jour" value={String(flights.length)} icon={<IconPlane size={20} />} tint="#2563eb" />
        <Stat label="Départs" value={String(departures.length)} icon={<IconPlaneDepart size={20} />} tint="#0ea5e9" />
        <Stat label="Arrivées" value={String(arrivals.length)} icon={<IconPlaneArrive size={20} />} tint="#14b8a6" />
        <Stat
          label="Alertes ouvertes"
          value={String(totalAlerts)}
          icon={<IconAlert size={20} />}
          tint="#dc2626"
          danger={totalAlerts > 0}
        />
      </div>

      {recentAlerts.length > 0 ? (
        <div style={s.alertBanner}>
          <div style={s.alertBannerHead}>
            <IconAlert size={18} />
            <strong>{totalAlerts} alerte{totalAlerts > 1 ? 's' : ''} fraude non résolue{totalAlerts > 1 ? 's' : ''}</strong>
          </div>
          <div style={s.alertBannerList}>
            {recentAlerts.map((a) => {
              const fl = flights.find((f) => f.id === a.flight_id);
              return (
                <button key={a.id} style={s.alertBannerItem} onClick={() => onSelect(a.flight_id)}>
                  <span style={{ fontWeight: 600 }}>{a.passenger_name ?? 'Passager inconnu'}</span>
                  <span style={{ color: 'var(--muted)' }}>{a.reason}</span>
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
          <div style={{ color: 'var(--muted)', marginTop: 4 }}>
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
          <FlightSection title="Départs" icon={<IconPlaneDepart size={16} />} flights={departures} alerts={alerts} onSelect={onSelect} />
          <FlightSection title="Arrivées" icon={<IconPlaneArrive size={16} />} flights={arrivals} alerts={alerts} onSelect={onSelect} />
        </>
      )}
    </div>
  );
}

function FlightSection({
  title,
  icon,
  flights,
  alerts,
  onSelect,
}: {
  title: string;
  icon: React.ReactNode;
  flights: Flight[];
  alerts: Record<string, number>;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <h2 style={{ ...sectionHeading, display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
        {icon} {title} <span style={s.countPill}>{flights.length}</span>
      </h2>
      {flights.length === 0 ? (
        <div style={s.sectionEmpty}>Aucun vol</div>
      ) : (
        <div style={s.cardGrid}>
          {flights.map((f) => (
            <FlightCard key={f.id} flight={f} alertCount={alerts[f.id] ?? 0} onSelect={() => onSelect(f.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlightCard({ flight, alertCount, onSelect }: { flight: Flight; alertCount: number; onSelect: () => void }) {
  return (
    <button style={s.flightCard} onClick={onSelect}>
      <div style={s.flightCardTop}>
        <span style={s.flightCardNumber}>{flight.flight_number}</span>
        <StatusBadge status={flight.status} />
      </div>
      <div style={s.flightCardRoute}>{formatRoute(flight)}</div>
      <div style={s.flightCardFoot}>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          {flight.origin === HUB ? `Départ ${formatTime(flight.departure_time)}` : `Arrivée ${formatTime(flight.arrival_time)}`}
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
  flight,
  onBack,
  canManage,
  onUpdated,
  isMobile,
}: {
  flight: Flight;
  onBack: () => void;
  canManage: boolean;
  onUpdated: () => void;
  isMobile: boolean;
}) {
  const { passengers, alerts, baggageDeclared, baggageConfirmed, boardedCount } = useFlightData(flight.id);
  const unresolved = alerts.filter((a) => !a.resolved);

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
            {flight.origin === HUB ? `Départ ${formatTime(flight.departure_time)}` : `Arrivée ${formatTime(flight.arrival_time)}`} · {formatToday()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {canManage ? (
            <select style={s.statusSelect} value={flight.status} onChange={(e) => changeStatus(e.target.value as Flight['status'])}>
              <option value="scheduled">Programmé</option>
              <option value="boarding">Embarquement</option>
              <option value="closed">Fermé</option>
              <option value="cancelled">Annulé</option>
            </select>
          ) : null}
          <a href={`/api/report?flightId=${flight.id}`} style={btnGhost}>
            <IconDownload size={16} /> Rapport
          </a>
        </div>
      </div>

      <div style={isMobile ? { ...s.statGrid, gridTemplateColumns: 'repeat(2, 1fr)' } : s.statGrid}>
        <Stat label="Passagers" value={String(passengers.length)} icon={<IconUser size={20} />} tint="#2563eb" />
        <Stat label="Embarqués" value={`${boardedCount} / ${passengers.length}`} icon={<IconPlaneDepart size={20} />} tint="#22c55e" />
        <Stat label="Bagages confirmés" value={`${baggageConfirmed} / ${baggageDeclared}`} icon={<IconBag size={20} />} tint="#14b8a6" />
        <Stat label="Alertes fraude" value={String(unresolved.length)} icon={<IconAlert size={20} />} tint="#dc2626" danger={unresolved.length > 0} />
      </div>

      {unresolved.length > 0 ? <FraudAlerts alerts={unresolved} /> : null}

      <h2 style={sectionHeading}>Passagers</h2>
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
    </div>
  );
}

function PassengerRowView({ p, fallbackRoute }: { p: PassengerRow; fallbackRoute: string }) {
  const complete = p.declared_baggage_count > 0 && p.confirmedCount >= p.declared_baggage_count;
  const color = p.declared_baggage_count === 0 ? 'var(--muted)' : complete ? '#4ade80' : '#fbbf24';
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
          <span style={{ ...badge, color: '#4ade80', borderColor: '#4ade80' }}>
            <span style={{ ...s.statusDot, background: '#4ade80' }} />
            Embarqué
          </span>
        ) : (
          <span style={{ color: 'var(--muted)' }}>En attente</span>
        )}
      </td>
    </tr>
  );
}

function FraudAlerts({ alerts }: { alerts: FraudAlert[] }) {
  async function resolve(id: string) {
    await createClient().from('fraud_alerts').update({ resolved: true }).eq('id', id);
  }
  return (
    <div style={s.alertsBox}>
      {alerts.map((a) => (
        <div key={a.id} style={s.alert}>
          <div>
            <strong>{a.passenger_name ?? 'Passager inconnu'}</strong> · PNR {a.pnr ?? '—'} · Tag {a.tag_number ?? '—'}
            <div style={{ color: 'var(--muted)' }}>
              {a.reason} {a.gate ? `· ${a.gate}` : ''}
            </div>
          </div>
          <button style={s.resolveBtn} onClick={() => resolve(a.id)}>
            Marquer résolu
          </button>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: Flight['status'] }) {
  return (
    <span style={{ ...badge, color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status] }}>
      <span style={{ ...s.statusDot, background: STATUS_COLOR[status] }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function Stat({ label, value, icon, tint, danger }: { label: string; value: string; icon: React.ReactNode; tint: string; danger?: boolean }) {
  return (
    <div style={s.stat}>
      <div style={{ ...s.statIcon, background: `${tint}22`, color: tint }}>{icon}</div>
      <div>
        <div style={s.statLabel}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: danger ? 'var(--danger)' : 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modale création de vol
// ─────────────────────────────────────────────────────────────

type FlightDirection = 'departure' | 'arrival';

function FlightFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({
    direction: 'departure' as FlightDirection,
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

  const isDeparture = form.direction === 'departure';

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
  const routePreview = isDeparture ? [HUB, ...cleanStops, endAirport] : [endAirport, ...cleanStops, HUB];

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
    const ts = toTimestamp(form.time);
    const payload = {
      flight_number: form.flight_number.trim().toUpperCase(),
      origin: isDeparture ? HUB : other,
      destination: isDeparture ? other : HUB,
      stops,
      date: form.date,
      departure_time: isDeparture ? ts : null,
      arrival_time: isDeparture ? null : ts,
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
          <h2 style={{ margin: 0, fontSize: 20 }}>Nouveau vol du jour</h2>
          <button type="button" style={s.modalClose} onClick={onClose} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>

        <div style={s.field}>
          <label style={s.label}>Type de vol</label>
          <div style={s.toggle}>
            <button
              type="button"
              style={{ ...s.toggleBtn, ...(isDeparture ? s.toggleBtnActive : {}) }}
              onClick={() => set('direction', 'departure')}
            >
              Départ ({HUB} →)
            </button>
            <button
              type="button"
              style={{ ...s.toggleBtn, ...(!isDeparture ? s.toggleBtnActive : {}) }}
              onClick={() => set('direction', 'arrival')}
            >
              Arrivée (→ {HUB})
            </button>
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Numéro de vol</label>
          <input style={s.input} placeholder="ET0062" value={form.flight_number} onChange={(e) => set('flight_number', e.target.value)} required />
        </div>

        <div style={s.field}>
          <label style={s.label}>{isDeparture ? `Destination finale (depuis ${HUB})` : `Provenance (vers ${HUB})`}</label>
          <input style={s.input} placeholder="FBM" value={form.other_airport} onChange={(e) => set('other_airport', e.target.value)} required />
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
                {i > 0 ? <span style={{ color: 'var(--muted)' }}> → </span> : null}
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
            <label style={s.label}>{isDeparture ? 'Heure de départ' : "Heure d'arrivée"}</label>
            <input style={s.input} type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Statut</label>
          <select style={s.input} value={form.status} onChange={(e) => set('status', e.target.value as Flight['status'])}>
            <option value="scheduled">Programmé</option>
            <option value="boarding">Embarquement</option>
            <option value="closed">Fermé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>

        {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}

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
  pageTitle: { margin: 0, fontSize: 28, fontWeight: 800, textShadow: '0 2px 10px rgba(0,0,0,0.65)' },
  pageSub: { color: '#cbd5e1', fontSize: 14, marginTop: 4, textShadow: '0 1px 6px rgba(0,0,0,0.6)' },

  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 24 },
  stat: { ...card, display: 'flex', alignItems: 'center', gap: 14, padding: 18 },
  statIcon: { width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0 },
  statLabel: { color: 'var(--muted)', fontSize: 13, marginBottom: 4 },

  alertBanner: { ...card, borderColor: 'rgba(220,38,38,0.45)', background: 'rgba(220,38,38,0.10)', marginBottom: 24, padding: 18 },
  alertBannerHead: { display: 'flex', alignItems: 'center', gap: 8, color: '#fca5a5', marginBottom: 12 },
  alertBannerList: { display: 'flex', flexDirection: 'column', gap: 6 },
  alertBannerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    textAlign: 'left',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--glass-border)',
    borderRadius: 10,
    padding: '9px 12px',
    color: 'var(--text)',
    fontSize: 14,
  },
  alertBannerFlight: { marginLeft: 'auto', fontWeight: 700, fontSize: 13 },

  countPill: { background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 9px', fontSize: 12, fontWeight: 700, color: 'var(--muted)' },
  sectionEmpty: { color: '#cbd5e1', fontSize: 14, fontStyle: 'italic', marginBottom: 18, textShadow: '0 1px 6px rgba(0,0,0,0.6)' },

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
  flightCardNumber: { fontWeight: 800, fontSize: 18 },
  flightCardRoute: { fontSize: 15 },
  flightCardFoot: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  alertPill: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--danger)', color: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: 12, fontWeight: 600 },

  emptyCard: { ...card, border: '1px dashed var(--glass-border)', padding: '44px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text)' },

  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },

  backBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: 'var(--primary)', padding: 0, marginBottom: 16, fontSize: 14, fontWeight: 600 },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 16, flexWrap: 'wrap' },
  detailHeaderMobile: { flexDirection: 'column', gap: 12, marginBottom: 14 },
  detailRoute: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  routeChip: { background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '4px 10px', fontSize: 14 },
  statusSelect: { background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', color: 'var(--text)', borderRadius: 10, padding: '9px 12px', colorScheme: 'dark' },

  alertsBox: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 },
  alert: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'rgba(220, 38, 38, 0.12)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--danger)', borderRadius: 12, padding: 14 },
  resolveBtn: { background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 600 },

  tableWrap: { ...card, padding: 0, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'transparent' },
  th: { textAlign: 'left', padding: 14, color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--glass-border)' },
  td: { padding: 14, borderBottom: '1px solid rgba(255,255,255,0.06)' },
  tdEmpty: { padding: '32px 14px', textAlign: 'center', color: 'var(--muted)' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 10, padding: 16 },
  modal: { width: 460, maxWidth: '100%', background: 'var(--glass-strong)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.45)' },
  modalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalClose: { background: 'transparent', border: 'none', color: 'var(--muted)', display: 'grid', placeItems: 'center', padding: 4 },
  row: { display: 'flex', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1 },
  label: { fontSize: 12, color: 'var(--muted)', fontWeight: 600 },
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 15, colorScheme: 'dark' },
  stopsHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addStopBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 },
  stopsHint: { color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' },
  stopRow: { display: 'flex', alignItems: 'center', gap: 8 },
  stopIndex: { width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--muted)', flexShrink: 0 },
  removeStopBtn: { background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--danger)', borderRadius: 8, padding: '8px 9px', flexShrink: 0, display: 'grid', placeItems: 'center' },
  routePreview: { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, marginTop: 2 },
  toggle: { display: 'flex', gap: 8 },
  toggleBtn: { flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text)', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600 },
  toggleBtnActive: { borderColor: 'var(--primary)', background: 'var(--primary)', color: '#fff' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
};
