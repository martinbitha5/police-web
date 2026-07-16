'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, UserRole } from '@police/shared';
import { AppShell, useSession } from '@/components/AppShell';
import { card, btnPrimary, input, label, sectionHeading, badge, ROLE_COLOR, ROLE_LABEL } from '@/ui/theme';
import { IconPlus, IconUser } from '@/components/icons';

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
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/list-users');
      const json = await res.json();
      if (res.ok) setUsers((json.users as Profile[]) ?? []);
    } catch {
      // silencieux — la liste reste vide
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <div style={s.page}>
      <header style={s.head}>
        <div>
          <h1 style={s.title}>Gestion des comptes</h1>
          <p style={s.subtitle}>Créer et consulter les comptes agents, superviseurs et administrateurs.</p>
        </div>
      </header>

      <div style={s.grid}>
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
              <Field label="Gate assignée">
                <input style={input} placeholder="Gate 3" value={form.gate} onChange={(e) => update('gate', e.target.value)} />
              </Field>
            ) : null}
            {form.role !== 'agent' ? (
              <>
                <Field label="Aéroport (code IATA)">
                  <input style={input} placeholder="FIH, FBM, GMN…" value={form.airport_code} onChange={(e) => update('airport_code', e.target.value.toUpperCase())} maxLength={4} />
                </Field>
                <Field label="Compagnie (code IATA)">
                  <input style={input} placeholder="ET" value={form.airline_code} onChange={(e) => update('airline_code', e.target.value.toUpperCase())} maxLength={3} />
                </Field>
              </>
            ) : null}

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
                <UserRow key={u.id} user={u} />
              ))}
            </div>
          )}
        </section>
      </div>
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

function UserRow({ user }: { user: Profile }) {
  const color = ROLE_COLOR[user.role] ?? 'var(--content-secondary)';
  const created = user.created_at
    ? new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  return (
    <div style={s.userRow}>
      <div style={{ ...s.userAvatar, background: color }}>
        <IconUser size={18} />
      </div>
      <div style={s.userMain}>
        <div style={s.userName}>{user.full_name}</div>
        <div style={s.userMeta}>
          {user.airport_code ? `${user.airport_code}${user.airline_code ? ' · ' + user.airline_code : ''} · ` : ''}
          {user.gate ? `${user.gate} · ` : ''}
          Créé le {created}
        </div>
      </div>
      <span style={{ ...badge, color }}>{ROLE_LABEL[user.role] ?? user.role}</span>
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
};
