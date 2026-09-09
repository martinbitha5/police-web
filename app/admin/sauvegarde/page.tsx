'use client';

import type { CSSProperties, ReactNode } from 'react';
import { AdminOnly } from '@/components/AdminGuard';
import { AdminTabs } from '@/components/AdminTabs';
import { card, eyebrow } from '@/ui/theme';

export default function SauvegardePage() {
  return (
    <AdminOnly>
      <div style={s.page}>
        <AdminTabs />

        <div style={s.head}>
          <span style={eyebrow}>Administration</span>
          <h1 style={s.title}>Sauvegarde et reprise</h1>
          <p style={s.lead}>
            La sauvegarde garantit que les données (passagers, bagages, alertes) peuvent être
            restaurées après un incident. Elle repose sur deux niveaux, pour ne pas dépendre d’un
            seul fournisseur.
          </p>
        </div>

        <Section title="Objectifs (à valider par la direction)">
          <Kv k="Perte de données maximale tolérée (RPO)" v="24 heures — une sauvegarde par jour." />
          <Kv k="Délai de remise en service (RTO)" v="4 heures." />
          <p style={s.note}>
            La base est petite (quelques dizaines de Mo) : une sauvegarde complète prend quelques
            secondes. Le coût n’est pas un obstacle.
          </p>
        </Section>

        <Section title="Stratégie à deux niveaux">
          <ol style={s.list}>
            <li>
              <b>Sauvegardes gérées Supabase.</b> Sauvegardes quotidiennes automatiques, et
              restauration à un instant précis (PITR) si l’offre du projet le permet. À vérifier et
              documenter dans la console Supabase.
            </li>
            <li>
              <b>Export indépendant, chiffré, hors plateforme.</b> Un export quotidien chiffré,
              stocké ailleurs que chez Supabase. C’est la garantie en cas de perte d’accès au compte
              Supabase lui-même. Script fourni : <code style={s.inline}>scripts/backup.mjs</code>.
            </li>
          </ol>
        </Section>

        <Section title="Lancer une sauvegarde (export indépendant)">
          <p style={s.note}>
            À exécuter côté serveur / poste d’administration. La chaîne de connexion et la phrase
            secrète sont fournies par variables d’environnement, jamais en clair.
          </p>
          <pre style={s.code}>{`export SUPABASE_DB_URL='postgresql://postgres:[MOT_DE_PASSE]@db.<projet>.supabase.co:5432/postgres'
export BACKUP_PASSPHRASE='<phrase-secrète-forte>'
node scripts/backup.mjs`}</pre>
          <p style={s.note}>
            Le script écrit une sauvegarde horodatée et chiffrée sous <code style={s.inline}>./backups/</code>
            (dossier ignoré par git). Conserver au moins 30 jours, et copier hors plateforme.
          </p>
        </Section>

        <Section title="Tester une restauration (obligatoire pour l’ISO)">
          <p style={s.note}>
            Ne <b>jamais</b> tester une restauration sur la base de production. Restaurer dans une
            cible isolée (branche Supabase, ou base PostgreSQL jetable), puis vérifier les comptages.
          </p>
          <pre style={s.code}>{`# Déchiffrer
openssl enc -d -aes-256-cbc -pbkdf2 -in backups/<fichier>.dump.enc -out restore.dump -pass env:BACKUP_PASSPHRASE
# Restaurer dans une cible ISOLÉE
pg_restore --clean --if-exists --no-owner --no-privileges -d "$CIBLE_DB_URL" restore.dump`}</pre>
          <div style={s.callout}>
            <b>Exigence de certification.</b> Un test de restauration réussi doit être daté et
            consigné au moins une fois par an. Sans cette preuve, l’exigence de continuité (ISO/IEC
            27001, A.8.13 et A.5.30) n’est pas satisfaite.
          </div>
        </Section>
      </div>
    </AdminOnly>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...card, ...s.section }}>
      <h2 style={s.h2}>{title}</h2>
      {children}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div style={s.kv}>
      <span style={s.kvKey}>{k}</span>
      <span style={s.kvVal}>{v}</span>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  page: { padding: '20px 24px 40px', maxWidth: 860, margin: '0 auto' },
  head: { marginBottom: 20 },
  title: { fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--content-primary)', margin: '4px 0 8px' },
  lead: { fontSize: 15, color: 'var(--content-secondary)', lineHeight: 1.55, margin: 0 },
  section: { marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: 600, color: 'var(--content-primary)', margin: '0 0 12px' },
  list: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--content-secondary)', lineHeight: 1.55 },
  note: { fontSize: 14, color: 'var(--content-secondary)', lineHeight: 1.55, margin: '0 0 8px' },
  kv: { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--divider)' },
  kvKey: { fontSize: 14, color: 'var(--content-secondary)' },
  kvVal: { fontSize: 14, fontWeight: 600, color: 'var(--content-primary)', textAlign: 'right' },
  inline: { fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-neutral)', padding: '1px 5px', borderRadius: 4 },
  code: { fontFamily: 'monospace', fontSize: 12.5, background: 'var(--bg-neutral)', color: 'var(--content-primary)', padding: 12, borderRadius: 8, overflowX: 'auto', lineHeight: 1.5, margin: '0 0 8px', whiteSpace: 'pre' },
  callout: { marginTop: 10, padding: 12, borderRadius: 8, background: 'var(--bg-neutral)', borderLeft: '3px solid var(--accent)', fontSize: 13.5, color: 'var(--content-secondary)', lineHeight: 1.5 },
};
