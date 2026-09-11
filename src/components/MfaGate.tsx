'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/supabase/client';
import { card, btnPrimary, btnSecondary, input, label } from '@/ui/theme';

/**
 * Porte de double authentification (code à usage unique, TOTP) du portail web.
 *
 * Tout compte qui ouvre le back-office doit :
 *  - à sa première connexion, enrôler une application d'authentification
 *    (Google Authenticator, Microsoft Authenticator ou équivalent) ;
 *  - à chaque nouvelle session, saisir le code à six chiffres.
 * Tant que la session n'a pas atteint le niveau « aal2 », aucune page n'est
 * rendue. Les agents n'utilisent que le PDA : ils ne passent jamais par ici.
 *
 * Un compte qui a perdu son téléphone est débloqué par un administrateur
 * (Comptes, « Réinitialiser la double authentification ») : le portail lui
 * redemande alors un enrôlement.
 */

type Step =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'verify'; factorId: string }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'error'; text: string };

export function MfaGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Garde de réentrance : en développement React rejoue l'effet de montage, et
  // deux démarrages concurrents créeraient deux enrôlements (le second échoue
  // sur « facteur déjà existant »). Le ref survit au double montage.
  const running = useRef(false);

  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const supabase = createClient();
      const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalErr) { setStep({ kind: 'error', text: aalErr.message }); return; }
      if (aal?.currentLevel === 'aal2') { setStep({ kind: 'ready' }); return; }

      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) { setStep({ kind: 'error', text: fErr.message }); return; }
      const verified = factors?.totp.find((f) => f.status === 'verified');
      if (verified) { setStep({ kind: 'verify', factorId: verified.id }); return; }

      // Enrôlements abandonnés (facteurs jamais vérifiés) : on les retire, sinon
      // Supabase refuse un nouvel enrôlement portant le même nom. Une seconde
      // tentative couvre le cas d'un facteur créé entre-temps.
      const enrollFresh = async () => {
        const { data: current } = await supabase.auth.mfa.listFactors();
        for (const f of current?.all ?? []) {
          if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        return supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Police Bagage' });
      };
      let { data: enr, error: eErr } = await enrollFresh();
      if (eErr && /already exists/i.test(eErr.message)) ({ data: enr, error: eErr } = await enrollFresh());
      if (eErr || !enr) { setStep({ kind: 'error', text: eErr?.message ?? 'Enrôlement impossible.' }); return; }
      setStep({ kind: 'enroll', factorId: enr.id, qr: enr.totp.qr_code, secret: enr.totp.secret });
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => { void start(); }, [start]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== 'verify' && step.kind !== 'enroll') return;
    const digits = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(digits)) {
      setError("Saisissez les six chiffres affichés par votre application d'authentification.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: vErr } = await createClient().auth.mfa.challengeAndVerify({ factorId: step.factorId, code: digits });
    setBusy(false);
    if (vErr) {
      setError('Code incorrect ou expiré. Réessayez avec le code affiché en ce moment.');
      setCode('');
      return;
    }
    setCode('');
    setStep({ kind: 'ready' });
    router.refresh();
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace('/login');
  }

  if (step.kind === 'ready') return <>{children}</>;
  if (step.kind === 'loading') return <div style={s.center}>Vérification de la session…</div>;

  if (step.kind === 'error') {
    return (
      <div style={s.wrap}>
        <div style={s.panel}>
          <h1 style={s.title}>Double authentification indisponible</h1>
          <p style={s.text}>{step.text}</p>
          <div style={s.actions}>
            <button type="button" style={btnSecondary} onClick={logout}>Se déconnecter</button>
            <button type="button" style={btnPrimary} onClick={() => { setStep({ kind: 'loading' }); void start(); }}>Réessayer</button>
          </div>
        </div>
      </div>
    );
  }

  const enrolling = step.kind === 'enroll';

  return (
    <div style={s.wrap}>
      <form onSubmit={submit} style={s.panel}>
        <h1 style={s.title}>{enrolling ? 'Activer la double authentification' : 'Code de vérification'}</h1>
        <p style={s.text}>
          {enrolling
            ? "Pour protéger l'accès au portail, chaque connexion demande désormais un code à usage unique. Installez une application d'authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator ou équivalent), scannez ce code, puis saisissez les six chiffres affichés."
            : "Ouvrez votre application d'authentification et saisissez le code à six chiffres associé à Police Bagage."}
        </p>

        {enrolling ? (
          <div style={s.qrBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={step.qr} alt="Code à scanner avec votre application d'authentification" style={s.qr} />
            <div style={s.secretBox}>
              <span style={s.secretLabel}>Clé à saisir à la main si le scan échoue</span>
              <code style={s.secret}>{step.secret}</code>
            </div>
          </div>
        ) : null}

        <div style={s.field}>
          <label style={label} htmlFor="mfa_code">Code à six chiffres</label>
          <input
            id="mfa_code"
            style={{ ...input, ...s.codeInput }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            autoFocus
            disabled={busy}
          />
        </div>

        {error ? <p style={s.error}>{error}</p> : null}

        <div style={s.actions}>
          <button type="button" style={btnSecondary} onClick={logout} disabled={busy}>Se déconnecter</button>
          <button type="submit" style={btnPrimary} disabled={busy || code.length !== 6}>
            {busy ? 'Vérification…' : enrolling ? 'Activer' : 'Valider'}
          </button>
        </div>
      </form>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  center: { color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', height: '60vh' },
  wrap: { display: 'grid', placeItems: 'center', minHeight: '70vh', padding: 24 },
  panel: { ...card, width: '100%', maxWidth: 460, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 'var(--lh-title)',
    color: 'var(--content-primary)',
  },
  text: { margin: 0, color: 'var(--content-secondary)', fontSize: 14, lineHeight: 1.55 },
  qrBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' },
  qr: { width: 184, height: 184, display: 'block', background: '#fff', borderRadius: 8, border: '1px solid var(--divider)' },
  secretBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' },
  secretLabel: { color: 'var(--content-tertiary)', fontSize: 12 },
  secret: { fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.08em', wordBreak: 'break-all', textAlign: 'center', color: 'var(--content-primary)' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  codeInput: { fontVariantNumeric: 'tabular-nums', letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' },
  error: {
    color: 'var(--negative)',
    background: 'var(--negative-bg)',
    borderRadius: 8,
    padding: '10px 14px',
    margin: 0,
    fontSize: 14,
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
};
