'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, UserRole } from '@police/shared';
import { AppShell, useSession } from '@/components/AppShell';
import { useIsMobile } from '@/hooks/useIsMobile';
import { card, btnPrimary, btnGhost, input, label, sectionHeading, badge, modalOverlay, modalPanel, ROLE_COLOR, ROLE_LABEL } from '@/ui/theme';
import { IconPlus, IconUser, IconClose, IconTrash } from '@/components/icons';

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
    // profile est null pendant le chargement — on attend qu'il soit défini.
    if (profile !== null && profile.role !== 'admin') {
      router.replace('/');
    }
  }, [profile, router]);

  if (profile === null) return null; // chargement
  if (profile.role !== 'admin') return null; // redirection en cours

  return <AccountManager />;
}

const EMPTY = { email: '', password: '', full_name: '', role: 'agent' as UserRole, gate: '', airport_code: '', airline_code: 'ET' };

function AccountManager() {
  const me = useSession();
  const isMobile = useIsMobile();
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/list-users');
      const json = await res.json();
      if (res.ok) setUsers((json.users as AdminUser[]) ?? []);
    } catch {
      // silencieux — la liste reste vide
    }
    setLoading(false);
  }, []);

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
      setMessage({ text: 'Compte supprimé.', ok: true });
      return { ok: true };
    }
    return { ok: false, error: json.error ?? 'Suppression impossible.' };
  }

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const airport = form.airport_code.trim();
    const airline = form.airline_code.trim();
    if (!airport || !airline) {
      setMessage({ text: 'Aéroport et compagnie sont obligatoires : ils définissent ce que le compte pourra voir.', ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ text: `Compte créé : ${form.email}`, ok: true });
        setForm(EMPTY);
        void loadUsers();
      } else {
        setMessage({ text: json.error ?? 'Erreur', ok: false });
      }
    } catch {
      setMessage({ text: 'Connexion impossible. Réessayez.', ok: false });
    }
    setBusy(false);
  }

  return (
    <div style={isMobile ? { ...s.page, padding: '20px 16px' } : s.page}>
      <header style={s.head}>
        <div>
          <h1 style={s.title}>Gestion des comptes</h1>
          <p style={s.subtitle}>Créer et consulter les comptes agents, superviseurs et administrateurs.</p>
        </div>
      </header>

      <div style={isMobile ? { ...s.grid, gridTemplateColumns: '1fr' } : s.grid}>
        <section style={s.formCard}>
          <div style={sectionHeading}>Créer un compte</div>
          <form onSubmit={onSubmit} style={s.form}>
            <Field label="Nom complet">
              <input style={input} placeholder="Jean Mukeba" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
            </Field>
            <Field label="Email">
              <input style={input} type="email" placeholder="agent@airport.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </Field>
            <Field label="Mot de passe">
              <input style={input} type="text" placeholder="••••••••" value={form.password} onChange={(e) => update('password', e.target.value)} />
            </Field>
            <Field label="Rôle">
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
            {/* Aéroport et compagnie s'appliquent à TOUS les rôles, agents compris :
                ils déterminent le périmètre de données du compte. Un agent sans
                ces codes ne verrait aucun vol sur son PDA. */}
            <Field label="Aéroport (code IATA)">
              <input style={input} placeholder="FIH, FBM, GMN…" value={form.airport_code} onChange={(e) => update('airport_code', e.target.value.toUpperCase())} maxLength={4} required />
            </Field>
            <Field label="Compagnie (code IATA)">
              <input style={input} placeholder="ET" value={form.airline_code} onChange={(e) => update('airline_code', e.target.value.toUpperCase())} maxLength={3} required />
            </Field>

            {message ? (
              <p style={{ ...s.msg, color: message.ok ? 'var(--positive)' : 'var(--negative)' }}>{message.text}</p>
            ) : null}

            <button style={{ ...btnPrimary, justifyContent: 'center', opacity: busy ? 0.7 : 1 }} disabled={busy} type="submit">
              <IconPlus size={16} />
              {busy ? 'Création…' : 'Créer le compte'}
            </button>
          </form>
        </section>

        <section style={s.listCard}>
          <div style={s.listHead}>
            <div style={sectionHeading}>Comptes existants</div>
            <span style={s.count}>{users.length}</span>
          </div>

          {loading ? (
            <div style={s.empty}>Chargement…</div>
          ) : users.length === 0 ? (
            <div style={s.empty}>Aucun compte pour le moment.</div>
          ) : (
            <div style={s.userList}>
              {users.map((u) => (
                <UserRow key={u.id} user={u} onSelect={() => setSelected(u)} />
              ))}
            </div>
          )}
        </section>
      </div>

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

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={s.field}>
      <span style={label}>{text}</span>
      {children}
    </div>
  );
}

function formatDate(value: string | null): string {
  return value
    ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';
}

function UserRow({ user, onSelect }: { user: AdminUser; onSelect: () => void }) {
  const color = ROLE_COLOR[user.role] ?? 'var(--content-secondary)';
  return (
    <button type="button" onClick={onSelect} style={s.userRow} title="Voir le détail du compte">
      <div style={{ ...s.userAvatar, background: color }}>
        <IconUser size={18} />
      </div>
      <div style={s.userMain}>
        <div style={s.userName}>{user.full_name}</div>
        <div style={s.userMeta}>
          {user.airport_code ? `${user.airport_code}${user.airline_code ? ' · ' + user.airline_code : ''} · ` : ''}
          {user.gate ? `${user.gate} · ` : ''}
          Créé le {formatDate(user.created_at)}
        </div>
      </div>
      <span style={{ ...badge, color }}>{ROLE_LABEL[user.role] ?? user.role}</span>
    </button>
  );
}

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
  const color = ROLE_COLOR[user.role] ?? 'var(--content-secondary)';

  const rows: { label: string; value: string }[] = [
    { label: 'Email', value: user.email ?? 'N/A' },
    { label: 'Rôle', value: ROLE_LABEL[user.role] ?? user.role },
    { label: 'Comptoir', value: user.gate || 'N/A' },
    { label: 'Aéroport', value: user.airport_code || 'N/A' },
    { label: 'Compagnie', value: user.airline_code || 'N/A' },
    { label: 'Créé le', value: formatDate(user.created_at) },
    { label: 'Identifiant', value: user.id },
  ];

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
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalPanel, ...s.modal }} onClick={(e) => e.stopPropagation()}>
        <div style={s.modalHead}>
          <div style={s.modalUser}>
            <div style={{ ...s.userAvatar, width: 44, height: 44, background: color }}>
              <IconUser size={22} />
            </div>
            <div>
              <div style={s.modalName}>{user.full_name}</div>
              <span style={{ ...badge, color }}>{ROLE_LABEL[user.role] ?? user.role}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={s.iconBtn} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>

        <dl style={s.detailList}>
          {rows.map((r) => (
            <div key={r.label} style={s.detailRow}>
              <dt style={s.detailLabel}>{r.label}</dt>
              <dd style={s.detailValue}>{r.value}</dd>
            </div>
          ))}
        </dl>

        {error ? <p style={{ ...s.msg, color: 'var(--negative)' }}>{error}</p> : null}

        <div style={s.modalActions}>
          {isSelf ? (
            <span style={s.selfNote}>Vous ne pouvez pas supprimer votre propre compte.</span>
          ) : confirming ? (
            <>
              <span style={s.confirmNote}>Supprimer définitivement ce compte ?</span>
              <button type="button" style={btnGhost} onClick={() => setConfirming(false)} disabled={busy}>
                Annuler
              </button>
              <button type="button" style={{ ...s.dangerBtn, opacity: busy ? 0.7 : 1 }} onClick={confirmDelete} disabled={busy}>
                <IconTrash size={16} />
                {busy ? 'Suppression…' : 'Confirmer'}
              </button>
            </>
          ) : (
            <button type="button" style={s.dangerBtn} onClick={() => setConfirming(true)}>
              <IconTrash size={16} />
              Supprimer le compte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: { padding: '28px 32px', maxWidth: 1100, margin: '0 auto' },
  head: { marginBottom: 22 },
  title: { fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', margin: 0, color: 'var(--content-primary)' },
  subtitle: { color: 'var(--content-secondary)', fontSize: 14, margin: '6px 0 0' },

  grid: { display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: 20, alignItems: 'start' },
  formCard: { ...card },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  msg: { fontSize: 14, margin: 0 },

  listCard: { ...card },
  listHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  count: {
    minWidth: 26,
    height: 22,
    padding: '0 10px',
    borderRadius: 9999,
    background: 'var(--bg-neutral)',
    color: 'var(--content-primary)',
    fontSize: 13,
    fontWeight: 700,
    display: 'grid',
    placeItems: 'center',
  },
  empty: { color: 'var(--content-secondary)', fontSize: 14, padding: '24px 0', textAlign: 'center' },

  userList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid var(--border-neutral)',
    background: 'var(--bg-elevated)',
    width: '100%',
    textAlign: 'left',
    font: 'inherit',
    cursor: 'pointer',
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  userMain: { flex: 1, minWidth: 0 },
  userName: { fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--content-primary)' },
  userMeta: { color: 'var(--content-secondary)', fontSize: 12, marginTop: 2 },

  // Modale de détail du compte
  modal: { width: '100%', maxWidth: 460, padding: 22 },
  modalHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  modalUser: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  modalName: { fontSize: 17, fontWeight: 600, color: 'var(--content-primary)', marginBottom: 6, letterSpacing: '-0.02em' },
  iconBtn: {
    display: 'grid',
    placeItems: 'center',
    width: 34,
    height: 34,
    borderRadius: 9999,
    border: 'none',
    background: 'var(--bg-neutral)',
    color: 'var(--content-secondary)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  detailList: { display: 'flex', flexDirection: 'column', gap: 0, margin: 0 },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 16,
    padding: '10px 0',
    borderTop: '1px solid var(--border-neutral)',
  },
  detailLabel: { color: 'var(--content-secondary)', fontSize: 13, fontWeight: 600, flexShrink: 0 },
  detailValue: {
    color: 'var(--content-primary)',
    fontSize: 13.5,
    textAlign: 'right',
    wordBreak: 'break-word',
    margin: 0,
  },
  modalActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  selfNote: { color: 'var(--content-tertiary)', fontSize: 13, textAlign: 'right' },
  confirmNote: { color: 'var(--content-secondary)', fontSize: 13, fontWeight: 600, marginRight: 'auto' },
  dangerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'var(--negative-bg)',
    color: 'var(--negative)',
    border: 'none',
    borderRadius: 9999,
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
};
