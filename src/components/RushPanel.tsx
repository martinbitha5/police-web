'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Baggage } from '@police/shared';
import { SOUTE_LABEL } from '@police/shared';
import { createClient } from '@/supabase/client';
import { useSession } from '@/components/AppShell';
import { card, btnPrimary, btnGhost, badge, sectionHeading } from '@/ui/theme';

const TAG_RE = /^\d{10}$/;

function formatTime(ts: string | null): string {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Gestion des bagages expédition rush d'un vol (colis sans passager).
 *
 * Deux modes :
 *  • full (page Bagages)    : formulaire d'annonce + les trois groupes
 *    (annoncés, à valider, suivi). C'est ici que le superviseur travaille.
 *  • compact (dashboard)    : l'essentiel pour réagir vite — les scannés en
 *    attente avec Autoriser / Refuser, et un lien vers la page Bagages.
 *
 * L'annonce vaut validation anticipée : la ligne est créée en rush_status
 * 'expected', et le scan de l'agent la passe à 'approved' tout seul. Annuler
 * une annonce la passe à 'denied' (on ne supprime jamais, l'historique reste).
 */
export function RushPanel({
  flightId,
  bags,
  canManage,
  onChanged,
  mode,
}: {
  flightId: string;
  bags: Baggage[];
  canManage: boolean;
  onChanged: () => void;
  mode: 'full' | 'compact';
}) {
  const profile = useSession();
  const [names, setNames] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rushTag: '', originalTag: '', origin: '', owner: '', note: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const expected = useMemo(() => bags.filter((b) => b.rush_status === 'expected'), [bags]);
  const pending = useMemo(() => bags.filter((b) => b.rush_status === 'pending'), [bags]);
  const others = useMemo(
    () => bags.filter((b) => b.rush_status === 'approved' || b.rush_status === 'denied'),
    [bags],
  );

  // Nom du passager d'origine pour les restants connus.
  useEffect(() => {
    const ids = [...new Set(bags.map((b) => b.passenger_id).filter((v): v is string => Boolean(v)))];
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data } = await createClient().from('passengers').select('id, full_name').in('id', ids);
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const r of (data as { id: string; full_name: string }[] | null) ?? []) map[r.id] = r.full_name;
      setNames(map);
    })();
    return () => { cancelled = true; };
  }, [bags]);

  async function decide(b: Baggage, status: 'approved' | 'denied') {
    setBusyId(b.id);
    // Garde sur le statut courant : deux superviseurs simultanés ne s'écrasent pas.
    await createClient()
      .from('baggage')
      .update({
        rush_status: status,
        rush_status_at: new Date().toISOString(),
        rush_status_by: profile?.id ?? null,
      })
      .eq('id', b.id)
      .eq('rush_status', 'pending');
    setBusyId(null);
    onChanged();
  }

  /** Annonce jamais présentée qu'on retire : denied + note, jamais de suppression. */
  async function cancelAnnouncement(b: Baggage) {
    setBusyId(b.id);
    await createClient()
      .from('baggage')
      .update({
        rush_status: 'denied',
        rush_status_at: new Date().toISOString(),
        rush_status_by: profile?.id ?? null,
        rush_note: b.rush_note ? `${b.rush_note} · Annonce annulée` : 'Annonce annulée',
      })
      .eq('id', b.id)
      .eq('rush_status', 'expected');
    setBusyId(null);
    onChanged();
  }

  async function announce() {
    const rushTag = form.rushTag.trim();
    const originalTag = form.originalTag.trim();
    if (!TAG_RE.test(rushTag)) {
      setFormError("Le numéro de l'étiquette RUSH doit faire 10 chiffres.");
      return;
    }
    if (originalTag && !TAG_RE.test(originalTag)) {
      setFormError("L'étiquette d'origine doit faire 10 chiffres (ou rester vide).");
      return;
    }
    if (originalTag && originalTag === rushTag) {
      setFormError('Les deux étiquettes sont identiques. Laissez l’origine vide si elle est inconnue.');
      return;
    }
    setSaving(true);
    setFormError(null);
    // Sans étiquette d'origine, la RUSH sert des deux côtés : c'est elle que
    // l'agent scannera, et le scan complétera l'origine s'il en trouve une.
    const main = originalTag || rushTag;
    const { error } = await createClient().from('baggage').insert({
      flight_id: flightId,
      kind: 'rush_forward',
      passenger_id: null,
      tag_number: main,
      issuer_code: main[0],
      airline_numeric_code: main.slice(1, 4),
      serial_number: main.slice(4, 10),
      rush_tag_number: rushTag,
      rush_serial_number: rushTag.slice(4, 10),
      rush_status: 'expected',
      announced_at: new Date().toISOString(),
      announced_by: profile?.id ?? null,
      rush_origin: form.origin.trim() || null,
      rush_owner_name: form.owner.trim() || null,
      rush_note: form.note.trim() || null,
      is_confirmed: false,
    });
    setSaving(false);
    if (error) {
      setFormError(
        error.code === '23505'
          ? 'Une ligne existe déjà pour cette étiquette sur ce vol.'
          : error.message,
      );
      return;
    }
    setForm({ rushTag: '', originalTag: '', origin: '', owner: '', note: '' });
    setShowForm(false);
    onChanged();
  }

  function ownerLabel(b: Baggage): string {
    if (b.passenger_id) return `Restant connu · bagage de ${names[b.passenger_id] ?? '…'}`;
    if (b.rush_owner_name) return `Propriétaire : ${b.rush_owner_name}`;
    return 'Bagage externe, provenance hors système';
  }

  function statusBadge(b: Baggage) {
    if (b.rush_status === 'expected')
      return <span style={{ ...badge, background: 'var(--bg-neutral)', color: 'var(--content-secondary)' }}>Annoncé</span>;
    if (b.rush_status === 'pending')
      return <span style={{ ...badge, background: 'var(--warning-bg)', color: 'var(--warning-content)' }}>En attente</span>;
    if (b.rush_status === 'denied')
      return <span style={{ ...badge, background: 'var(--negative-bg)', color: 'var(--negative)' }}>Refusé</span>;
    return <span style={{ ...badge, background: 'var(--positive-bg)', color: 'var(--positive)' }}>Autorisé</span>;
  }

  function BagRow({ b, actions }: { b: Baggage; actions?: React.ReactNode }) {
    const steps: string[] = [];
    if (b.on_dolly) steps.push(`Dolly ${formatTime(b.on_dolly_at)}`);
    if (b.soute) steps.push(`${SOUTE_LABEL[b.soute]} ${formatTime(b.soute_at)}`);
    if (b.in_hold) steps.push(`Chargé ${formatTime(b.in_hold_at)}`);
    if (b.arrived) steps.push(`Arrivé ${formatTime(b.arrived_at)}`);
    const meta = [
      ownerLabel(b),
      b.rush_origin ?? null,
      b.rush_status === 'expected'
        ? `annoncé à ${formatTime(b.announced_at)}`
        : `enregistré à ${formatTime(b.scanned_at)}`,
      steps.length > 0 ? steps.join(' · ') : null,
      b.rush_note ?? null,
    ].filter(Boolean);
    return (
      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {b.tag_number}
            {b.rush_tag_number && b.rush_tag_number !== b.tag_number ? (
              <span style={{ color: 'var(--content-secondary)', fontWeight: 400 }}> · RUSH {b.rush_tag_number}</span>
            ) : null}
          </div>
          <div style={{ color: 'var(--content-secondary)', fontSize: 13, marginTop: 2 }}>{meta.join(' · ')}</div>
        </div>
        {statusBadge(b)}
        {actions}
      </div>
    );
  }

  const list = (rows: Baggage[], actionsFor?: (b: Baggage) => React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((b) => (
        <BagRow key={b.id} b={b} actions={actionsFor?.(b)} />
      ))}
    </div>
  );

  const pendingActions = (b: Baggage) =>
    canManage ? (
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnPrimary} disabled={busyId === b.id} onClick={() => decide(b, 'approved')}>
          Autoriser
        </button>
        <button style={{ ...btnGhost, color: 'var(--negative)' }} disabled={busyId === b.id} onClick={() => decide(b, 'denied')}>
          Refuser
        </button>
      </div>
    ) : null;

  // ── Mode compact (dashboard) : l'urgence seulement ─────────────────────────
  if (mode === 'compact') {
    if (bags.length === 0) return null;
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={sectionHeading}>Expédition rush · bagages sans passager</h2>
          <a href={`/bagages?vol=${flightId}`} style={ps.manageLink}>
            Gérer les expéditions
          </a>
        </div>
        {pending.length > 0 ? (
          list(pending, pendingActions)
        ) : (
          <div style={{ color: 'var(--content-secondary)', fontSize: 14 }}>
            {expected.length > 0
              ? `${expected.length} bagage${expected.length > 1 ? 's' : ''} annoncé${expected.length > 1 ? 's' : ''}, en attente d'arrivée. Rien à valider.`
              : 'Rien à valider.'}
          </div>
        )}
      </div>
    );
  }

  // ── Mode full (page Bagages) : annonce + les trois groupes ─────────────────
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ ...sectionHeading, margin: 0 }}>Expédition rush · bagages sans passager</h2>
        {canManage ? (
          <button style={btnPrimary} onClick={() => { setShowForm((v) => !v); setFormError(null); }}>
            {showForm ? 'Fermer le formulaire' : 'Annoncer un bagage rush'}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div style={{ ...card, padding: 16, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: 'var(--content-secondary)', fontSize: 13 }}>
            Un bagage expédié annoncé ici sera autorisé automatiquement dès que l&apos;agent le scanne
            dans l&apos;écran Expédition rush du PDA.
          </div>
          <div style={ps.formRow}>
            <div style={ps.field}>
              <label style={ps.label}>Étiquette RUSH (10 chiffres)</label>
              <input
                style={ps.input}
                placeholder="0071170101"
                value={form.rushTag}
                onChange={(e) => setForm((f) => ({ ...f, rushTag: e.target.value.replace(/\D/g, '') }))}
                maxLength={10}
              />
            </div>
            <div style={ps.field}>
              <label style={ps.label}>Étiquette d&apos;origine (si connue)</label>
              <input
                style={ps.input}
                placeholder="Optionnelle"
                value={form.originalTag}
                onChange={(e) => setForm((f) => ({ ...f, originalTag: e.target.value.replace(/\D/g, '') }))}
                maxLength={10}
              />
            </div>
          </div>
          <div style={ps.formRow}>
            <div style={ps.field}>
              <label style={ps.label}>Provenance</label>
              <input
                style={ps.input}
                placeholder="Air Congo, arrivé de GMA"
                value={form.origin}
                onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
              />
            </div>
            <div style={ps.field}>
              <label style={ps.label}>Propriétaire (si connu)</label>
              <input
                style={ps.input}
                placeholder="MBUYI Jean"
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              />
            </div>
          </div>
          <div style={ps.field}>
            <label style={ps.label}>Note</label>
            <input
              style={ps.input}
              placeholder="Référence du message, remarque…"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          {formError ? <div style={{ color: 'var(--negative)', fontSize: 13 }}>{formError}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button style={btnGhost} disabled={saving} onClick={() => setShowForm(false)}>
              Annuler
            </button>
            <button style={btnPrimary} disabled={saving} onClick={() => void announce()}>
              {saving ? 'Enregistrement…' : 'Annoncer ce bagage'}
            </button>
          </div>
        </div>
      ) : null}

      {bags.length === 0 && !showForm ? (
        <div style={{ color: 'var(--content-secondary)', fontSize: 14, marginTop: 10 }}>
          Aucun bagage expédition rush sur ce vol.
        </div>
      ) : null}

      {expected.length > 0 ? (
        <>
          <h3 style={ps.groupTitle}>Annoncés, en attente d&apos;arrivée</h3>
          {list(expected, (b) =>
            canManage ? (
              <button
                style={{ ...btnGhost, color: 'var(--negative)' }}
                disabled={busyId === b.id}
                onClick={() => cancelAnnouncement(b)}
              >
                Annuler l&apos;annonce
              </button>
            ) : null,
          )}
        </>
      ) : null}

      {pending.length > 0 ? (
        <>
          <h3 style={ps.groupTitle}>Arrivés au scan, à valider</h3>
          {list(pending, pendingActions)}
        </>
      ) : null}

      {others.length > 0 ? (
        <>
          <h3 style={ps.groupTitle}>Suivi</h3>
          {list(others)}
        </>
      ) : null}
    </div>
  );
}

const ps: Record<string, CSSProperties> = {
  manageLink: { color: 'var(--content-link)', fontSize: 14, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '0.3em', whiteSpace: 'nowrap' },
  groupTitle: { margin: '16px 0 8px', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--content-secondary)', fontWeight: 600 },
  formRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 200 },
  label: { fontSize: 12, color: 'var(--content-secondary)', fontWeight: 600 },
  input: { background: 'var(--bg-elevated)', border: '1px solid var(--border-neutral)', borderRadius: 10, padding: '10px 12px', color: 'var(--content-primary)', fontSize: 14 },
};
