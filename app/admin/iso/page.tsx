'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AdminOnly } from '@/components/AdminGuard';
import { AdminTabs } from '@/components/AdminTabs';
import { card, eyebrow } from '@/ui/theme';

// Vue d'ensemble de la readiness ISO/IEC 27001. Contenu de référence (les
// documents détaillés vivent dans le dépôt, docs/iso27001/). Purement informatif.
// La légende « Comment l'utiliser » reprend mot pour mot celle en tête de chaque
// document Word (docs/iso27001/*.md), pour la voir sur le site avant de télécharger.

type Doc = {
  ref: string;
  title: string;
  desc: string;
  file: string;
  purpose: string;
  todo: string[];
  next: string;
};

const DOCS: Doc[] = [
  {
    ref: 'PSI-01',
    title: 'Politique de sécurité',
    desc: 'Engagement, périmètre, principes, rôles.',
    file: 'PSI-01-Politique-securite.docx',
    purpose:
      "L'engagement de la direction sur la sécurité. C'est le texte de référence dont tous les autres découlent.",
    todo: [
      'La direction le lit et complète les champs « à définir », surtout : qui est responsable de la sécurité.',
      "La direction l'approuve et le date en dernière page.",
    ],
    next: 'nommer la personne responsable de la sécurité, puis faire approuver ce document.',
  },
  {
    ref: 'RR-02',
    title: 'Registre des risques',
    desc: 'Risques cotés, traitement, statut, issus de l’audit.',
    file: 'RR-02-Registre-des-risques.docx',
    purpose:
      "La liste de vos risques, avec leur gravité et leur état de traitement. C'est le document que vous consulterez le plus souvent.",
    todo: [
      'Relire les risques et confirmer ceux que vous acceptez tels quels.',
      'Pour les risques encore ouverts (portail public, double authentification, appareil mobile perdu), décider quoi faire et fixer une date.',
      'Le mettre à jour après chaque correctif ou incident.',
    ],
    next: 'traiter en priorité les trois risques les plus élevés encore ouverts.',
  },
  {
    ref: 'SOA-03',
    title: 'Déclaration d’Applicabilité',
    desc: 'Les 93 mesures de l’annexe A, applicabilité et état.',
    file: 'SOA-03-Declaration-applicabilite.docx',
    purpose:
      "La liste complète des 93 mesures de la norme et votre position sur chacune. Elle sert surtout de référence à l'auditeur.",
    todo: [
      "L'utiliser comme une liste de contrôle, sans chercher à tout remplir d'un coup.",
      'Planifier progressivement les lignes marquées « à faire ».',
    ],
    next: 'choisir trois à cinq mesures « à faire » à traiter ce trimestre.',
  },
  {
    ref: 'PGI-04',
    title: 'Gestion des incidents',
    desc: 'Signalement, réponse, préservation des preuves.',
    file: 'PGI-04-Gestion-des-incidents.docx',
    purpose:
      'La marche à suivre quand un problème de sécurité survient (compte compromis, appareil volé, fuite).',
    todo: [
      'Le faire lire à toute l’équipe pour que les bons réflexes soient connus.',
      'Définir clairement le canal de signalement : qui appeler, comment.',
      'Faire une fois un exercice sur table, par exemple « un PDA a été volé ».',
    ],
    next: 'désigner qui reçoit les signalements et commencer à tenir le registre des incidents.',
  },
  {
    ref: 'RD-05',
    title: 'Revue de direction',
    desc: 'Pilotage par la direction, indicateurs.',
    file: 'RD-05-Revue-de-direction.docx',
    purpose:
      'La réunion par laquelle la direction pilote la sécurité et prend les décisions.',
    todo: [
      "Planifier et tenir une première vraie réunion (l'ordre du jour est fourni à la fin du document).",
      'En rédiger un compte rendu daté.',
    ],
    next: 'fixer la date de la première revue de direction. Le compte rendu daté est une preuve que l’auditeur demande.',
  },
  {
    ref: 'AI-06',
    title: 'Audit interne',
    desc: 'Vérification planifiée, plan d’audit.',
    file: 'AI-06-Audit-interne.docx',
    purpose:
      'Le contrôle interne planifié qui vérifie que tout fonctionne réellement, pas seulement sur le papier.',
    todo: [
      "Faire auditer un domaine par une personne qui n'en est pas responsable.",
      'Consigner les écarts trouvés et les corriger.',
    ],
    next: 'réaliser un premier audit interne avant de contacter un certificateur. Si l’indépendance est difficile en interne, prévoir un auditeur externe.',
  },
  {
    ref: 'DR-07',
    title: 'Sauvegarde et reprise',
    desc: 'RPO/RTO, procédure, test de restauration.',
    file: 'DR-07-Sauvegarde-et-reprise.docx',
    purpose: 'Comment sauvegarder vos données et les restaurer en cas d’incident.',
    todo: [
      'Mettre en place les sauvegardes (l’offre Supabase Pro est conseillée pour les sauvegardes quotidiennes).',
      'Lancer une sauvegarde, puis tester une restauration dans une copie isolée, jamais sur la production.',
      'Noter le résultat daté dans le journal du document.',
    ],
    next: 'réaliser et dater un premier test de restauration. C’est la preuve clé exigée pour la certification.',
  },
];

const REMAINING = [
  'Faire approuver formellement les documents (ils sont en projet).',
  'Tenir une vraie revue de direction et un audit interne, avec comptes rendus.',
  'Réaliser et dater un test de restauration de sauvegarde.',
  'Imposer la MFA aux comptes admin et superviseur.',
  'Trancher l’exposition du portail public de suivi.',
];

export default function IsoPage() {
  const [open, setOpen] = useState<string | null>(null);
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
            {DOCS.map((d) => {
              const isOpen = open === d.ref;
              return (
                <div key={d.ref} style={s.docItem}>
                  <div style={s.docRow}>
                    <span style={s.docRef}>{d.ref}</span>
                    <span style={s.docBody}>
                      <span style={s.docTitle}>{d.title}</span>
                      <span style={s.docDesc}>{d.desc}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : d.ref)}
                      style={s.guideBtn}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? 'Masquer' : 'Comment l’utiliser'}
                    </button>
                    <a href={`/iso/${d.file}`} download style={s.download}>
                      Télécharger
                    </a>
                  </div>
                  {isOpen && (
                    <div style={s.guide}>
                      <p style={s.guidePurpose}>{d.purpose}</p>
                      <div style={s.guideLabel}>À faire</div>
                      <ul style={s.guideList}>
                        {d.todo.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                      <p style={s.guideNext}>
                        <span style={s.guideNextLabel}>Prochaine étape : </span>
                        {d.next}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
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
  docItem: { borderBottom: '1px solid var(--divider)' },
  docRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' },
  docRef: { fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--content-primary)', width: 64, flexShrink: 0 },
  docBody: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  docTitle: { fontSize: 14, fontWeight: 600, color: 'var(--content-primary)' },
  docDesc: { fontSize: 13, color: 'var(--content-secondary)' },
  guideBtn: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--content-secondary)',
    background: 'transparent',
    border: 'none',
    padding: '5px 4px',
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  guide: { padding: '2px 0 14px 76px', display: 'flex', flexDirection: 'column', gap: 8 },
  guidePurpose: { margin: 0, fontSize: 13.5, color: 'var(--content-secondary)', lineHeight: 1.5 },
  guideLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--content-primary)' },
  guideList: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.5, color: 'var(--content-secondary)', lineHeight: 1.5 },
  guideNext: { margin: 0, fontSize: 13.5, color: 'var(--content-secondary)', lineHeight: 1.5, borderLeft: '3px solid var(--accent)', paddingLeft: 10 },
  guideNextLabel: { fontWeight: 700, color: 'var(--content-primary)' },
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
