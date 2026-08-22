'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AppShell, useSession } from '@/components/AppShell';
import { flightScope } from '@/lib/scope';
import { PERIOD_LABEL, PERIOD_ORDER, rangeLabel, resolveRange, type Period } from '@/lib/period';
import {
  loadActors,
  loadMovements,
  MOVEMENTS_PAGE_SIZE,
  type MovementFilters,
} from '@/lib/movements';
import {
  MOVEMENT_FAMILY,
  MOVEMENT_LABEL,
  MOVEMENT_ORDER,
  todayAtAirport,
  type Movement,
  type MovementFamily,
  type MovementKind,
} from '@police/shared';
import { useIsMobile } from '@/hooks/useIsMobile';
import { badge, card, input, sectionHeading } from '@/ui/theme';

export default function AuditPage() {
  return (
    <AppShell>
      <AuditView />
    </AppShell>
  );
}

/** Une seule touche de couleur par famille, appliquée au texte de la pastille. */
const FAMILY_COLOR: Record<MovementFamily, string> = {
  passenger: 'var(--content-secondary)',
  baggage: 'var(--brand-forest)',
  fraud: 'var(--negative)',
  dispute: 'var(--warning-content)',
};

function AuditView() {
  const profile = useSession();
  const scope = flightScope(profile);
  const isMobile = useIsMobile();
  const today = todayAtAirport(scope.airport);

  const [period, setPeriod] = useState<Period>('jour');
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [kinds, setKinds] = useState<MovementKind[]>([]);
  const [actorId, setActorId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actors, setActors] = useState<{ id: string; full_name: string; role: string }[]>([]);

  const { from, to } = resolveRange(period, customFrom, customTo, today);
  const isAdmin = profile?.role === 'admin';

  // `kinds` est un tableau recréé à chaque rendu : on le fige en clé stable pour
  // que l'effet ne se relance pas en boucle.
  const kindsKey = kinds.join(',');

  const filters = useMemo<MovementFilters>(
    () => ({ from, to, kinds, actorId, search }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from, to, kindsKey, actorId, search],
  );

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await loadMovements(filters, page);
      setRows(res.rows);
      setTotal(res.total);
    } catch {
      setError('Le journal n’a pas pu être chargé. Réessayez dans un instant.');
      setRows([]);
      setTotal(0);
    }
    setLoading(false);
  }, [filters, page, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) void loadActors().then(setActors);
  }, [isAdmin]);

  // Tout changement de filtre ramène à la première page, sinon on reste sur une
  // page qui n'existe plus dans le nouveau résultat.
  useEffect(() => {
    setPage(0);
  }, [from, to, kindsKey, actorId, search]);

  if (profile && !isAdmin) {
    return (
      <div style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
        <h1 style={s.title}>Journal d’audit</h1>
        <p style={s.denied}>
          Cette page est réservée aux administrateurs. Votre compte est enregistré comme{' '}
          {profile.role === 'supervisor' ? 'superviseur' : 'agent'}.
        </p>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE));
  const firstShown = total === 0 ? 0 : page * MOVEMENTS_PAGE_SIZE + 1;
  const lastShown = Math.min((page + 1) * MOVEMENTS_PAGE_SIZE, total);

  function toggleKind(k: MovementKind) {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  return (
    <div style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      <div style={s.head}>
        <div>
          <h1 style={s.title}>Journal d’audit</h1>
          <div style={s.sub}>{rangeLabel(period, from, to)}</div>
        </div>
        <div style={s.countBox}>
          <div style={s.countValue}>{loading ? '…' : total.toLocaleString('fr-FR')}</div>
          <div style={s.countLabel}>mouvement{total > 1 ? 's' : ''}</div>
        </div>
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
          <label style={s.field}>
            <span style={s.fieldLabel}>Du</span>
            <input type="date" max={today} style={s.dateInput} value={customFrom} onChange={(e) => setCustomFrom(e.target.value || today)} />
          </label>
          <label style={s.field}>
            <span style={s.fieldLabel}>Au</span>
            <input type="date" max={today} style={s.dateInput} value={customTo} onChange={(e) => setCustomTo(e.target.value || today)} />
          </label>
        </div>
      ) : null}

      <h2 style={sectionHeading}>Filtres</h2>

      <div style={isMobile ? { ...s.filterRow, gridTemplateColumns: '1fr' } : s.filterRow}>
        <label style={s.field}>
          <span style={s.fieldLabel}>Recherche</span>
          <input
            style={input}
            placeholder="Passager, PNR, étiquette ou vol"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label style={s.field}>
          <span style={s.fieldLabel}>Auteur</span>
          <select style={input} value={actorId} onChange={(e) => setActorId(e.target.value)}>
            <option value="">Tous les auteurs</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={s.kindRow}>
        <button style={{ ...s.kindChip, ...(kinds.length === 0 ? s.kindChipActive : {}) }} onClick={() => setKinds([])}>
          Tous les types
        </button>
        {MOVEMENT_ORDER.map((k) => (
          <button
            key={k}
            style={{ ...s.kindChip, ...(kinds.includes(k) ? s.kindChipActive : {}) }}
            onClick={() => toggleKind(k)}
          >
            {MOVEMENT_LABEL[k]}
          </button>
        ))}
      </div>

      {error ? <div style={s.error}>{error}</div> : null}

      {loading ? (
        <div style={s.empty}>Chargement…</div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>Aucun mouvement pour ces critères.</div>
      ) : isMobile ? (
        <div style={s.cards}>
          {rows.map((m, i) => (
            <MovementCard key={`${m.at}-${m.kind}-${i}`} m={m} />
          ))}
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Horodatage</th>
                <th style={s.th}>Mouvement</th>
                <th style={s.th}>Auteur</th>
                <th style={s.th}>Vol</th>
                <th style={s.th}>Passager</th>
                <th style={s.th}>Étiquette</th>
                <th style={s.th}>Détail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={`${m.at}-${m.kind}-${i}`} style={s.tr}>
                  <td style={{ ...s.td, whiteSpace: 'nowrap', color: 'var(--content-secondary)' }}>{stamp(m.at)}</td>
                  <td style={s.td}>
                    <span style={{ ...badge, color: FAMILY_COLOR[MOVEMENT_FAMILY[m.kind]] }}>
                      {MOVEMENT_LABEL[m.kind]}
                    </span>
                  </td>
                  <td style={s.td}>{m.actor_name ?? <span style={s.system}>Système</span>}</td>
                  <td style={s.td}>{m.flight_number ?? 'N/A'}</td>
                  <td style={s.td}>
                    {m.passenger_name ?? 'N/A'}
                    {m.pnr ? <span style={s.muted}> · {m.pnr}</span> : null}
                  </td>
                  <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>{m.tag_number ?? 'N/A'}</td>
                  <td style={{ ...s.td, color: 'var(--content-secondary)' }}>{m.detail ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <div style={s.pager}>
          <span style={s.pagerInfo}>
            {firstShown} à {lastShown} sur {total.toLocaleString('fr-FR')}
          </span>
          <div style={s.pagerBtns}>
            <button style={{ ...s.pagerBtn, ...(page === 0 ? s.pagerBtnOff : {}) }} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </button>
            <span style={s.pagerPage}>
              Page {page + 1} sur {pageCount}
            </span>
            <button
              style={{ ...s.pagerBtn, ...(page + 1 >= pageCount ? s.pagerBtnOff : {}) }}
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MovementCard({ m }: { m: Movement }) {
  return (
    <div style={s.cardItem}>
      <div style={s.cardTop}>
        <span style={{ ...badge, color: FAMILY_COLOR[MOVEMENT_FAMILY[m.kind]] }}>{MOVEMENT_LABEL[m.kind]}</span>
        <span style={s.cardStamp}>{stamp(m.at)}</span>
      </div>
      <div style={s.cardMain}>{m.passenger_name ?? m.tag_number ?? m.flight_number ?? 'N/A'}</div>
      <div style={s.cardMeta}>
        <span>{m.actor_name ?? 'Système'}</span>
        <span>{m.flight_number ?? 'N/A'}</span>
        {m.pnr ? <span>{m.pnr}</span> : null}
        {m.tag_number && m.passenger_name ? <span>{m.tag_number}</span> : null}
      </div>
      {m.detail ? <div style={s.cardDetail}>{m.detail}</div> : null}
    </div>
  );
}

function stamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

const s: Record<string, CSSProperties> = {
  content: { padding: 28, maxWidth: 1400, margin: '0 auto', width: '100%' },
  contentMobile: { padding: '16px 14px' },

  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--content-primary)' },
  sub: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 4 },
  countBox: { textAlign: 'right' },
  countValue: { fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--content-primary)', lineHeight: 1.1 },
  countLabel: { color: 'var(--content-secondary)', fontSize: 13 },

  denied: { color: 'var(--content-secondary)', fontSize: 15, marginTop: 12, maxWidth: 560, lineHeight: 1.5 },

  tabs: { display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
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

  customRow: { display: 'flex', gap: 12, marginBottom: 18, alignItems: 'flex-end', flexWrap: 'wrap' },
  filterRow: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 13, color: 'var(--content-secondary)', fontWeight: 600 },
  dateInput: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-neutral)',
    color: 'var(--content-primary)',
    borderRadius: 10,
    padding: '10px 13px',
    fontSize: 14,
  },

  kindRow: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 20 },
  kindChip: {
    background: 'transparent',
    border: '1px solid var(--border-neutral)',
    color: 'var(--content-secondary)',
    borderRadius: 9999,
    padding: '6px 13px',
    fontSize: 12.5,
    fontWeight: 600,
  },
  kindChipActive: { borderColor: 'var(--interactive-primary)', color: 'var(--brand-forest)' },

  error: { color: 'var(--negative)', fontSize: 14, marginBottom: 14 },
  empty: { ...card, color: 'var(--content-secondary)', textAlign: 'center', padding: 36 },

  tableWrap: { ...card, padding: 0, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 900 },
  th: {
    textAlign: 'left',
    padding: '13px 16px',
    color: 'var(--content-tertiary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    borderBottom: '1px solid var(--border-neutral)',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border-neutral)' },
  td: { padding: '12px 16px', color: 'var(--content-primary)', verticalAlign: 'top' },
  muted: { color: 'var(--content-tertiary)' },
  system: { color: 'var(--content-tertiary)', fontStyle: 'italic' },

  cards: { display: 'flex', flexDirection: 'column', gap: 10 },
  cardItem: { ...card, padding: 14 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardStamp: { color: 'var(--content-tertiary)', fontSize: 12, whiteSpace: 'nowrap' },
  cardMain: { fontWeight: 600, fontSize: 14.5, color: 'var(--content-primary)' },
  cardMeta: { display: 'flex', gap: 10, flexWrap: 'wrap', color: 'var(--content-secondary)', fontSize: 12.5, marginTop: 5 },
  cardDetail: { color: 'var(--content-secondary)', fontSize: 12.5, marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border-neutral)' },

  pager: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  pagerInfo: { color: 'var(--content-secondary)', fontSize: 13 },
  pagerBtns: { display: 'flex', alignItems: 'center', gap: 10 },
  pagerPage: { color: 'var(--content-secondary)', fontSize: 13, whiteSpace: 'nowrap' },
  pagerBtn: {
    background: 'transparent',
    border: '1px solid var(--border-neutral)',
    color: 'var(--content-primary)',
    borderRadius: 9999,
    padding: '8px 18px',
    fontWeight: 600,
    fontSize: 13.5,
  },
  pagerBtnOff: { opacity: 0.4 },
};
