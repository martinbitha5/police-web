import { LegalShell, LegalSection, LegalRow, P } from '@/components/LegalShell';

export const metadata = {
  title: 'Mentions légales · Police Bagage',
  description: 'Mentions légales de la plateforme Police Bagage, éditée par African Transport Systems (ATS Handling).',
};

const UPDATED = '19 août 2026';

export default function LegalPage() {
  return (
    <LegalShell title="Mentions légales" updated={UPDATED}>
      <LegalSection title="Éditeur">
        <P>
          La plateforme Police Bagage est éditée par African Transport Systems (ATS Handling),
          société de services aéroportuaires opérant en République Démocratique du Congo :
          assistance en escale, fret, sûreté, manutention et transport de bagages.
        </P>
        <LegalRow label="Éditeur" value="African Transport Systems (ATS Handling)" />
        <LegalRow label="Siège" value="11e niveau, immeuble Equity BCDC, 15 Boulevard du 30 juin, Gombe, Kinshasa, République Démocratique du Congo" />
        <LegalRow label="Téléphone" value="+243 819 929 881" />
        <LegalRow label="Email" value="contact@ats-handling-rdc.com" />
        <LegalRow
          label="Site"
          value={
            <a href="https://www.ats-handling-rdc.com" target="_blank" rel="noopener noreferrer" className="ft-link">
              www.ats-handling-rdc.com
            </a>
          }
        />
      </LegalSection>

      <LegalSection title="Objet de la plateforme">
        <P>
          Police Bagage est un outil professionnel de contrôle d’embarquement et de lutte contre
          la fraude bagages. Il assure le suivi des passagers et des étiquettes bagage, du comptoir
          d’enregistrement à la soute, pour les vols des compagnies aériennes partenaires
          assistées par ATS Handling.
        </P>
        <P>
          L’accès est strictement réservé au personnel autorisé, muni d’un compte nominatif.
          La plateforme n’est pas un service destiné au grand public.
        </P>
      </LegalSection>

      <LegalSection title="Hébergement des données">
        <P>
          Les données opérationnelles (vols, passagers, bagages, alertes) et l’authentification
          sont hébergées sur l’infrastructure Supabase, dans la région Union européenne
          (eu-west-1). Les échanges entre les applications et les serveurs sont chiffrés.
        </P>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <P>
          La plateforme traite des données de passagers (nom, référence de réservation, siège,
          vol) et des données d’étiquettes bagage, aux seules fins de sûreté aéroportuaire et de
          lutte contre la fraude. Le détail des traitements figure dans les conditions
          d’utilisation.
        </P>
        <P>
          Aucune donnée n’est exploitée à des fins commerciales et la plateforme n’intègre aucun
          traceur publicitaire. Pour toute question relative aux données, écrire à
          contact@ats-handling-rdc.com.
        </P>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <P>
          La plateforme, sa marque, son interface et ses contenus sont la propriété d’African
          Transport Systems. Les marques et logos des compagnies aériennes affichés (notamment
          Air Congo et CAA, Compagnie Africaine d’Aviation) appartiennent à leurs titulaires
          respectifs et ne sont utilisés qu’à titre d’identification des vols opérés.
        </P>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <P>
          Les présentes mentions sont régies par le droit de la République Démocratique du Congo.
        </P>
      </LegalSection>
    </LegalShell>
  );
}
