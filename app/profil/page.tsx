'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Profile } from '@police/shared';
import { createClient } from '@/supabase/client';
import { AppShell } from '@/components/AppShell';
import { card, btnPrimary, btnSecondary, input, label, sectionHeading } from '@/ui/theme';
import { ROLE_LABEL } from '@/ui/theme';
import { IconUser } from '@/components/icons';

const ROLE_TEXT: Record<string, string> = ROLE_LABEL;

/** Initiales d'un nom complet, deux lettres au plus, pour l'avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

function formatDate(ts: string | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ProfilPage() {
  return (
    <AppShell>
      <Profil />
    </AppShell>
  );
}

type Feedback = { kind: 'success' | 'error'; text: string } | null;

function Profil() {
  const isMobile = useIsMobile();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Bloc Informations
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<Feedback>(null);

  // Bloc Mot de passe
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setLoaded(true); return; }
      setUserId(auth.user.id);
      setEmail(auth.user.email ?? '');
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
      const p = (prof as Profile | null) ?? null;
      setProfile(p);
      setFullName(p?.full_name ?? '');
      setLoaded(true);
    })();
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const value = fullName.trim();
    if (value.length === 0) {
      setNameFeedback({ kind: 'error', text: 'Le nom complet ne peut pas être vide.' });
      return;
    }
    setSavingName(true);
    setNameFeedback(null);
    const { error } = await createClient().from('profiles').update({ full_name: value }).eq('id', userId);
    setSavingName(false);
    if (error) {
      setNameFeedback({ kind: 'error', text: error.message });
      return;
    }
    setProfile((prev) => (prev ? { ...prev, full_name: value } : prev));
    setNameFeedback({ kind: 'success', text: 'Nom mis à jour.' });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setPwFeedback({ kind: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' });
      return;
    }
    if (password !== confirm) {
      setPwFeedback({ kind: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }
    setSavingPassword(true);
    setPwFeedback(null);
    const { error } = await createClient().auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      setPwFeedback({ kind: 'error', text: error.message });
      return;
    }
    setPassword('');
    setConfirm('');
    setPwFeedback({ kind: 'success', text: 'Mot de passe modifié.' });
  }

  if (!loaded) {
    return (
      <div data-rv-auto style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
        <div style={s.loading}>Chargement…</div>
      </div>
    );
  }

  const roleLabel = profile?.role ? (ROLE_TEXT[profile.role] ?? profile.role) : '';
  const siteCode = profile?.airport_code ?? '';
  const airlineCode = profile?.airline_code ?? '';
  const avatarText = initials(profile?.full_name ?? '');

  return (
    <div style={isMobile ? { ...s.content, ...s.contentMobile } : s.content}>
      <div style={s.pageHeader}>
        <div style={s.avatarBig} aria-hidden>
          {avatarText || <IconUser size={26} />}
        </div>
        <div>
          <h1 style={s.pageTitle}>Mon profil</h1>
          <div style={s.pageSub}>Gérez vos informations et votre mot de passe.</div>
        </div>
      </div>

      {/* Récapitulatif en lecture */}
      <div style={{ ...card, marginBottom: 16 }}>
        <h2 style={sectionHeading}>Récapitulatif</h2>
        <div style={s.infoGrid}>
          <Info label="Nom complet" value={profile?.full_name || ''} />
          <Info label="E-mail" value={email} />
          <Info label="Rôle" value={roleLabel} />
          <Info
            label="Code aéroport / compagnie"
            value={siteCode && airlineCode ? `${siteCode} · ${airlineCode}` : siteCode || airlineCode}
          />
          <Info label="Membre depuis" value={formatDate(profile?.created_at ?? null)} />
        </div>
      </div>

      {/* Bloc Informations éditable */}
      <div style={{ ...card, marginBottom: 16 }}>
        <h2 style={sectionHeading}>Informations</h2>
        <form onSubmit={saveName} style={s.form}>
          <div style={s.field}>
            <label style={label} htmlFor="full_name">Nom complet</label>
            <input
              id="full_name"
              style={input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Votre nom complet"
              disabled={savingName}
            />
          </div>
          {nameFeedback ? <Pill feedback={nameFeedback} /> : null}
          <div style={s.actions}>
            <button type="submit" style={btnPrimary} disabled={savingName}>
              {savingName ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Bloc Mot de passe */}
      <div style={card}>
        <h2 style={sectionHeading}>Mot de passe</h2>
        <form onSubmit={changePassword} style={s.form}>
          <div style={s.field}>
            <label style={label} htmlFor="new_password">Nouveau mot de passe</label>
            <input
              id="new_password"
              type="password"
              style={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Au moins 8 caractères"
              autoComplete="new-password"
              disabled={savingPassword}
            />
          </div>
          <div style={s.field}>
            <label style={label} htmlFor="confirm_password">Confirmation</label>
            <input
              id="confirm_password"
              type="password"
              style={input}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Répétez le mot de passe"
              autoComplete="new-password"
              disabled={savingPassword}
            />
          </div>
          {pwFeedback ? <Pill feedback={pwFeedback} /> : null}
          <div style={s.actions}>
            {/* Second formulaire de l'écran : bouton secondaire, le primaire
                reste « Enregistrer ». */}
            <button type="submit" style={btnSecondary} disabled={savingPassword}>
              {savingPassword ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.info}>
      <span style={s.infoLabel}>{label}</span>
      <span style={s.infoValue}>{value || 'N/A'}</span>
    </div>
  );
}

function Pill({ feedback }: { feedback: NonNullable<Feedback> }) {
  const success = feedback.kind === 'success';
  return (
    <div
      style={{
        ...s.pill,
        background: success ? 'var(--positive-bg)' : 'var(--negative-bg)',
        color: success ? 'var(--positive)' : 'var(--negative)',
      }}
    >
      {feedback.text}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  content: { padding: 28, maxWidth: 720, margin: '0 auto', width: '100%' },
  contentMobile: { padding: '16px 14px' },

  loading: { color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', height: '50vh' },

  pageHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
  // Avatar : disque gris, initiales noires.
  avatarBig: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'var(--bg-neutral)',
    color: 'var(--content-primary)',
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  },
  pageTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 'var(--lh-title)',
    color: 'var(--content-primary)',
  },
  pageSub: { color: 'var(--content-secondary)', fontSize: 14, marginTop: 4 },

  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 },
  info: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  infoLabel: { ...label, fontSize: 13 },
  infoValue: { color: 'var(--content-primary)', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' },

  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  actions: { display: 'flex', justifyContent: 'flex-end' },

  // Retour de formulaire : bandeau rayon 8, la paire sémantique est posée
  // par Pill.
  pill: {
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 500,
  },
};
