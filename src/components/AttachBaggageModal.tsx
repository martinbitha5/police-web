'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { FraudAlert } from '@police/shared';
import { createClient } from '@/supabase/client';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { PassengerRow } from '@/useFlightData';
import { btnPrimary, btnSecondary, badge, eyebrow, input as inputStyle, modalOverlay, modalPanel, sectionHeading } from '@/ui/theme';
import { IconClose } from '@/components/icons';

/**
 * Rattacher une étiquette orpheline (alerte règle 1) à un passager du vol.
 *
 * Cas terrain : le boarding pass porte 2 bagages, le comptoir encaisse un
 * excédent et imprime une 3e étiquette sans réimprimer le pass. Au tapis, la
 * 3e étiquette n'est sur aucun boarding pass : rejet, alerte sans nom. Ici le
 * superviseur fait à la main, à son nom et avec un motif, ce qu'un pass
 * réimprimé aurait fait : la ligne bagage est créée, l'alerte se ferme, et le
 * sac repasse au tapis comme les autres. Aucune règle n'est contournée.
 *
 * Deux temps : choisir le passager (liste complète du vol, champ de recherche),
 * puis confirmer avec un motif obligatoire. L'écriture est une seule
 * transaction côté base (fonction attach_orphan_baggage).
 */
export function AttachBaggageModal({
  alert,
  flightId,
  passengers,
  onClose,
  onDone,
}: {
  alert: FraudAlert;
  flightId: string;
  passengers: PassengerRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PassengerRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Séries d'étiquettes par passager : sert uniquement à suggérer le candidat
  // dont la plage est contiguë (S, S+1 pour une étiquette S+2). Une
  // suggestion, jamais une attribution : le superviseur choisit.
  const [serialsByPax, setSerialsByPax] = useState<Map<string, number[]>>(new Map());

  const tag = (alert.tag_number ?? '').replace(/\D/g, '');
  const orphanSerial = tag.length === 10 ? parseInt(tag.slice(4, 10), 10) : NaN;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await createClient()
        .from('baggage')
        .select('passenger_id, serial_number')
        .eq('flight_id', flightId)
        .eq('kind', 'passenger')
        .eq('cancelled', false);
      if (cancelled) return;
      const map = new Map<string, number[]>();
      for (const r of (data as { passenger_id: string | null; serial_number: string | null }[] | null) ?? []) {
        if (!r.passenger_id || !r.serial_number) continue;
        const n = parseInt(r.serial_number, 10);
        if (Number.isNaN(n)) continue;
        map.set(r.passenger_id, [...(map.get(r.passenger_id) ?? []), n]);
      }
      setSerialsByPax(map);
    })();
    return () => { cancelled = true; };
  }, [flightId]);

  function contiguous(p: PassengerRow): boolean {
    if (Number.isNaN(orphanSerial)) return false;
    const serials = serialsByPax.get(p.id);
    if (!serials || serials.length === 0) return false;
    return serials.some((s) => Math.abs(s - orphanSerial) === 1);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? passengers.filter(
          (p) =>
            p.full_name.toLowerCase().includes(q) ||
            p.pnr.toLowerCase().includes(q) ||
            (p.seat ?? '').toLowerCase().includes(q) ||
            (p.ticket_number ?? '').includes(q),
        )
      : passengers;
    // Candidat contigu en tête, puis l'ordre alphabétique déjà en place.
    return [...filtered].sort((a, b) => Number(contiguous(b)) - Number(contiguous(a)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengers, search, serialsByPax, orphanSerial]);

  async function attach() {
    if (!selected) return;
    const why = reason.trim();
    if (!why) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc('attach_orphan_baggage', {
      p_alert_id: alert.id,
      p_passenger_id: selected.id,
      p_reason: why,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onDone();
  }

  const nextQuota = selected ? selected.quota + 1 : 0;

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={isMobile ? { ...s.panel, ...s.panelMobile } : s.panel} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ ...sectionHeading, margin: 0, fontSize: isMobile ? 17 : 20 }}>
              Rattacher l&apos;étiquette {tag || alert.tag_number || 'N/A'}
            </h2>
            <div style={s.sub}>
              Écartée à {new Date(alert.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {alert.gate ? ` · ${alert.gate}` : ''}
            </div>
          </div>
          <button type="button" style={s.close} onClick={onClose} aria-label="Fermer">
            <IconClose size={18} />
          </button>
        </div>

        {alert.note ? <div style={s.note}>{alert.note}</div> : null}

        {!selected ? (
          <>
            <input
              style={inputStyle}
              placeholder="Nom, PNR, siège ou numéro de billet"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div style={s.list}>
              {rows.length === 0 ? (
                <div style={s.empty}>
                  {passengers.length === 0 ? 'Aucun passager enregistré sur ce vol.' : 'Aucun passager ne correspond.'}
                </div>
              ) : (
                rows.map((p) => {
                  const hint = contiguous(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      style={{ ...s.row, ...(p.offloaded ? s.rowDisabled : {}) }}
                      disabled={p.offloaded}
                      onClick={() => { setSelected(p); setError(null); }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={s.rowName}>{p.full_name}</div>
                        <div style={s.rowMeta}>
                          PNR {p.pnr} · Siège {p.seat ?? 'N/A'}
                          {p.offloaded ? ' · Débarqué' : p.quota === 0 ? ' · Voyage sans bagage déclaré' : ''}
                        </div>
                      </div>
                      <div style={s.rowRight}>
                        {hint ? <span style={{ ...badge, background: 'var(--accent-soft)', color: 'var(--accent)' }}>Série contiguë</span> : null}
                        <span style={s.rowCount}>
                          {p.confirmedCount}/{p.quota}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div style={s.confirm}>
            <div style={eyebrow}>Confirmation</div>
            <div style={s.recap}>
              <div style={s.recapLine}>
                <span style={s.recapLabel}>Étiquette</span>
                <span style={s.recapValue}>{tag}</span>
              </div>
              <div style={s.recapLine}>
                <span style={s.recapLabel}>Passager</span>
                <span style={s.recapValue}>
                  {selected.full_name} · PNR {selected.pnr} · Siège {selected.seat ?? 'N/A'}
                </span>
              </div>
              <div style={s.recapLine}>
                <span style={s.recapLabel}>Bagages autorisés</span>
                <span style={s.recapValue}>
                  {selected.quota} → {nextQuota}
                  {selected.attachedCount > 0 ? ` (dont ${selected.attachedCount + 1} par le superviseur)` : ''}
                </span>
              </div>
            </div>
            {selected.declared_baggage_count === 0 ? (
              <div style={s.warn}>
                Le boarding pass de ce passager ne déclare aucun bagage. Vérifiez que l&apos;excédent a bien été
                encaissé au comptoir avant de rattacher.
              </div>
            ) : null}
            <div style={s.hint}>
              Le sac devra repasser au tapis. Cette décision est tracée à votre nom dans le journal.
            </div>
            <input
              style={inputStyle}
              placeholder="Motif obligatoire (excédent payé, reçu n°…)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            {error ? <div style={{ color: 'var(--negative)', fontSize: 13 }}>{error}</div> : null}
            <div style={s.actions}>
              <button type="button" style={btnSecondary} disabled={busy} onClick={() => { setSelected(null); setError(null); }}>
                Retour
              </button>
              <button type="button" style={btnPrimary} disabled={busy || reason.trim().length === 0} onClick={() => void attach()}>
                {busy ? 'En cours…' : 'Rattacher'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  panel: { ...modalPanel, width: 560, maxWidth: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh' },
  panelMobile: { width: '100%', padding: 16, gap: 12, maxHeight: '92vh' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sub: { color: 'var(--content-secondary)', fontSize: 13, marginTop: 4 },
  close: { background: 'transparent', border: 'none', color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, cursor: 'pointer' },
  note: { background: 'var(--bg-neutral)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--content-secondary)' },
  // La liste défile seule : l'en-tête et le champ de recherche restent en vue.
  list: { display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 120, borderTop: '1px solid var(--divider)' },
  empty: { padding: '24px 4px', color: 'var(--content-secondary)', fontSize: 14, textAlign: 'center' },
  row: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 4px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--divider)', font: 'inherit', color: 'var(--content-primary)', textAlign: 'left', cursor: 'pointer' },
  rowDisabled: { opacity: 0.5, cursor: 'not-allowed', textDecoration: 'line-through' },
  rowName: { fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' },
  rowMeta: { color: 'var(--content-secondary)', fontSize: 13, marginTop: 2 },
  rowRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  rowCount: { fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 14, minWidth: 34, textAlign: 'right' },
  confirm: { display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--divider)', paddingTop: 12 },
  recap: { display: 'flex', flexDirection: 'column', gap: 6 },
  recapLine: { display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' },
  recapLabel: { color: 'var(--content-secondary)', fontSize: 13, minWidth: 130 },
  recapValue: { fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' },
  warn: { background: 'var(--warning-bg)', color: 'var(--warning-content)', borderRadius: 8, padding: '10px 12px', fontSize: 13 },
  hint: { color: 'var(--content-secondary)', fontSize: 13 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
};
