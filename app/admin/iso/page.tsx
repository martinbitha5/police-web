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
    ref: 'PC-00',
    title: 'Périmètre et contexte',
    desc: 'Le périmètre de la certification (option A), le contexte, les parties intéressées.',
    file: 'PC-00-Perimetre-et-contexte.docx',
    purpose:
      "Le document fondateur : sur quoi porte la certification (le périmètre ATS, dont Police Bagage), dans quel contexte et pour qui. Tous les autres s'y rattachent.",
    todo: [
      'Faire valider le périmètre et le contexte par la direction.',
      "S'y référer dans tous les autres documents.",
    ],
    next: 'approuver le périmètre, puis vérifier que les autres documents sont bien alignés dessus.',
  },
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
      <style>{ISO_CSS}</style>
      <div style={s.page}>
        <AdminTabs />

        <div style={s.head}>
          <span style={eyebrow}>Administration</span>
          <h1 style={s.title}>Conformité ISO 27001</h1>
          <p style={s.lead}>
            La certification ISO/IEC 27001 porte sur <b>ATS</b> (African Transport Systems), pas sur
            une application : Police Bagage est l’un des systèmes couverts. La direction a retenu un
            périmètre centré sur les systèmes d’information numériques d’ATS (option A, voir PC-00).
            Ce dossier décrit l’état de préparation en vue d’un audit par un organisme accrédité.
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
                <div key={d.ref} className="isoItem">
                  <div className="isoRow">
                    <span className="isoRef">{d.ref}</span>
                    <span className="isoBody">
                      <span className="isoTitle">{d.title}</span>
                      <span className="isoDesc">{d.desc}</span>
                    </span>
                    <div className="isoActions">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : d.ref)}
                        className="isoGuideBtn"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? 'Masquer' : 'Comment l’utiliser'}
                      </button>
                      <a href={`/iso/${d.file}`} download className="isoDownload">
                        Télécharger
                      </a>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="isoGuide">
                      <p className="isoGuidePurpose">{d.purpose}</p>
                      <div className="isoGuideLabel">À faire</div>
                      <ul className="isoGuideList">
                        {d.todo.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                      <p className="isoGuideNext">
                        <span className="isoGuideNextLabel">Prochaine étape : </span>
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
  list: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--content-secondary)', lineHeight: 1.5 },
  inline: { fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-neutral)', padding: '1px 5px', borderRadius: 4 },
  callout: { marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--bg-neutral)', borderLeft: '3px solid var(--accent)', fontSize: 13.5, color: 'var(--content-secondary)', lineHeight: 1.5 },
};

// Liste des documents : classes CSS (plutôt qu'inline) pour permettre une media
// query. Sur mobile, la ligne s'empile — ref + titre, puis les actions dessous —
// au lieu de tout tasser sur une seule ligne.
const ISO_CSS = `
.isoItem { border-bottom: 1px solid var(--divider); }
.isoRow { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.isoRef { font-family: monospace; font-size: 12.5px; font-weight: 700; color: var(--content-primary); width: 64px; flex-shrink: 0; }
.isoBody { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.isoTitle { font-size: 14px; font-weight: 600; color: var(--content-primary); }
.isoDesc { font-size: 13px; color: var(--content-secondary); }
.isoActions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.isoGuideBtn { font-size: 12.5px; font-weight: 600; color: var(--content-secondary); background: transparent; border: none; padding: 6px 4px; cursor: pointer; white-space: nowrap; }
.isoDownload { font-size: 12.5px; font-weight: 600; color: var(--content-primary); text-decoration: none; background: var(--bg-neutral); border: 1px solid var(--divider); padding: 6px 14px; border-radius: 9999px; white-space: nowrap; }
.isoGuide { padding: 2px 0 14px 76px; display: flex; flex-direction: column; gap: 8px; }
.isoGuidePurpose { margin: 0; font-size: 13.5px; color: var(--content-secondary); line-height: 1.5; }
.isoGuideLabel { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--content-primary); }
.isoGuideList { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; font-size: 13.5px; color: var(--content-secondary); line-height: 1.5; }
.isoGuideNext { margin: 0; font-size: 13.5px; color: var(--content-secondary); line-height: 1.5; border-left: 3px solid var(--accent); padding-left: 10px; }
.isoGuideNextLabel { font-weight: 700; color: var(--content-primary); }

@media (max-width: 560px) {
  .isoRow { flex-wrap: wrap; row-gap: 10px; }
  .isoActions { width: 100%; }
  .isoGuideBtn { flex: 1; text-align: left; padding-left: 0; }
  .isoDownload { flex-shrink: 0; }
  .isoGuide { padding-left: 0; }
}
`;
