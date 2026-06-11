'use client';

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Flight, Baggage, Passenger, SoutePosition } from '@police/shared';
import { SOUTE_LABEL } from '@police/shared';
import { createClient } from '@/supabase/client';
import { AppShell, useSession } from '@/components/AppShell';
import { card, badge } from '@/ui/theme';
import { IconBag, IconClose, IconPlane } from '@/components/icons';

const today = () => new Date().toISOString().slice(0, 10);

function formatTime(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface BagRow extends Baggage {
  passengerName: string;
  pnr: string;
  declaredCount: number;
}

export default function BagagesPage() {
  return (
    <AppShell>
      <BagagesContent />
    </AppShell>
  );
}

function BagagesContent() {
  const profile = useSession();
  const airportCode = profile?.airport_code ?? 'FIH';

  const [flights, setFlights] = useState<Flight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bags, setBags] = useState<BagRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<BagRow | null>(null);

  // Charge les vols du jour
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('flights')
        .select('*')
        .eq('date', today())
        .or(`origin.eq.${airportCode},destination.eq.${airportCode}`)
        .order('departure_time', { ascending: true });
      const list = (data as Flight[] | null) ?? [];
      setFlights(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airportCode]);

  // Charge les bagages du vol sélectionné
  const loadBags = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    const supabase = createClient();

    const [{ data: bagData }, { data: paxData }] = await Promise.all([
      supabase.from('baggage').select('*').eq('flight_id', selectedId).order('scanned_at', { ascending: false }),
      supabase.from('passengers').select('id, full_name, pnr, declared_baggage_count').eq('flight_id', selectedId),
    ]);

    const paxById = new Map(
      ((paxData as Pick<Passenger, 'id' | 'full_name' | 'pnr' | 'declared_baggage_count'>[] | null) ?? []).map(
        (p) => [p.id, p],
      ),
    );

    const rows: BagRow[] = ((bagData as Baggage[] | null) ?? []).map((b) => {
      const pax = paxById.get(b.passenger_id);
      return {
        ...b,
        passengerName: pax?.full_name ?? '—',
        pnr: pax?.pnr ?? '—',
        declaredCount: pax?.declared_baggage_count ?? 0,
      };
    });

    setBags(rows);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    loadBags();
  }, [loadBags]);

  const flight = flights.find((f) => f.id === selectedId);

  // Compteurs soute
  const avantCount = bags.filter((b) => b.soute === 'avant').length;
  const arriereCount = bags.filter((b) => b.soute === 'arriere').length;
  const nonScanneCount = bags.filter((b) => !b.soute && b.is_confirmed).length;

  return (
    <div style={s.page}>
      {/* En-tête */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconBag size={22} />
          <h1 style={s.title}>Bagages</h1>
        </div>

        {/* Sélecteur de vol */}
        <select
          style={s.select}
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.target.value || null)}
        >
          {flights.length === 0 && <option value="">Aucun vol aujourd'hui</option>}
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flight_number} — {f.origin} → {f.destination} {formatTime(f.departure_time)}
            </option>
          ))}
        </select>
      </div>

      {/* Cartes compteurs soute */}
      {selectedId && (
        <div style={s.counters}>
          <CounterCard label="Soute avant" value={avantCount} color="var(--primary)" />
          <CounterCard label="Soute arrière" value={arriereCount} color="#0891b2" />
          <CounterCard label="Non scannés" value={nonScanneCount} color="var(--muted)" />
          <CounterCard label="Total bagages" value={bags.length} color="var(--text)" />
        </div>
      )}

      {/* Table */}
      {selectedId && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={s.empty}>Chargement…</div>
          ) : bags.length === 0 ? (
            <div style={s.empty}>Aucun bagage enregistré pour ce vol.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <Th>Étiquette</Th>
                    <Th>Passager</Th>
                    <Th>PNR</Th>
                    <Th>Soute</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {bags.map((b) => (
                    <tr
                      key={b.id}
                      style={s.tr}
                      onClick={() => setDetail(b)}
                    >
                      <Td mono>{b.tag_number}</Td>
                      <Td>{b.passengerName}</Td>
                      <Td mono>{b.pnr}</Td>
                      <Td>
                        <SouteBadge soute={b.soute} />
                      </Td>
                      <Td>
                        <StatusBadge bag={b} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal détail */}
      {detail && (
        <DetailModal
          bag={detail}
          flight={flight ?? null}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ── Sous-composants ──────────────────────────────────────────────

function CounterCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 120, padding: '14px 18px' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function SouteBadge({ soute }: { soute: SoutePosition | null }) {
  if (!soute) return <span style={{ color: 'var(--muted)', fontSize: 13 }}>—</span>;
  const color = soute === 'avant' ? 'var(--primary)' : '#0891b2';
  return (
    <span style={{ ...badge, borderColor: color, color, background: `${soute === 'avant' ? '#2563eb' : '#0891b2'}18`, fontSize: 12 }}>
      {SOUTE_LABEL[soute]}
    </span>
  );
}

function StatusBadge({ bag }: { bag: Baggage }) {
  if (bag.rush) return <span style={{ ...badge, borderColor: '#d97706', color: '#d97706', background: '#fef3c718', fontSize: 12 }}>Rush</span>;
  if (bag.in_hold) return <span style={{ ...badge, borderColor: 'var(--success)', color: 'var(--success)', background: '#dcfce718', fontSize: 12 }}>Chargé</span>;
  if (bag.is_confirmed) return <span style={{ ...badge, borderColor: 'var(--muted)', color: 'var(--text)', background: 'rgba(255,255,255,0.06)', fontSize: 12 }}>Enregistré</span>;
  return <span style={{ ...badge, borderColor: 'var(--border)', color: 'var(--muted)', fontSize: 12 }}>En attente</span>;
}

function DetailModal({ bag, flight, onClose }: { bag: BagRow; flight: Flight | null; onClose: () => void }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* En-tête modal */}
        <div style={s.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBag size={20} />
            <span style={{ fontWeight: 800, fontSize: 17 }}>Détail bagage</span>
          </div>
          <button style={s.closeBtn} onClick={onClose}><IconClose size={18} /></button>
        </div>

        {/* Contenu */}
        <div style={s.modalBody}>
          {/* Tag + soute en vedette */}
          <div style={s.tagHero}>
            <span style={s.tagNumber}>{bag.tag_number}</span>
            <SouteBadge soute={bag.soute} />
          </div>

          {/* Vol */}
          {flight && (
            <Row label="Vol">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                <IconPlane size={14} />
                {flight.flight_number} — {flight.origin} → {flight.destination}
              </span>
            </Row>
          )}

          <Row label="Passager"><span style={{ fontWeight: 700 }}>{bag.passengerName}</span></Row>
          <Row label="PNR"><span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{bag.pnr}</span></Row>

          <div style={s.divider} />

          {/* Compartiment soute */}
          <Row label="Compartiment soute">
            {bag.soute ? (
              <SouteBadge soute={bag.soute} />
            ) : (
              <span style={{ color: 'var(--muted)' }}>Non scanné en soute</span>
            )}
          </Row>
          {bag.soute_at && <Row label="Scanné en soute">{formatDateTime(bag.soute_at)}</Row>}

          <div style={s.divider} />

          {/* Statuts */}
          <Row label="Statut"><StatusBadge bag={bag} /></Row>
          <Row label="Enregistré">{formatDateTime(bag.scanned_at)}</Row>
          {bag.in_hold && <Row label="Chargé">{formatDateTime(bag.in_hold_at)}</Row>}
          {bag.rush && <Row label="Rush">{formatDateTime(bag.rush_at)}</Row>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{children}</span>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={s.th}>{children}</th>;
}

function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td style={{ ...s.td, ...(mono ? { fontFamily: 'monospace', fontSize: 13 } : {}) }}>{children}</td>;
}

// ── Styles ───────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  page: { padding: '28px 28px 40px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 },
  header: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' },
  title: { margin: 0, fontSize: 22, fontWeight: 800 },
  select: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid var(--glass-border)',
    borderRadius: 10,
    padding: '9px 13px',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    minWidth: 280,
    colorScheme: 'dark',
  },
  counters: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    color: 'var(--muted)',
    borderBottom: '1px solid var(--glass-border)',
  },
  td: {
    padding: '13px 16px',
    fontSize: 14,
    color: 'var(--text)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    verticalAlign: 'middle' as const,
  },
  tr: { cursor: 'pointer', transition: 'background 0.15s' },
  empty: { padding: 32, textAlign: 'center' as const, color: 'var(--muted)' },

  // Modal
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: '#1e293b',
    border: '1px solid var(--glass-border)',
    borderRadius: 20,
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--glass-border)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--muted)',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
  },
  modalBody: { padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  tagHero: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  tagNumber: { fontFamily: 'monospace', fontSize: 22, fontWeight: 800, letterSpacing: 1 },
  divider: { height: 1, background: 'var(--glass-border)', margin: '2px 0' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 13, color: 'var(--muted)', fontWeight: 600, flexShrink: 0 },
  rowValue: { fontSize: 14, color: 'var(--text)', textAlign: 'right' as const },
};

