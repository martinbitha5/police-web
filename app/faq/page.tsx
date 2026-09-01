import { LegalShell, LegalSection, P } from '@/components/LegalShell';

export const metadata = {
  title: 'Questions fréquentes · Police Bagage',
  description:
    'Réponses aux questions courantes sur Police Bagage : accès, scan des boarding pass et des étiquettes bagage, règles de rejet, alertes de fraude et rapports d’exploitation.',
};

/**
 * FAQ publique. Page serveur statique, listée comme route publique dans
 * middleware.ts au même titre que les mentions légales et les CGU.
 *
 * Chaque question est un LegalSection : même gabarit typographique que les
 * pages légales, aucun composant supplémentaire à maintenir.
 */

export default function FaqPage() {
  return (
    <LegalShell title="Questions fréquentes">
      <LegalSection title="À quoi sert Police Bagage ?">
        <P>
          La plateforme couvre le contrôle d’embarquement et le suivi des bagages, du comptoir
          d’enregistrement jusqu’à la soute. Les agents scannent les boarding pass et les
          étiquettes bagage sur des terminaux de terrain ; les superviseurs suivent l’ensemble en
          temps réel depuis l’espace web et éditent les rapports d’exploitation.
        </P>
        <P>
          Son second rôle est la lutte contre la fraude bagages : un colis étiqueté sur une
          réservation qui n’a pas déclaré de bagage est intercepté avant le chargement en soute,
          et le superviseur est alerté immédiatement.
        </P>
      </LegalSection>

      <LegalSection title="Qui peut se connecter ?">
        <P>
          L’accès est réservé au personnel autorisé. Les agents de terrain utilisent
          l’application mobile ; les superviseurs et les administrateurs utilisent l’espace web.
          Un agent ne se connecte pas au web, un superviseur ne se connecte pas au mobile.
        </P>
      </LegalSection>

      <LegalSection title="Comment obtenir un compte ?">
        <P>
          Il n’y a pas d’inscription : les comptes sont créés par un administrateur, qui rattache
          chaque utilisateur à un aéroport et à une compagnie aérienne. Adressez-vous à votre
          hiérarchie. En cas d’oubli de mot de passe, un administrateur le réinitialise depuis la
          page Comptes.
        </P>
      </LegalSection>

      <LegalSection title="Comment un bagage est-il rattaché à son passager ?">
        <P>
          Par le numéro de série de l’étiquette, confronté au vol et à la journée d’exploitation.
          Le code compagnie inscrit sur l’étiquette n’entre jamais dans ce rapprochement : deux
          compagnies peuvent partager un même code numérique, ce qui en fait une clé peu fiable.
        </P>
      </LegalSection>

      <LegalSection title="Pourquoi une étiquette est-elle refusée au scan ?">
        <P>
          Cinq situations conduisent à un refus : le passager n’est pas enregistré sur le vol ; sa
          réservation ne déclare aucun bagage ; le nombre de bagages déclarés est déjà atteint ;
          l’étiquette a déjà été scannée ; l’étiquette appartient à un autre vol.
        </P>
        <P>
          Les trois premières situations déclenchent une alerte de fraude auprès du superviseur.
          Les deux dernières sont de simples erreurs de manipulation et n’alertent personne.
        </P>
      </LegalSection>

      <LegalSection title="L’agent qui scanne est-il en cause lors d’une alerte ?">
        <P>
          Non. L’agent bagages scanne ce qui arrive sur le tapis. Une alerte signale qu’une
          étiquette a été imprimée au comptoir sur une réservation sans bagage déclaré, ou
          au-delà du nombre déclaré. Elle désigne une anomalie sur un colis, jamais une faute de
          l’agent, et jamais non plus une accusation contre le passager.
        </P>
      </LegalSection>

      <LegalSection title="Que faire quand une alerte de fraude apparaît ?">
        <P>
          Le superviseur voit l’alerte arriver en direct avec le numéro d’étiquette, le vol et la
          porte concernés. Le colis doit être intercepté physiquement sur le tapis avant le
          chargement, puis l’alerte est marquée résolue une fois la situation traitée.
        </P>
      </LegalSection>

      <LegalSection title="Que se passe-t-il si le terminal perd le réseau ?">
        <P>
          Un scan qui n’atteint pas le serveur n’est jamais compté comme réussi : les compteurs
          affichés à l’agent restent ceux du serveur. Dès le retour du réseau, l’écran se remet à
          jour. Un bagage ne peut donc pas être considéré comme confirmé à la suite d’une simple
          coupure.
        </P>
      </LegalSection>

      <LegalSection title="Un bagage doit partir sur un autre vol, est-ce possible ?">
        <P>
          Oui, par une expédition en rush, validée par un superviseur. Le bagage conserve sa trace
          d’origine et reçoit une seconde étiquette pour le vol de réacheminement ; les deux
          restent liées. Un débarquement ou une annulation ne supprime jamais l’historique d’un
          bagage.
        </P>
      </LegalSection>

      <LegalSection title="Quelles données ma compagnie voit-elle ?">
        <P>
          Uniquement celles de ses propres vols. Le cloisonnement est appliqué au niveau de la
          base de données, pas seulement à l’affichage : une compagnie ne peut pas atteindre les
          vols d’une autre, même en modifiant une adresse dans son navigateur.
        </P>
      </LegalSection>

      <LegalSection title="Comment obtenir un rapport ?">
        <P>
          Depuis la page Rapports de l’espace superviseur, par vol ou par période. Le fichier
          Excel reprend les passagers, les bagages déclarés et confirmés, les écarts et les
          alertes de la période, prêt à archiver ou à transmettre à la compagnie.
        </P>
      </LegalSection>

      <LegalSection title="Une question qui n’est pas ici ?">
        <P>
          Écrivez à contact@ats-handling-rdc.com ou appelez le +243 819 929 881. Pour un incident
          en cours d’exploitation, passez d’abord par votre superviseur.
        </P>
      </LegalSection>
    </LegalShell>
  );
}
