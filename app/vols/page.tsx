'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { FlightStatus } from '@police/shared';
import { FLIGHT_STATUS_LABEL, formatRoute, hasFlightDeparted, todayAtAirport } from '@police/shared';
import { createClient } from '@/supabase/client';
import { AppShell, useSession } from '@/components/AppShell';
import { flightScope } from '@/lib/scope';
import { loadFlightStats, sumFlightStats, type FlightStatsRow } from '@/lib/flight-stats';
import { PERIOD_LABEL, PERIOD_ORDER, rangeLabel, resolveRange, type Period } from '@/lib/period';
import { useIsMobile } from '@/hooks/useIsMobile';
import { badge, btnSecondary, card, eyebrow, input, label as fieldLabel, modalOverlay, modalPanel } from '@/ui/theme';
import { IconTrash, IconClose } from '@/components/icons';
import { Gauge } from '@/components/Gauge';

const STATUS_STYLE: Record<FlightStatus, { bg: string; color: string }> = {
  scheduled: { bg: 'var(--bg-neutral)', color: 'var(--content-secondary)' },
  delayed: { bg: 'var(--warning-bg)', color: 'var(--warning-content)' },
  boarding: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  closed: { bg: 'var(--bg-neutral)', color: 'var(--content-primary)' },
  departed: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  arrived: { bg: 'var(--positive-bg)', color: 'var(--positive)' },
  cancelled: { bg: 'var(--negative-bg)', color: 'var(--negative)' },
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
  const departed = rows.filter((r) => hasFlightDeparted(r.status)).length;
  const missing = total.declared - total.confirmed;
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

  return (
    <div data-rv-auto style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
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

      {/* Mêmes jauges que le tableau de bord et les rapports : le chiffre du
          centre rapporté à une référence dite en clair dessous. */}
      <div style={isMobile ? { ...s.grid, gridTemplateColumns: '1fr' } : s.grid}>
        <Gauge
          label="Vols"
          value={rows.length}
          total={rows.length}
          ratio={rows.length > 0 ? departed / rows.length : 0}
          caption={rows.length > 0 ? `${plural(departed, 'décollé')} sur ${rows.length}` : 'aucun vol'}
          loading={loading}
        />
        <Gauge
          label="Passagers embarqués"
          value={total.boarded}
          total={total.pax}
          caption={`sur ${plural(total.pax, 'enregistré')}`}
          loading={loading}
        />
        <Gauge
          label="Bagages au tapis"
          value={total.confirmed}
          total={total.declared}
          caption={`sur ${plural(total.declared, 'déclaré')}`}
          loading={loading}
        />
        <Gauge
          label="Bagages manquants"
          value={missing}
          total={total.declared}
          caption={missing > 0 ? `sur ${plural(total.declared, 'déclaré')}` : 'aucun manquant'}
          danger={missing > 0}
          loading={loading}
        />
        <Gauge
          label="Alertes ouvertes"
          value={total.alerts}
          total={total.declared + total.alerts}
          caption={total.alerts > 0 ? `sur ${plural(rows.length, 'vol')}` : 'aucune alerte'}
          danger={total.alerts > 0}
          loading={loading}
        />
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
          <h2 style={{ ...s.modalTitle, fontSize: isMobile ? 17 : 20 }}>Supprimer {r.flight_number} ?</h2>
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

const s: Record<string, CSSProperties> = {
  content: { padding: 28, maxWidth: 1400, margin: '0 auto', width: '100%' },
  contentMobile: { padding: '16px 14px' },

  head: { marginBottom: 20 },
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

  // Puces de filtre : pilule bordée, blanche au repos ; l'active est noire.
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
    cursor: 'pointer',
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
    // 16 px : en dessous, iOS Safari zoome automatiquement à la mise au point
    // et l'écran reste décalé après la saisie.
    fontSize: 16,
    maxWidth: '100%',
  },
  textInput: { ...input, fontSize: 16, boxSizing: 'border-box' },

  // auto-fit plutôt qu'un nombre fixe de colonnes : la grille se réorganise
  // seule du grand écran à la tablette, sans palier codé en dur ; une seule
  // colonne sur téléphone.
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 22 },

  tableWrap: { ...card, padding: 0, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'transparent' },
  th: {
    textAlign: 'left',
    padding: 14,
    color: 'var(--content-tertiary)',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1px solid var(--divider)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: 14,
    color: 'var(--content-primary)',
    borderBottom: '1px solid var(--divider)',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  empty: { padding: '40px 14px', textAlign: 'center', color: 'var(--content-secondary)' },
  error: {
    background: 'var(--negative-bg)',
    color: 'var(--negative)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },

  statusSelect: { ...input, width: 'auto', padding: '8px 10px', minHeight: 40, maxWidth: '100%' },
  deleteBtn: { ...btnSecondary, color: 'var(--negative)', width: 40, height: 40, padding: 0, flexShrink: 0, cursor: 'pointer' },

  cardList: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' },
  cardSub: { color: 'var(--content-secondary)', fontSize: 13, marginTop: 2 },
  // Quatre colonnes fixes écrasaient « Manquants » sur un écran étroit. En
  // auto-fit à 120 px, un téléphone courant donne un carré 2 × 2 et les grands
  // écrans retrouvent les quatre de front. Un seuil plus bas donnerait un
  // 3 + 1 bancal sur 375 px.
  cardMeta: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 },
  cardActions: { display: 'flex', gap: 8, alignItems: 'center' },
  meta: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  metaLabel: { ...eyebrow, margin: 0 },
  metaValue: { fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },

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
  modalMobile: { width: '100%', padding: 16, gap: 12, maxHeight: '92vh' },
  modalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    color: 'var(--content-primary)',
  },
  // 40 px de côté : une croix de 18 px avec 4 px de marge est intouchable au pouce.
  modalClose: { background: 'transparent', border: 'none', color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, cursor: 'pointer' },
  modalText: { margin: 0, color: 'var(--content-secondary)', fontSize: 14, lineHeight: 1.5 },
  lossList: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--divider)', paddingTop: 14 },
  lossItem: { fontSize: 14, color: 'var(--content-primary)' },
  blocked: { background: 'var(--warning-bg)', color: 'var(--warning-content)', borderRadius: 8, padding: '12px 14px', fontSize: 14, lineHeight: 1.5 },
  // row-reverse : l'ordre du DOM place l'action destructrice en premier pour
  // qu'elle arrive en haut de la pile sur téléphone, mais à droite en desktop,
  // où la convention reste « Annuler » puis l'action.
  modalActions: { display: 'flex', flexDirection: 'row-reverse', justifyContent: 'flex-start', gap: 10, marginTop: 4 },
  modalActionsMobile: { flexDirection: 'column', gap: 8 },
  fullWidthBtn: { width: '100%' },
  cancelBtn: { ...btnSecondary, cursor: 'pointer' },
  confirmDelete: { ...btnSecondary, color: 'var(--negative)', cursor: 'pointer' },
};
