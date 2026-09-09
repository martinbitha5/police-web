'use client';

import type { CSSProperties, ReactNode } from 'react';
import { AdminOnly } from '@/components/AdminGuard';
import { AdminTabs } from '@/components/AdminTabs';
import { card, eyebrow } from '@/ui/theme';

// Vue d'ensemble de la readiness ISO/IEC 27001. Contenu de référence (les
// documents détaillés vivent dans le dépôt, docs/iso27001/). Purement informatif.

const DOCS: { ref: string; title: string; desc: string; file: string }[] = [
  { ref: 'PSI-01', title: 'Politique de sécurité', desc: 'Engagement, périmètre, principes, rôles.', file: 'PSI-01-Politique-securite.docx' },
  { ref: 'RR-02', title: 'Registre des risques', desc: 'Risques cotés, traitement, statut, issus de l’audit.', file: 'RR-02-Registre-des-risques.docx' },
  { ref: 'SOA-03', title: 'Déclaration d’Applicabilité', desc: 'Les 93 mesures de l’annexe A, applicabilité et état.', file: 'SOA-03-Declaration-applicabilite.docx' },
  { ref: 'PGI-04', title: 'Gestion des incidents', desc: 'Signalement, réponse, préservation des preuves.', file: 'PGI-04-Gestion-des-incidents.docx' },
  { ref: 'RD-05', title: 'Revue de direction', desc: 'Pilotage par la direction, indicateurs.', file: 'RD-05-Revue-de-direction.docx' },
  { ref: 'AI-06', title: 'Audit interne', desc: 'Vérification planifiée, plan d’audit.', file: 'AI-06-Audit-interne.docx' },
  { ref: 'DR-07', title: 'Sauvegarde et reprise', desc: 'RPO/RTO, procédure, test de restauration.', file: 'DR-07-Sauvegarde-et-reprise.docx' },
];

const REMAINING = [
  'Faire approuver formellement les documents (ils sont en projet).',
  'Tenir une vraie revue de direction et un audit interne, avec comptes rendus.',
  'Réaliser et dater un test de restauration de sauvegarde.',
  'Imposer la MFA aux comptes admin et superviseur.',
  'Trancher l’exposition du portail public de suivi.',
];

export default function IsoPage() {
  return (
    <AdminOnly>
      <div style={s.page}>
        <AdminTabs />

        <div style={s.head}>
          <span style={eyebrow}>Administration</span>
          <h1 style={s.title}>Conformité ISO 27001</h1>
          <p style={s.lead}>
            Police Bagage n’est <b>pas</b> certifié ISO/IEC 27001. Ce dossier décrit un état de
            préparation (readiness) en vue d’un audit par un organisme accrédité. La certification
            elle-même passe par cet organisme, après mise en œuvre effective et tenue des preuves.
          </p>
        </div>

        <div style={s.statRow}>
          <Stat value="≈ 22" label="constats résolus" tone="good" />
          <Stat value="8" label="constats restants" tone="warn" />
          <Stat value="3 / 3" label="critiques fermés" tone="good" />
        </div>

        <div style={{ ...card, ...s.section }}>
          <h2 style={s.h2}>Documents du système de management (SMSI)</h2>
          <p style={s.note}>
            Rédigés et versionnés dans le dépôt (<code style={s.inline}>docs/iso27001/</code>). Statut :
            projets à approuver par la direction.
          </p>
          <div style={s.docs}>
            {DOCS.map((d) => (
              <div key={d.ref} style={s.docRow}>
                <span style={s.docRef}>{d.ref}</span>
                <span style={s.docBody}>
                  <span style={s.docTitle}>{d.title}</span>
                  <span style={s.docDesc}>{d.desc}</span>
                </span>
                <a href={`/iso/${d.file}`} download style={s.download}>
                  Télécharger
                </a>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, ...s.section }}>
          <h2 style={s.h2}>Ce qui reste avant de contacter un certificateur</h2>
          <ul style={s.list}>
            {REMAINING.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div style={s.callout}>
            La sécurité technique est bien avancée (base durcie, journal d’audit inaltérable, portails
            protégés). Le plus gros du chemin restant est organisationnel : faire vivre le système
            (revues, audits internes) et accumuler des preuves sur plusieurs mois.
          </div>
        </div>
      </div>
    </AdminOnly>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: 'good' | 'warn' }) {
  return (
    <div style={{ ...card, ...s.stat }}>
      <div style={{ ...s.statValue, color: tone === 'good' ? 'var(--accent)' : 'var(--content-primary)' }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: { padding: '20px 24px 40px', maxWidth: 860, margin: '0 auto' },
  head: { marginBottom: 20 },
  title: { fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--content-primary)', margin: '4px 0 8px' },
  lead: { fontSize: 15, color: 'var(--content-secondary)', lineHeight: 1.55, margin: 0 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  stat: { textAlign: 'center', padding: 16 },
  statValue: { fontSize: 24, fontWeight: 700 },
  statLabel: { fontSize: 12.5, color: 'var(--content-secondary)', marginTop: 2 },
  section: { marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 600, color: 'var(--content-primary)', margin: '0 0 12px' },
  note: { fontSize: 14, color: 'var(--content-secondary)', lineHeight: 1.55, margin: '0 0 12px' },
  docs: { display: 'flex', flexDirection: 'column', gap: 0 },
  docRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--divider)' },
  docRef: { fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--content-primary)', width: 64, flexShrink: 0 },
  docBody: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  docTitle: { fontSize: 14, fontWeight: 600, color: 'var(--content-primary)' },
  docDesc: { fontSize: 13, color: 'var(--content-secondary)' },
  download: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--content-primary)',
    textDecoration: 'none',
    background: 'var(--bg-neutral)',
    border: '1px solid var(--divider)',
    padding: '5px 12px',
    borderRadius: 9999,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  list: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--content-secondary)', lineHeight: 1.5 },
  inline: { fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-neutral)', padding: '1px 5px', borderRadius: 4 },
  callout: { marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--bg-neutral)', borderLeft: '3px solid var(--accent)', fontSize: 13.5, color: 'var(--content-secondary)', lineHeight: 1.5 },
};
