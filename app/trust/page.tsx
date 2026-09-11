import type { CSSProperties } from 'react';
import { LegalShell, LegalSection, LegalRow, P } from '@/components/LegalShell';

export const metadata = {
  title: 'Trust Center · Police Bagage',
  description: 'Sécurité, conformité et sous-traitants de la plateforme Police Bagage, éditée par African Transport Systems.',
};

/**
 * Trust Center public : ce que la plateforme met en place pour protéger les
 * données, où en est la démarche de certification, et qui sont les
 * sous-traitants. Tout ce qui est écrit ici doit être vrai et vérifiable ;
 * ce qui n'est pas encore en place est marqué « en cours ».
 */

const UPDATED = '11 septembre 2026';
const CONTACT = 'contact@ats-handling-rdc.com';

type Ctrl = { text: string; state?: 'en place' | 'en cours' };
const CONTROLS: { title: string; items: Ctrl[] }[] = [
  {
    title: 'Sécurité de l’infrastructure',
    items: [
      { text: 'Échanges chiffrés de bout en bout (HTTPS / TLS) entre les applications et les serveurs' },
      { text: 'Données hébergées dans l’Union européenne (Supabase, région eu-west-1)' },
      { text: 'Cloisonnement des données par compagnie et par escale, appliqué dans la base (RLS)' },
      { text: 'Clé de service confinée au serveur, jamais exposée aux applications' },
      { text: 'Sauvegardes et procédure de restauration documentées', state: 'en cours' },
    ],
  },
  {
    title: 'Sécurité organisationnelle',
    items: [
      { text: 'Politique de sécurité de l’information approuvée par la direction', state: 'en cours' },
      { text: 'Rôles et responsabilités de sécurité définis (direction, responsable informatique, administrateur)' },
      { text: 'Procédure de gestion des incidents de sécurité' },
      { text: 'Registre des risques tenu et revu' },
      { text: 'Revue de direction et audit interne planifiés', state: 'en cours' },
    ],
  },
  {
    title: 'Sécurité du produit',
    items: [
      { text: 'Double authentification obligatoire sur le portail superviseur (code à usage unique)' },
      { text: 'Comptes nominatifs avec rôles distincts : administrateur, superviseur, agent' },
      { text: 'Application mobile des agents distribuée en test fermé, sur liste nominative' },
      { text: 'Journal des opérations inaltérable pour les actions sensibles' },
      { text: 'Validation des entrées et limitation de débit sur l’API' },
      { text: 'Audit de sécurité et test d’intrusion réalisés en septembre 2026, vulnérabilités critiques corrigées' },
    ],
  },
  {
    title: 'Procédures internes',
    items: [
      { text: 'Code source sous contrôle de version, modifications de schéma versionnées' },
      { text: 'Suivi et correction des vulnérabilités des dépendances' },
      { text: 'Vérification automatique de la disponibilité des services, toutes les cinq minutes' },
      { text: 'Environnement de préproduction séparé de la production', state: 'en cours' },
    ],
  },
  {
    title: 'Données et vie privée',
    items: [
      { text: 'Données de passagers traitées aux seules fins de sûreté aéroportuaire et de lutte contre la fraude' },
      { text: 'Aucun usage commercial, aucun traceur publicitaire' },
      { text: 'Politique de conservation et de suppression des données', state: 'en cours' },
    ],
  },
];

const RESOURCES = [
  { ref: 'PC-00', title: 'Périmètre et contexte du système de management' },
  { ref: 'PSI-01', title: 'Politique de sécurité de l’information' },
  { ref: 'PGI-04', title: 'Procédure de gestion des incidents' },
  { ref: 'DR-07', title: 'Politique de sauvegarde et de reprise' },
  { ref: 'Audit', title: 'Synthèse de l’audit de sécurité (septembre 2026)' },
];

const SUBPROCESSORS = [
  { name: 'Supabase', role: 'Base de données, authentification, temps réel', where: 'Union européenne (eu-west-1)' },
  { name: 'Hostinger', role: 'Hébergement de l’API de scan', where: 'Europe' },
  { name: 'GitHub', role: 'Hébergement du code source', where: 'États-Unis' },
  { name: 'Expo', role: 'Construction de l’application mobile', where: 'États-Unis' },
  { name: 'Google Play', role: 'Distribution de l’application mobile (test fermé)', where: 'États-Unis' },
  { name: 'Starlink', role: 'Connectivité Internet des escales', where: 'États-Unis' },
];

export default function TrustPage() {
  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent('Trust Center Police Bagage : demande d’accès aux documents')}`;
  return (
    <LegalShell title="Trust Center" updated={UPDATED}>
      <P>
        Police Bagage est la plateforme de contrôle d’embarquement et de lutte contre la fraude bagages
        d’African Transport Systems (ATS Handling), conçue et exploitée par son Centre des Solutions
        Informatiques. Cette page présente ce que nous mettons en place pour protéger les données des
        compagnies et des passagers, où en est notre démarche de conformité, et à qui nous faisons appel.
      </P>
      <div style={s.contactRow}>
        <a href={`mailto:${CONTACT}`} className="ft-link">{CONTACT}</a>
        <a href={mailto} style={s.cta}>Demander l’accès aux documents</a>
      </div>

      <LegalSection title="Conformité">
        <div style={s.badgeRow}>
          <div style={s.badge} aria-hidden>
            <span style={s.badgeTop}>ISO/IEC</span>
            <span style={s.badgeNum}>27001</span>
            <span style={s.badgeBottom}>2022</span>
          </div>
          <div>
            <div style={s.badgeTitle}>ISO/IEC 27001:2022</div>
            <div style={s.badgeSub}>
              Démarche de certification en cours. Périmètre : le Centre des Solutions Informatiques d’ATS,
              dont la plateforme Police Bagage. Le certificat sera publié ici dès son obtention.
            </div>
          </div>
        </div>
        <LegalRow label="Protection des données" value="Données de passagers traitées aux seules fins de sûreté aéroportuaire, sans usage commercial. Hébergement dans l’Union européenne." />
        <LegalRow label="Audit de sécurité" value="Audit et test d’intrusion réalisés en septembre 2026 ; les vulnérabilités critiques ont été corrigées et vérifiées en production." />
      </LegalSection>

      <LegalSection title="Mesures de sécurité">
        <div style={s.grid}>
          {CONTROLS.map((g) => (
            <div key={g.title} style={s.group}>
              <div style={s.groupTitle}>{g.title}</div>
              <ul style={s.list}>
                {g.items.map((it) => (
                  <li key={it.text} style={s.li}>
                    <span style={{ ...s.mark, background: it.state === 'en cours' ? 'var(--content-tertiary)' : 'var(--positive)' }} aria-hidden />
                    <span style={s.liText}>
                      {it.text}
                      {it.state === 'en cours' ? <span style={s.tag}>en cours</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="Documents">
        <P>
          Les documents ci-dessous sont communiqués sur demande aux compagnies partenaires, aux autorités et
          aux auditeurs, sous réserve de confidentialité.
        </P>
        {RESOURCES.map((r) => (
          <LegalRow key={r.ref} label={r.ref} value={r.title} />
        ))}
        <div style={{ marginTop: 14 }}>
          <a href={mailto} style={s.cta}>Demander l’accès</a>
        </div>
      </LegalSection>

      <LegalSection title="Sous-traitants">
        <P>Prestataires qui hébergent ou soutiennent la plateforme, et la nature de leur rôle.</P>
        {SUBPROCESSORS.map((sp) => (
          <LegalRow key={sp.name} label={sp.name} value={`${sp.role}. ${sp.where}.`} />
        ))}
      </LegalSection>

      <LegalSection title="État des services">
        <P>
          La disponibilité des services est vérifiée automatiquement et publiée sur la page{' '}
          <a href="/status" className="ft-link">État des systèmes</a>.
        </P>
      </LegalSection>
    </LegalShell>
  );
}

const s: Record<string, CSSProperties> = {
  contactRow: { display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginTop: 4 },
  cta: {
    display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 16px', borderRadius: 9999,
    background: 'var(--interactive-accent)', color: 'var(--interactive-control)', fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
  },
  badgeRow: { display: 'flex', alignItems: 'center', gap: 18, padding: '4px 0 16px', flexWrap: 'wrap' },
  badge: {
    width: 84, height: 84, borderRadius: '50%', border: '2px solid var(--content-primary)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    color: 'var(--content-primary)', lineHeight: 1,
  },
  badgeTop: { fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
  badgeNum: { fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, margin: '3px 0' },
  badgeBottom: { fontSize: 9, fontWeight: 600, color: 'var(--content-secondary)' },
  badgeTitle: { fontSize: 15, fontWeight: 600, color: 'var(--content-primary)' },
  badgeSub: { fontSize: 14, lineHeight: 1.55, color: 'var(--content-secondary)', marginTop: 4, maxWidth: 560 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 },
  group: { border: '1px solid var(--divider)', borderRadius: 12, padding: '14px 16px', background: 'var(--bg-elevated)' },
  groupTitle: { fontSize: 14, fontWeight: 600, color: 'var(--content-primary)', marginBottom: 10 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  li: { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.5, color: 'var(--content-secondary)' },
  mark: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 7 },
  liText: { minWidth: 0 },
  tag: { marginLeft: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--content-tertiary)', border: '1px solid var(--divider)', borderRadius: 9999, padding: '1px 8px', whiteSpace: 'nowrap' },
};
