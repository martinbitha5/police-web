import { LegalShell, LegalSection, P } from '@/components/LegalShell';

export const metadata = {
  title: 'Conditions d’utilisation · Police Bagage',
  description:
    'Conditions générales d’utilisation de la plateforme Police Bagage : accès réservé, obligations des utilisateurs, règles anti-fraude et traitement des données.',
};

const UPDATED = '19 août 2026';

export default function ConditionsPage() {
  return (
    <LegalShell title="Conditions générales d’utilisation" updated={UPDATED}>
      <LegalSection title="1. Objet">
        <P>
          Les présentes conditions encadrent l’utilisation de la plateforme Police Bagage,
          éditée par African Transport Systems (ATS Handling). La plateforme couvre le contrôle
          d’embarquement, le suivi des bagages et la détection de la fraude bagages sur les vols
          des compagnies aériennes partenaires.
        </P>
        <P>
          L’utilisation de la plateforme vaut acceptation pleine et entière des présentes
          conditions.
        </P>
      </LegalSection>

      <LegalSection title="2. Accès au service">
        <P>
          L’accès est réservé au personnel autorisé : agents de terrain sur l’application mobile,
          superviseurs et administrateurs sur l’espace web. Chaque utilisateur dispose d’un compte
          nominatif créé par un administrateur, rattaché à un aéroport et à une compagnie
          aérienne, qui délimitent les données visibles.
        </P>
        <P>
          Aucune inscription publique n’est possible. ATS Handling peut suspendre ou révoquer un
          compte à tout moment, notamment en cas d’usage non conforme.
        </P>
      </LegalSection>

      <LegalSection title="3. Obligations de l’utilisateur">
        <P>
          L’utilisateur s’engage à préserver la confidentialité de ses identifiants et à ne pas
          les partager. Toute action réalisée depuis un compte engage la responsabilité de son
          titulaire.
        </P>
        <P>
          La plateforme est un outil strictement professionnel : toute utilisation à d’autres
          fins que le contrôle d’embarquement et la lutte contre la fraude bagages est interdite.
          L’utilisateur se déconnecte à la fin de son service et signale sans délai à son
          superviseur la perte ou le vol d’un appareil.
        </P>
      </LegalSection>

      <LegalSection title="4. Règles anti-fraude">
        <P>
          Les règles de rejet bagage appliquées par la plateforme (passager non enregistré,
          bagage non déclaré, quota dépassé, étiquette déjà scannée, étiquette d’un autre vol)
          sont appliquées sans exception. Aucun utilisateur ne peut les contourner ; toute
          dérogation relève d’une intervention manuelle du superviseur, tracée.
        </P>
        <P>
          Toute tentative de contournement des règles anti-fraude est enregistrée et signalée.
          Les mouvements opérationnels sont journalisés à des fins d’audit.
        </P>
      </LegalSection>

      <LegalSection title="5. Données traitées">
        <P>
          La plateforme traite les données strictement nécessaires à sa mission : identité et
          référence de réservation des passagers, sièges, vols, étiquettes bagage, alertes de
          fraude et horodatages des opérations, avec l’identité de l’agent ayant réalisé chaque
          opération.
        </P>
        <P>
          Ces données servent exclusivement à la sûreté des vols, au suivi des bagages et à
          l’édition des rapports d’exploitation destinés aux superviseurs et aux compagnies
          concernées. Elles ne sont ni cédées ni exploitées à des fins commerciales. La
          plateforme n’intègre aucun traceur publicitaire.
        </P>
        <P>
          Chaque compagnie aérienne n’accède qu’aux données de ses propres vols, ce cloisonnement
          étant appliqué au niveau de la base de données.
        </P>
      </LegalSection>

      <LegalSection title="6. Disponibilité et responsabilité">
        <P>
          ATS Handling s’efforce d’assurer la disponibilité continue de la plateforme, sans
          pouvoir la garantir de manière absolue : des interruptions pour maintenance ou des
          incidents techniques peuvent survenir.
        </P>
        <P>
          La plateforme assiste les opérations mais ne s’y substitue pas : les décisions
          opérationnelles (interception d’un bagage, résolution d’une alerte, litige) relèvent
          des superviseurs et du personnel habilité.
        </P>
      </LegalSection>

      <LegalSection title="7. Propriété intellectuelle">
        <P>
          La plateforme, son code, son interface et ses contenus sont la propriété d’African
          Transport Systems. Toute reproduction ou réutilisation sans autorisation écrite est
          interdite.
        </P>
      </LegalSection>

      <LegalSection title="8. Évolution des conditions">
        <P>
          ATS Handling peut faire évoluer les présentes conditions. La version en vigueur est
          celle publiée sur cette page, avec sa date de mise à jour. Les utilisateurs sont
          informés des évolutions substantielles par leur hiérarchie.
        </P>
      </LegalSection>

      <LegalSection title="9. Droit applicable et contact">
        <P>
          Les présentes conditions sont régies par le droit de la République Démocratique du
          Congo. Tout litige relatif à leur exécution relève des juridictions compétentes de
          Kinshasa.
        </P>
        <P>
          Pour toute question : contact@ats-handling-rdc.com ou +243 819 929 881.
        </P>
      </LegalSection>
    </LegalShell>
  );
}
