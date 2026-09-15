'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, UserRole } from '@police/shared';
import { AppShell, useSession } from '@/components/AppShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  card,
  btnPrimary,
  btnSecondary,
  input,
  label,
  sectionHeading,
  badge,
  eyebrow,
  modalOverlay,
  modalPanel,
  ROLE_LABEL,
} from '@/ui/theme';
import { IconPlus, IconClose, IconTrash } from '@/components/icons';
import { AdminTabs } from '@/components/AdminTabs';

/** Profil enrichi de l'email (renvoyé par /api/admin/list-users). */
type AdminUser = Profile & { email?: string | null };

export default function AdminPage() {
  return (
    <AppShell>
      <AdminGuard />
    </AppShell>
  );
}

/** Bloque l'accès si l'utilisateur n'est pas admin. */
function AdminGuard() {
  const profile = useSession();
  const router  = useRouter();

  useEffect(() => {
    // profile est null pendant le chargement : on attend qu'il soit défini.
    if (profile !== null && profile.role !== 'admin') {
      router.replace('/');
    }
  }, [profile, router]);

  if (profile === null) return null; // chargement
  if (profile.role !== 'admin') return null; // redirection en cours

  return <AccountManager />;
}

const EMPTY = { email: '', password: '', full_name: '', role: 'agent' as UserRole, gate: '', airport_code: '', airline_code: '' };

/** Filtre de rôle de la barre d'outils. */
type RoleFilter = 'tous' | UserRole;
const ROLE_FILTERS: { key: RoleFilter; text: string }[] = [
  { key: 'tous',       text: 'Tous' },
  { key: 'agent',      text: 'Agents' },
  { key: 'supervisor', text: 'Superviseurs' },
  { key: 'admin',      text: 'Administrateurs' },
];

/** Colonnes triables du tableau. */
type SortKey = 'code' | 'name' | 'role' | 'gate' | 'airport' | 'created';
/** Ordre hiérarchique, pour que le tri par rôle ait un sens métier. */
const ROLE_RANK: Record<string, number> = { admin: 0, supervisor: 1, agent: 2 };

function AccountManager() {
  const me = useSession();
  const isMobile = useIsMobile();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('tous');
  const [airport, setAirport] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'created', desc: true });

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/admin/list-users');
      const json = await res.json();
      if (res.ok) setUsers((json.users as AdminUser[]) ?? []);
      else setLoadError(true);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function deleteUser(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setSelected(null);
      setUsers((list) => list.filter((u) => u.id !== id));
      setMessage({ text: 'Compte supprimé. Ses scans passés ne lui sont plus attribués.', ok: true });
      return { ok: true };
    }
    return { ok: false, error: json.error ?? 'Suppression impossible.' };
  }

  // Effectifs par rôle, calculés sur la liste entière : ce sont les chiffres du
  // périmètre, ils ne bougent pas quand on filtre l'affichage.
  const counts = useMemo(() => {
    let agent = 0, supervisor = 0, admin = 0;
    for (const u of users) {
      if (u.role === 'agent') agent++;
      else if (u.role === 'supervisor') supervisor++;
      else if (u.role === 'admin') admin++;
    }
    return { total: users.length, agent, supervisor, admin };
  }, [users]);

  // Aéroports présents dans le périmètre : le filtre n'apparaît que si l'admin
  // gère effectivement plusieurs escales.
  const airports = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) if (u.airport_code) set.add(u.airport_code);
    return [...set].sort();
  }, [users]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = users.filter((u) => {
      if (roleFilter !== 'tous' && u.role !== roleFilter) return false;
      if (airport && u.airport_code !== airport) return false;
      if (!q) return true;
      return [u.staff_code ?? '', u.full_name, u.email ?? '', u.gate ?? '', u.airport_code ?? '', u.airline_code ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    const dir = sort.desc ? -1 : 1;
    return rows.sort((a, b) => {
      switch (sort.key) {
        // Matricules comparés en numérique pour que ET-9 précède ET-10.
        case 'code':    return dir * (a.staff_code ?? '').localeCompare(b.staff_code ?? '', 'fr', { numeric: true });
        case 'name':    return dir * a.full_name.localeCompare(b.full_name, 'fr');
        case 'role':    return dir * ((ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9));
        case 'gate':    return dir * (a.gate ?? '').localeCompare(b.gate ?? '', 'fr');
        case 'airport': return dir * (a.airport_code ?? '').localeCompare(b.airport_code ?? '', 'fr');
        default:        return dir * (Date.parse(a.created_at) - Date.parse(b.created_at));
      }
    });
  }, [users, search, roleFilter, airport, sort]);

  /** Un clic sur un en-tête trie ; un second inverse le sens. */
  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: key === 'created' }));
  }

  const filtered = roleFilter !== 'tous' || Boolean(airport) || search.trim() !== '';

  return (
    <div data-rv-auto style={isMobile ? { ...s.page, ...s.pageMobile } : s.page}>
      <AdminTabs />
      <header style={s.head}>
        <div style={s.headText}>
          <h1 style={s.title}>Comptes</h1>
          <p style={s.subtitle}>
            {me?.airline_code ? `Périmètre de la compagnie ${me.airline_code}. ` : ''}
            Créer, consulter et retirer les accès agents, superviseurs et administrateurs.
          </p>
        </div>
        <button type="button" style={btnPrimary} onClick={() => setCreating(true)}>
          <IconPlus size={16} />
          Créer un compte
        </button>
      </header>

      <section style={isMobile ? { ...s.stats, ...s.statsMobile } : s.stats}>
        {[
          { value: counts.total, text: 'Comptes' },
          { value: counts.agent, text: 'Agents' },
          { value: counts.supervisor, text: 'Superviseurs' },
          { value: counts.admin, text: 'Administrateurs' },
        ].map((c, i) => (
          // Le filet ne sépare que deux cases voisines : pas de trait en début
          // de rangée, qui doublerait le bord de la carte.
          <Stat key={c.text} value={c.value} text={c.text} first={i % (isMobile ? 2 : 4) === 0} />
        ))}
      </section>

      {message ? (
        <div
          style={{
            ...s.banner,
            background: message.ok ? 'var(--positive-bg)' : 'var(--negative-bg)',
            color: message.ok ? 'var(--positive)' : 'var(--negative)',
          }}
        >
          <span>{message.text}</span>
          <button type="button" style={s.bannerClose} onClick={() => setMessage(null)} aria-label="Masquer le message">
            <IconClose size={16} />
          </button>
        </div>
      ) : null}

      {/* Le champ prend toute la largeur quand le filtre d'escale n'a pas lieu
          d'être, plutôt que de laisser une colonne vide à sa droite. */}
      <div style={isMobile || airports.length <= 1 ? { ...s.toolbar, gridTemplateColumns: '1fr' } : s.toolbar}>
        <label style={s.field}>
          <span style={label}>Recherche</span>
          <input
            style={input}
            placeholder="Nom, email, comptoir ou code d’escale"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {airports.length > 1 ? (
          <label style={s.field}>
            <span style={label}>Escale</span>
            <select style={input} value={airport} onChange={(e) => setAirport(e.target.value)}>
              <option value="">Toutes les escales</option>
              {airports.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div style={s.chipRow}>
        {ROLE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            style={{ ...s.chip, ...(roleFilter === f.key ? s.chipActive : {}) }}
            onClick={() => setRoleFilter(f.key)}
          >
            {f.text}
          </button>
        ))}
      </div>

      {loadError ? (
        <div style={s.errorBox}>
          <span>La liste des comptes n’a pas pu être chargée.</span>
          <button type="button" style={s.smallBtn} onClick={() => void loadUsers()}>Réessayer</button>
        </div>
      ) : loading ? (
        <div style={s.empty}>Chargement…</div>
      ) : visible.length === 0 ? (
        <div style={s.empty}>
          {filtered ? 'Aucun compte ne correspond à ces critères.' : 'Aucun compte dans ce périmètre.'}
        </div>
      ) : isMobile ? (
        <div style={s.cards}>
          {visible.map((u) => (
            <UserCard key={u.id} user={u} isSelf={u.id === me?.id} onSelect={() => setSelected(u)} />
          ))}
        </div>
      ) : (
        <UserTable
          users={visible}
          meId={me?.id}
          showAirport={airports.length > 1}
          sort={sort}
          onSort={toggleSort}
          onSelect={setSelected}
        />
      )}

      {!loading && !loadError && visible.length > 0 ? (
        <p style={s.tally}>
          {visible.length} compte{visible.length > 1 ? 's' : ''} affiché{visible.length > 1 ? 's' : ''}
          {filtered ? ` sur ${counts.total}` : ''}
        </p>
      ) : null}

      {creating ? (
        <CreateModal
          defaultAirline={me?.airline_code ?? ''}
          onClose={() => setCreating(false)}
          onCreated={(text) => {
            setCreating(false);
            setMessage({ text, ok: true });
            void loadUsers();
          }}
        />
      ) : null}

      {selected ? (
        <DetailsModal
          user={selected}
          isSelf={selected.id === me?.id}
          onClose={() => setSelected(null)}
          onDelete={deleteUser}
        />
      ) : null}
    </div>
  );
}

/** Une case de la bande de chiffres : la valeur d'abord, le libellé dessous. */
function Stat({ value, text, first }: { value: number; text: string; first: boolean }) {
  return (
    <div style={first ? { ...s.stat, borderLeft: 'none' } : s.stat}>
      <div style={s.statValue}>{value}</div>
      <div style={s.statLabel}>{text}</div>
    </div>
  );
}

function Field({ label: text, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={s.field}>
      <span style={label}>{text}</span>
      {children}
      {hint ? <span style={s.hint}>{hint}</span> : null}
    </div>
  );
}

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';
}

/** Initiales d'un nom complet, deux lettres au plus, pour l'avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '').slice(0, 2);
  return letters.toUpperCase() || '?';
}

/** Escale et compagnie sur une ligne, sans séparateur orphelin. */
function scopeText(u: AdminUser): string {
  return [u.airport_code, u.airline_code].filter(Boolean).join(' · ') || 'N/A';
}

/** Chevron de tri : plein sur la colonne active, effacé sur les autres. */
function SortMark({ active, desc }: { active: boolean; desc: boolean }) {
  return (
    <svg
      width="8" height="5" viewBox="0 0 8 5" aria-hidden
      style={{
        marginLeft: 6,
        opacity: active ? 1 : 0.25,
        transform: active && !desc ? 'rotate(180deg)' : undefined,
        flexShrink: 0,
      }}
    >
      <path d="M0 0h8L4 5z" fill="currentColor" />
    </svg>
  );
}

function UserTable({
  users,
  meId,
  showAirport,
  sort,
  onSort,
  onSelect,
}: {
  users: AdminUser[];
  meId?: string;
  showAirport: boolean;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
  onSelect: (u: AdminUser) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  // L'escale ne prend une colonne que si l'admin en gère plusieurs : sur une
  // station unique elle répéterait le même code sur toutes les lignes.
  const columns: { key: SortKey; text: string }[] = [
    { key: 'code',    text: 'Matricule' },
    { key: 'name',    text: 'Nom' },
    { key: 'role',    text: 'Rôle' },
    { key: 'gate',    text: 'Comptoir' },
    ...(showAirport ? [{ key: 'airport' as SortKey, text: 'Escale' }] : []),
    { key: 'created', text: 'Créé le' },
  ];

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={s.th}>
                <button type="button" style={s.thBtn} onClick={() => onSort(c.key)}>
                  {c.text}
                  <SortMark active={sort.key === c.key} desc={sort.desc} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.id}
              style={{ ...s.tr, background: hovered === u.id ? 'var(--bg-neutral)' : 'transparent' }}
              onMouseEnter={() => setHovered(u.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(u)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(u); } }}
              tabIndex={0}
              role="button"
              title="Voir le détail du compte"
            >
              <td style={{ ...s.td, ...s.code }}>{u.staff_code ?? 'N/A'}</td>
              <td style={s.td}>
                <div style={s.identity}>
                  <div style={s.avatar} aria-hidden>{initials(u.full_name)}</div>
                  <div style={s.identityText}>
                    <div style={s.name}>
                      {u.full_name}
                      {u.id === meId ? <span style={s.you}>vous</span> : null}
                    </div>
                    <div style={s.email}>{u.email ?? 'Email indisponible'}</div>
                  </div>
                </div>
              </td>
              <td style={s.td}><span style={badge}>{ROLE_LABEL[u.role] ?? u.role}</span></td>
              <td style={{ ...s.td, color: u.gate ? 'var(--content-primary)' : 'var(--content-tertiary)' }}>
                {u.gate || 'N/A'}
              </td>
              {showAirport ? <td style={s.td}>{scopeText(u)}</td> : null}
              <td style={{ ...s.td, color: 'var(--content-secondary)', whiteSpace: 'nowrap' }}>
                {formatDate(u.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserCard({ user, isSelf, onSelect }: { user: AdminUser; isSelf: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} style={s.cardItem} title="Voir le détail du compte">
      <div style={s.avatar} aria-hidden>{initials(user.full_name)}</div>
      <div style={s.cardMain}>
        <div style={s.name}>
          {user.full_name}
          {isSelf ? <span style={s.you}>vous</span> : null}
        </div>
        <div style={s.email}>{user.email ?? 'Email indisponible'}</div>
        <div style={s.cardMeta}>
          <span style={s.code}>{user.staff_code ?? 'N/A'}</span>
          <span>{scopeText(user)}</span>
          {user.gate ? <span>{user.gate}</span> : null}
          <span>Créé le {formatDate(user.created_at)}</span>
        </div>
      </div>
      <span style={badge}>{ROLE_LABEL[user.role] ?? user.role}</span>
    </button>
  );
}

/** Enveloppe commune des deux modales : en-tête, corps, fermeture au clic hors panneau. */
function Modal({
  head,
  children,
  onClose,
  width = 460,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalPanel, ...s.modal, maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          {head}
          <button type="button" onClick={onClose} style={s.iconBtn} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateModal({
  defaultAirline,
  onClose,
  onCreated,
}: {
  defaultAirline: string;
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  // Compagnie pré-remplie avec celle de l'admin connecté (un admin CAA crée des
  // comptes CAA par défaut). Modifiable : saisir un autre code sert à amorcer
  // une nouvelle compagnie, dont les comptes sortent aussitôt de ce périmètre.
  const [form, setForm] = useState({ ...EMPTY, airline_code: defaultAirline });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const airport = form.airport_code.trim();
    const airline = form.airline_code.trim();
    if (!airport || !airline) {
      setError('Escale et compagnie sont obligatoires : ils définissent ce que le compte pourra voir.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) onCreated(`Compte créé : ${form.email}`);
      else {
        setError(json.error ?? 'Création impossible.');
        setBusy(false);
      }
    } catch {
      setError('Connexion impossible. Réessayez.');
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={520} head={<h2 style={{ ...sectionHeading, margin: 0 }}>Créer un compte</h2>}>
      <form onSubmit={onSubmit} style={s.form}>
        <div style={eyebrow}>Identité</div>
        <Field label="Nom complet">
          <input style={input} placeholder="Jean Mukeba" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
        </Field>
        <Field label="Email">
          <input style={input} type="email" placeholder="agent@airport.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </Field>
        <Field label="Mot de passe" hint="Communiqué à la personne, le compte est actif immédiatement.">
          <input style={input} type="text" placeholder="••••••••" value={form.password} onChange={(e) => update('password', e.target.value)} />
        </Field>

        <div style={eyebrow}>Affectation</div>
        <Field label="Rôle" hint={ROLE_HINT[form.role]}>
          <select style={input} value={form.role} onChange={(e) => update('role', e.target.value as UserRole)}>
            <option value="agent">Agent</option>
            <option value="supervisor">Superviseur</option>
            <option value="admin">Administrateur</option>
          </select>
        </Field>
        {form.role === 'agent' ? (
          <Field label="Comptoir assigné">
            <input style={input} placeholder="Comptoir 3" value={form.gate} onChange={(e) => update('gate', e.target.value)} />
          </Field>
        ) : null}
        {/* Escale et compagnie s'appliquent à TOUS les rôles, agents compris :
            ils déterminent le périmètre de données du compte. Un agent sans
            ces codes ne verrait aucun vol sur son PDA. */}
        <Field label="Escale (code IATA)">
          <input style={input} placeholder="FIH, FBM, GMN…" value={form.airport_code} onChange={(e) => update('airport_code', e.target.value.toUpperCase())} maxLength={4} required />
        </Field>
        <Field label="Compagnie (code IATA)" hint="Préfixe des numéros de vol. Un autre code que le vôtre amorce une nouvelle compagnie.">
          <input style={input} placeholder="ET, BU…" value={form.airline_code} onChange={(e) => update('airline_code', e.target.value.toUpperCase())} maxLength={3} required />
        </Field>

        {error ? <p style={{ ...s.msg, background: 'var(--negative-bg)', color: 'var(--negative)' }}>{error}</p> : null}

        <div style={s.modalActions}>
          <button type="button" style={btnSecondary} onClick={onClose} disabled={busy}>Annuler</button>
          <button style={btnPrimary} disabled={busy} type="submit">
            <IconPlus size={16} />
            {busy ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Ce que chaque rôle ouvre comme accès, rappelé sous le sélecteur. */
const ROLE_HINT: Record<UserRole, string> = {
  agent:      'Accès au PDA uniquement : scan des embarquements et des bagages.',
  supervisor: 'Accès au portail web : suivi des vols, alertes et rapports.',
  admin:      'Accès au portail web et à la gestion des comptes.',
};

function DetailsModal({
  user,
  isSelf,
  onClose,
  onDelete,
}: {
  user: AdminUser;
  isSelf: boolean;
  onClose: () => void;
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const rows: { label: string; value: string; copy?: boolean }[] = [
    { label: 'Matricule', value: user.staff_code ?? 'N/A', copy: Boolean(user.staff_code) },
    { label: 'Email', value: user.email ?? 'N/A', copy: Boolean(user.email) },
    { label: 'Rôle', value: ROLE_LABEL[user.role] ?? user.role },
    { label: 'Accès', value: ROLE_HINT[user.role] ?? 'N/A' },
    { label: 'Comptoir', value: user.gate || 'N/A' },
    { label: 'Escale', value: user.airport_code || 'N/A' },
    { label: 'Compagnie', value: user.airline_code || 'N/A' },
    { label: 'Créé le', value: formatDate(user.created_at) },
  ];

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // presse-papiers refusé par le navigateur : la valeur reste sélectionnable
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const res = await onDelete(user.id);
    if (!res.ok) {
      setError(res.error ?? 'Suppression impossible.');
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      head={
        <div style={s.modalUser}>
          <div style={{ ...s.avatar, width: 44, height: 44, fontSize: 15 }} aria-hidden>
            {initials(user.full_name)}
          </div>
          <div>
            <div style={s.modalName}>{user.full_name}</div>
            <span style={badge}>{ROLE_LABEL[user.role] ?? user.role}</span>
          </div>
        </div>
      }
    >
      <dl style={s.detailList}>
        {rows.map((r) => (
          <div key={r.label} style={s.detailRow}>
            <dt style={s.detailLabel}>{r.label}</dt>
            <dd style={s.detailValue}>
              {r.value}
              {r.copy ? (
                <button type="button" style={s.copyBtn} onClick={() => void copy(r.value, r.label)}>
                  {copied === r.label ? 'Copié' : 'Copier'}
                </button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      {error ? (
        <p style={{ ...s.msg, background: 'var(--negative-bg)', color: 'var(--negative)', marginTop: 12 }}>{error}</p>
      ) : null}

      {confirming ? (
        // La suppression met scanned_by à null sur tout l'historique du compte :
        // l'admin doit savoir qu'il perd l'attribution, pas seulement l'accès.
        <p style={s.warnBox}>
          Supprimer ce compte retire son accès et rend anonymes tous ses scans passés :
          les enregistrements restent en base, mais plus personne n’y est associé. Cette
          action est définitive.
        </p>
      ) : null}

      <div style={s.modalActions}>
        {isSelf ? (
          <span style={s.selfNote}>Vous ne pouvez pas supprimer votre propre compte.</span>
        ) : confirming ? (
          <>
            <button type="button" style={btnSecondary} onClick={() => setConfirming(false)} disabled={busy}>
              Annuler
            </button>
            <button type="button" style={s.dangerBtn} onClick={confirmDelete} disabled={busy}>
              <IconTrash size={16} />
              {busy ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </>
        ) : (
          <button type="button" style={s.dangerBtn} onClick={() => setConfirming(true)}>
            <IconTrash size={16} />
            Supprimer le compte
          </button>
        )}
      </div>
    </Modal>
  );
}

const s: Record<string, CSSProperties> = {
  page: { padding: '28px 32px', maxWidth: 1200, margin: '0 auto', width: '100%' },
  pageMobile: { padding: '20px 16px' },

  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 },
  headText: { minWidth: 260, flex: '1 1 320px' },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 'var(--lh-title)',
    margin: 0,
    color: 'var(--content-primary)',
  },
  subtitle: { color: 'var(--content-secondary)', fontSize: 14, margin: '6px 0 0', maxWidth: 620, lineHeight: 1.5 },

  // Bande de chiffres : une seule carte, colonnes séparées par un filet fin.
  stats: { ...card, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: 0, marginBottom: 18 },
  statsMobile: { gridTemplateColumns: 'repeat(2, 1fr)' },
  stat: { padding: '16px 20px', borderLeft: '1px solid var(--divider)' },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--content-primary)',
  },
  statLabel: { color: 'var(--content-secondary)', fontSize: 13, marginTop: 2 },

  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 8,
    padding: '10px 10px 10px 14px',
    fontSize: 14,
    marginBottom: 16,
  },
  bannerClose: { background: 'transparent', border: 'none', color: 'inherit', display: 'grid', placeItems: 'center', padding: 4, cursor: 'pointer' },

  toolbar: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  hint: { color: 'var(--content-tertiary)', fontSize: 12.5, lineHeight: 1.4 },

  chipRow: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 },
  chip: {
    background: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--border-neutral)',
    color: 'var(--content-primary)',
    borderRadius: 9999,
    padding: '6px 13px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  chipActive: {
    background: 'var(--interactive-accent)',
    borderColor: 'var(--interactive-accent)',
    color: 'var(--interactive-control)',
  },

  empty: { ...card, color: 'var(--content-secondary)', textAlign: 'center', padding: 36 },
  errorBox: {
    ...card,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    color: 'var(--content-secondary)',
    fontSize: 14,
  },
  smallBtn: { ...btnSecondary, height: 36, padding: '0 16px', fontSize: 13.5, cursor: 'pointer' },
  tally: { color: 'var(--content-tertiary)', fontSize: 13, margin: '12px 0 0', fontVariantNumeric: 'tabular-nums' },

  tableWrap: { ...card, padding: 0, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 620 },
  // Matricule : chiffres alignés, on le lit en colonne et on le dicte.
  code: { fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em', fontWeight: 500, whiteSpace: 'nowrap' },
  th: {
    textAlign: 'left',
    padding: '11px 16px',
    color: 'var(--content-tertiary)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1px solid var(--divider)',
    whiteSpace: 'nowrap',
  },
  // En-tête cliquable : le tri se pose sur le libellé, sans bouton visible.
  thBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    padding: 0,
    font: 'inherit',
    color: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'inherit',
    cursor: 'pointer',
  },
  tr: { borderBottom: '1px solid var(--divider)', cursor: 'pointer' },
  td: { padding: '12px 16px', color: 'var(--content-primary)', verticalAlign: 'middle' },

  identity: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  identityText: { minWidth: 0 },
  // Avatar : disque gris, initiales noires. Le rôle se lit dans la pastille.
  avatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'var(--bg-neutral)',
    color: 'var(--content-primary)',
    fontFamily: 'var(--font-display)',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    color: 'var(--content-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  you: { ...badge, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 11, padding: '2px 8px' },
  email: {
    color: 'var(--content-secondary)',
    fontSize: 12.5,
    marginTop: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  cards: { display: 'flex', flexDirection: 'column', gap: 10 },
  cardItem: {
    ...card,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    width: '100%',
    textAlign: 'left',
    font: 'inherit',
    cursor: 'pointer',
  },
  cardMain: { flex: 1, minWidth: 0 },
  cardMeta: { display: 'flex', gap: 10, flexWrap: 'wrap', color: 'var(--content-tertiary)', fontSize: 12, marginTop: 5 },

  // Modales
  modal: { width: '100%', padding: 22, maxHeight: '86vh', overflowY: 'auto' },
  modalHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  modalUser: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  modalName: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--content-primary)',
    marginBottom: 6,
    letterSpacing: '-0.02em',
  },
  iconBtn: {
    display: 'grid',
    placeItems: 'center',
    width: 34,
    height: 34,
    borderRadius: 9999,
    border: 'none',
    background: 'var(--bg-neutral)',
    color: 'var(--content-primary)',
    cursor: 'pointer',
    flexShrink: 0,
  },

  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  // Retour de formulaire : bandeau rayon 8, la paire sémantique est posée par
  // l'appelant.
  msg: { fontSize: 14, margin: 0, padding: '10px 14px', borderRadius: 8 },

  detailList: { display: 'flex', flexDirection: 'column', gap: 0, margin: 0 },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 16,
    padding: '10px 0',
    borderTop: '1px solid var(--divider)',
  },
  detailLabel: { color: 'var(--content-secondary)', fontSize: 13, fontWeight: 500, flexShrink: 0 },
  detailValue: {
    color: 'var(--content-primary)',
    fontSize: 13.5,
    textAlign: 'right',
    wordBreak: 'break-word',
    margin: 0,
  },
  copyBtn: {
    background: 'transparent',
    border: 'none',
    padding: '0 0 0 8px',
    color: 'var(--content-link)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: 'pointer',
  },
  warnBox: {
    background: 'var(--warning-bg)',
    color: 'var(--warning-content)',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13.5,
    lineHeight: 1.5,
    margin: '16px 0 0',
  },
  modalActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  selfNote: { color: 'var(--content-tertiary)', fontSize: 13, textAlign: 'right' },
  // Suppression : le bouton secondaire, encre rouge. Pas de fond rouge, la
  // couleur du texte suffit à dire le risque.
  dangerBtn: { ...btnSecondary, color: 'var(--negative)', cursor: 'pointer' },
};
