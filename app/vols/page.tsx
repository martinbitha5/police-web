'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { FlightStatus } from '@police/shared';
import { FLIGHT_STATUS_LABEL, formatRoute, todayAtAirport } from '@police/shared';
import { createClient } from '@/supabase/client';
import { AppShell, useSession } from '@/components/AppShell';
import { flightScope } from '@/lib/scope';
import { loadFlightStats, sumFlightStats, type FlightStatsRow } from '@/lib/flight-stats';
import { PERIOD_LABEL, PERIOD_ORDER, rangeLabel, resolveRange, type Period } from '@/lib/period';
import { useIsMobile } from '@/hooks/useIsMobile';
import { badge, modalOverlay, modalPanel } from '@/ui/theme';
import { IconPlane, IconUser, IconBag, IconAlert, IconTrash, IconClose } from '@/components/icons';

const STATUS_STYLE: Record<FlightStatus, { bg: string; color: string }> = {
  scheduled: { bg: 'var(--bg-neutral)', color: 'var(--content-secondary)' },
  boarding: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  closed: { bg: 'var(--negative-bg)', color: 'var(--negative)' },
  cancelled: { bg: 'var(--warning-bg)', color: 'var(--warning-content)' },
};

function hhmm(ts: string | null): string {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function shortDate(s: string): string {
  return new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function VolsPage() {
  return (
    <AppShell>
      <FlightsView />
    </AppShell>
  );
}

function FlightsView() {
  const profile = useSession();
  const scope = flightScope(profile);
  const isMobile = useIsMobile();
  const canManage = profile?.role === 'admin' || profile?.role === 'supervisor';

  const [period, setPeriod] = useState<Period>('jour');
  // Journée d'exploitation de l'aéroport du profil, pas celle de l'appareil.
  const today = todayAtAirport(scope.airport);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [rows, setRows] = useState<FlightStatsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<FlightStatsRow | null>(null);

  const { from, to } = resolveRange(period, customFrom, customTo, today);

  const load = useCallback(
    async (rg: { from: string; to: string }) => {
      setLoading(true);
      setError(null);
      try {
        setRows(await loadFlightStats(rg, scope));
      } catch {
        setError("Impossible de charger les vols. Réessayez dans un instant.");
        setRows([]);
      }
      setLoading(false);
    },
    [scope.airport, scope.airline],
  );

  useEffect(() => {
    void load({ from, to });
  }, [load, from, to]);

  async function changeStatus(id: string, status: FlightStatus) {
    // Optimiste : la liste peut compter des centaines de lignes, un rechargement
    // complet pour un changement de statut ferait sauter le scroll.
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error: err } = await createClient().from('flights').update({ status }).eq('id', id);
    if (err) {
      setError('Le statut n’a pas pu être enregistré.');
      void load({ from, to });
    }
  }

  // Totaux de la période, calculés sur les lignes déjà chargées.
  const total = sumFlightStats(rows);

  return (
    <div style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      <div style={s.head}>
        <h1 style={s.title}>Vols</h1>
        <div style={s.sub}>{rangeLabel(period, from, to)}</div>
      </div>

      <div style={s.tabs}>
        {PERIOD_ORDER.map((p) => (
          <button key={p} style={{ ...s.tab, ...(period === p ? s.tabActive : {}) }} onClick={() => setPeriod(p)}>
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {period === 'perso' ? (
        <div style={isMobile ? { ...s.customRow, flexDirection: 'column', alignItems: 'stretch' } : s.customRow}>
          <label style={s.customField}>
            <span style={s.customLabel}>Du</span>
            <input type="date" style={s.dateInput} value={customFrom} onChange={(e) => setCustomFrom(e.target.value || today)} />
          </label>
          <label style={s.customField}>
            <span style={s.customLabel}>Au</span>
            <input type="date" style={s.dateInput} value={customTo} onChange={(e) => setCustomTo(e.target.value || today)} />
          </label>
        </div>
      ) : null}

      {error ? <div style={s.error}>{error}</div> : null}

      <div style={s.grid}>
        <Stat label="Vols" value={rows.length} icon={<IconPlane size={20} />} loading={loading} isMobile={isMobile} />
        <Stat label="Passagers" value={total.pax} icon={<IconUser size={20} />} loading={loading} isMobile={isMobile} />
        <Stat label="Bagages au tapis" value={`${total.confirmed} / ${total.declared}`} icon={<IconBag size={20} />} loading={loading} isMobile={isMobile} />
        <Stat
          label="Bagages manquants"
          value={total.declared - total.confirmed}
          icon={<IconBag size={20} />}
          danger={total.declared - total.confirmed > 0}
          loading={loading}
          isMobile={isMobile}
        />
        <Stat label="Alertes ouvertes" value={total.alerts} icon={<IconAlert size={20} />} danger={total.alerts > 0} loading={loading} isMobile={isMobile} />
      </div>

      {loading ? (
        <div style={s.empty}>Chargement…</div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>Aucun vol sur cette période.</div>
      ) : isMobile ? (
        <div style={s.cardList}>
          {rows.map((r) => (
            <FlightCardMobile key={r.id} r={r} canManage={canManage} onStatus={changeStatus} onDelete={() => setToDelete(r)} />
          ))}
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Vol</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Route</th>
                <th style={s.th}>Départ</th>
                <th style={s.th}>Passagers</th>
                <th style={s.th}>Bagages</th>
                <th style={s.th}>Manquants</th>
                <th style={s.th}>Alertes</th>
                <th style={s.th}>Statut</th>
                {canManage ? <th style={s.th} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <FlightRow key={r.id} r={r} canManage={canManage} onStatus={changeStatus} onDelete={() => setToDelete(r)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toDelete ? (
        <DeleteFlightModal
          r={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={() => {
            setToDelete(null);
            void load({ from, to });
          }}
        />
      ) : null}
    </div>
  );
}

function FlightRow({
  r,
  canManage,
  onStatus,
  onDelete,
}: {
  r: FlightStatsRow;
  canManage: boolean;
  onStatus: (id: string, status: FlightStatus) => void;
  onDelete: () => void;
}) {
  const missing = r.bag_declared - r.bag_confirmed;
  return (
    <tr>
      <td style={{ ...s.td, fontWeight: 600 }}>{r.flight_number}</td>
      <td style={s.td}>{shortDate(r.date)}</td>
      <td style={s.td}>{formatRoute(r, '→')}</td>
      <td style={s.td}>{hhmm(r.departure_time)}</td>
      <td style={s.td}>
        {r.boarded_count} / {r.pax_count}
      </td>
      <td style={s.td}>
        {r.bag_confirmed} / {r.bag_declared}
      </td>
      <td style={{ ...s.td, color: missing > 0 ? 'var(--warning-content)' : 'var(--content-secondary)', fontWeight: missing > 0 ? 600 : 400 }}>
        {missing}
      </td>
      <td style={{ ...s.td, color: r.alerts_open > 0 ? 'var(--negative)' : 'var(--content-secondary)', fontWeight: r.alerts_open > 0 ? 600 : 400 }}>
        {r.alerts_open}
      </td>
      <td style={s.td}>
        {canManage ? (
          <select style={s.statusSelect} value={r.status} onChange={(e) => onStatus(r.id, e.target.value as FlightStatus)}>
            {(Object.keys(FLIGHT_STATUS_LABEL) as FlightStatus[]).map((st) => (
              <option key={st} value={st}>
                {FLIGHT_STATUS_LABEL[st]}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={r.status} />
        )}
      </td>
      {canManage ? (
        <td style={s.td}>
          <button type="button" style={s.deleteBtn} onClick={onDelete} aria-label={`Supprimer le vol ${r.flight_number}`}>
            <IconTrash size={15} />
          </button>
        </td>
      ) : null}
    </tr>
  );
}

function FlightCardMobile({
  r,
  canManage,
  onStatus,
  onDelete,
}: {
  r: FlightStatsRow;
  canManage: boolean;
  onStatus: (id: string, status: FlightStatus) => void;
  onDelete: () => void;
}) {
  const missing = r.bag_declared - r.bag_confirmed;
  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <div>
          <div style={s.cardTitle}>{r.flight_number}</div>
          <div style={s.cardSub}>
            {shortDate(r.date)} · {formatRoute(r, '→')} · {hhmm(r.departure_time)}
          </div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div style={s.cardMeta}>
        <Meta label="Passagers" value={`${r.boarded_count}/${r.pax_count}`} />
        <Meta label="Bagages" value={`${r.bag_confirmed}/${r.bag_declared}`} />
        <Meta label="Manquants" value={String(missing)} color={missing > 0 ? 'var(--warning-content)' : undefined} />
        <Meta label="Alertes" value={String(r.alerts_open)} color={r.alerts_open > 0 ? 'var(--negative)' : undefined} />
      </div>
      {canManage ? (
        <div style={s.cardActions}>
          <select style={{ ...s.statusSelect, flex: 1 }} value={r.status} onChange={(e) => onStatus(r.id, e.target.value as FlightStatus)}>
            {(Object.keys(FLIGHT_STATUS_LABEL) as FlightStatus[]).map((st) => (
              <option key={st} value={st}>
                {FLIGHT_STATUS_LABEL[st]}
              </option>
            ))}
          </select>
          <button type="button" style={s.deleteBtn} onClick={onDelete} aria-label={`Supprimer le vol ${r.flight_number}`}>
            <IconTrash size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Suppression d'un vol. La base efface en cascade ses passagers, leurs escales,
 * leurs bagages et ses alertes : c'est irréversible et ça peut représenter des
 * centaines de scans. On affiche donc ce qui va disparaître, et on exige que le
 * numéro de vol soit retapé plutôt qu'un simple « Confirmer » cliqué de travers.
 *
 * Les litiges bagage ne sont PAS en cascade. Un vol qui en porte ne peut pas
 * être supprimé sans casser la référence, on bloque avant d'appeler la base.
 */
function DeleteFlightModal({ r, onClose, onDeleted }: { r: FlightStatsRow; onClose: () => void; onDeleted: () => void }) {
  const isMobile = useIsMobile();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const blocked = r.disputes_count > 0;
  const matches = typed.trim().toUpperCase() === r.flight_number.toUpperCase();

  async function remove() {
    setBusy(true);
    setErr(null);
    const { error } = await createClient().from('flights').delete().eq('id', r.id);
    setBusy(false);
    if (error) {
      setErr("La suppression a échoué. Le vol a peut-être des données rattachées ailleurs.");
      return;
    }
    onDeleted();
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={isMobile ? { ...s.modal, ...s.modalMobile } : s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 20 }}>Supprimer {r.flight_number} ?</h2>
          <button type="button" style={s.modalClose} onClick={onClose} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>

        <p style={s.modalText}>
          {formatRoute(r, '→')} du {shortDate(r.date)}. Cette suppression est définitive et
          emporte tout ce qui a été scanné sur ce vol.
        </p>

        <ul style={s.lossList}>
          <li style={s.lossItem}>
            <strong>{r.pax_count}</strong> passager{r.pax_count > 1 ? 's' : ''} enregistré{r.pax_count > 1 ? 's' : ''}
          </li>
          <li style={s.lossItem}>
            <strong>{r.bag_declared}</strong> bagage{r.bag_declared > 1 ? 's' : ''}, dont {r.bag_confirmed} passé
            {r.bag_confirmed > 1 ? 's' : ''} au tapis
          </li>
          <li style={s.lossItem}>
            <strong>{r.alerts_open}</strong> alerte{r.alerts_open > 1 ? 's' : ''} fraude ouverte{r.alerts_open > 1 ? 's' : ''}
          </li>
        </ul>

        {blocked ? (
          <div style={s.blocked}>
            Ce vol porte {r.disputes_count} litige{r.disputes_count > 1 ? 's' : ''} bagage. Il ne peut pas être
            supprimé tant que ces dossiers existent, sinon la réclamation du passager perdrait sa référence.
          </div>
        ) : (
          <>
            <label style={s.customField}>
              <span style={s.customLabel}>Retapez {r.flight_number} pour confirmer</span>
              <input
                style={s.textInput}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={r.flight_number}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </label>
            {err ? <div style={s.error}>{err}</div> : null}
          </>
        )}

        {/* Les deux boutons côte à côte débordaient sous 360 px : « Supprimer
            définitivement » fait à lui seul la largeur de l'écran. Ils passent
            l'un sous l'autre, l'action destructrice en dessous. */}
        <div style={isMobile ? { ...s.modalActions, ...s.modalActionsMobile } : s.modalActions}>
          {!blocked ? (
            <button
              type="button"
              style={{
                ...s.confirmDelete,
                ...(isMobile ? s.fullWidthBtn : {}),
                ...(matches && !busy ? {} : { opacity: 0.5, pointerEvents: 'none' }),
              }}
              onClick={remove}
            >
              {busy ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          ) : null}
          <button type="button" style={isMobile ? { ...s.cancelBtn, ...s.fullWidthBtn } : s.cancelBtn} onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: FlightStatus }) {
  const st = STATUS_STYLE[status];
  return <span style={{ ...badge, background: st.bg, color: st.color }}>{FLIGHT_STATUS_LABEL[status]}</span>;
}

function Meta({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={s.meta}>
      <span style={s.metaLabel}>{label}</span>
      <span style={{ ...s.metaValue, ...(color ? { color, fontWeight: 700 } : {}) }}>{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  danger,
  loading,
  isMobile,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  danger?: boolean;
  loading?: boolean;
  isMobile?: boolean;
}) {
  return (
    <div style={isMobile ? { ...s.stat, ...s.statMobile } : s.stat}>
      {/* L'icône disparaît sur téléphone : sur une tuile de 145 px elle prend la
          place du chiffre, qui est la seule chose qu'on vient lire. */}
      {isMobile ? null : <div style={s.statIcon}>{icon}</div>}
      <div style={{ minWidth: 0 }}>
        <div style={s.statLabel}>{label}</div>
        <div
          style={{
            fontSize: isMobile ? 20 : 24,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: danger ? 'var(--negative)' : 'var(--content-primary)',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '…' : value}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  content: { padding: 28, maxWidth: 1400, margin: '0 auto', width: '100%' },
  contentMobile: { padding: '16px 14px' },

  head: { marginBottom: 20 },
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
    cursor: 'pointer',
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
    // 16 px : en dessous, iOS Safari zoome automatiquement à la mise au point
    // et l'écran reste décalé après la saisie.
    fontSize: 16,
    maxWidth: '100%',
  },
  textInput: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-neutral)',
    color: 'var(--content-primary)',
    borderRadius: 10,
    padding: '11px 13px',
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
  },

  // auto-fit plutôt qu'un nombre fixe de colonnes : la grille se réorganise
  // seule du petit Android 320 px au grand écran, sans palier codé en dur.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10, marginBottom: 22 },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: 13,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-neutral)',
    borderRadius: 16,
    padding: 16,
  },
  statMobile: { padding: 12, borderRadius: 14, gap: 0 },
  statIcon: { color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', flexShrink: 0 },
  statLabel: { color: 'var(--content-secondary)', fontSize: 12.5, marginBottom: 3 },

  tableWrap: { background: 'var(--bg-elevated)', border: '1px solid var(--border-neutral)', borderRadius: 16, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'transparent' },
  th: {
    textAlign: 'left',
    padding: 14,
    color: 'var(--content-secondary)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1px solid var(--border-neutral)',
    whiteSpace: 'nowrap',
  },
  td: { padding: 14, color: 'var(--content-primary)', borderBottom: '1px solid var(--border-neutral)', whiteSpace: 'nowrap' },
  empty: { padding: '40px 14px', textAlign: 'center', color: 'var(--content-secondary)' },
  error: {
    background: 'var(--negative-bg)',
    color: 'var(--negative)',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },

  statusSelect: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-neutral)',
    color: 'var(--content-primary)',
    borderRadius: 10,
    padding: '9px 10px',
    fontSize: 14,
    minHeight: 40,
    maxWidth: '100%',
  },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid var(--border-neutral)',
    color: 'var(--negative)',
    borderRadius: 9999,
    width: 40,
    height: 40,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },

  cardList: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-neutral)',
    borderRadius: 16,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontWeight: 700, fontSize: 16, letterSpacing: '-0.03em' },
  cardSub: { color: 'var(--content-secondary)', fontSize: 13, marginTop: 2 },
  // Quatre colonnes fixes écrasaient « Manquants » sur un écran étroit. En
  // auto-fit à 120 px, un téléphone courant donne un carré 2 × 2 et les grands
  // écrans retrouvent les quatre de front. Un seuil plus bas donnerait un
  // 3 + 1 bancal sur 375 px.
  cardMeta: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 },
  cardActions: { display: 'flex', gap: 8, alignItems: 'center' },
  meta: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  metaLabel: { color: 'var(--content-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 },
  metaValue: { fontSize: 14, fontWeight: 600 },

  overlay: { ...modalOverlay },
  modal: {
    ...modalPanel,
    width: 480,
    maxWidth: '100%',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalMobile: { width: '100%', padding: 16, gap: 12, maxHeight: '92vh', borderRadius: 18 },
  modalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  // 40 px de côté : une croix de 18 px avec 4 px de marge est intouchable au pouce.
  modalClose: { background: 'transparent', border: 'none', color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, cursor: 'pointer' },
  modalText: { margin: 0, color: 'var(--content-secondary)', fontSize: 14, lineHeight: 1.5 },
  lossList: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-neutral)', paddingTop: 14 },
  lossItem: { fontSize: 14, color: 'var(--content-primary)' },
  blocked: { background: 'var(--warning-bg)', color: 'var(--warning-content)', borderRadius: 12, padding: '12px 14px', fontSize: 14, lineHeight: 1.5 },
  // row-reverse : l'ordre du DOM place l'action destructrice en premier pour
  // qu'elle arrive en haut de la pile sur téléphone, mais à droite en desktop,
  // où la convention reste « Annuler » puis l'action.
  modalActions: { display: 'flex', flexDirection: 'row-reverse', justifyContent: 'flex-start', gap: 10, marginTop: 4 },
  modalActionsMobile: { flexDirection: 'column', gap: 8 },
  fullWidthBtn: { width: '100%', padding: '13px 18px' },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border-neutral)',
    color: 'var(--content-primary)',
    borderRadius: 9999,
    padding: '10px 18px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  confirmDelete: {
    background: 'var(--negative)',
    border: 'none',
    color: '#fff',
    borderRadius: 9999,
    padding: '10px 18px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
};
