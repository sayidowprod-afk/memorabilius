import type { Metadata } from 'next'
import LegalShell from '@/components/LegalShell'

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "Conditions Générales d'Utilisation (CGU) du site Memorabilius.",
  robots: { index: false, follow: false },
}

export default function CGUPage() {
  return (
    <LegalShell title="Conditions Générales d'Utilisation (CGU)" updated="23 juin 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation du
        site <strong>Memorabilius</strong> (<a href="https://www.memorabilius.fr">https://www.memorabilius.fr</a>,
        ci-après « le Service »), édité par Killian BAJONI (ci-après « l'Éditeur »).
      </p>
      <p>
        Memorabilius est une plateforme communautaire permettant aux collectionneurs de{' '}
        <strong>répertorier, organiser, présenter et échanger</strong> des cartes de collection
        (sportives et TCG), de suivre des listes de sets (« setlists ») et d'entrer en relation avec
        d'autres collectionneurs.
      </p>

      <h2>2. Acceptation des CGU</h2>
      <p>
        La création d'un compte et l'utilisation du Service impliquent l'acceptation pleine et entière
        des présentes CGU. Si l'utilisateur n'accepte pas ces conditions, il doit renoncer à utiliser le
        Service.
      </p>

      <h2>3. Accès au Service</h2>
      <p>
        Le Service est en principe accessible gratuitement. Certaines fonctionnalités nécessitent la
        création d'un compte. L'Éditeur s'efforce d'assurer la disponibilité du Service mais ne garantit
        pas un accès continu et sans interruption (maintenance, incident technique, dépendance à des
        prestataires tiers).
      </p>

      <h2>4. Inscription et compte</h2>
      <ul>
        <li>L'utilisateur s'engage à fournir des informations exactes lors de l'inscription.</li>
        <li>L'utilisateur est responsable de la confidentialité de son mot de passe et de toute activité réalisée depuis son compte.</li>
        <li>Un compte est strictement personnel. L'utilisateur informe l'Éditeur de toute utilisation non autorisée.</li>
        <li>L'utilisateur doit avoir l'âge légal requis (voir la <a href="/confidentialite">Politique de confidentialité</a>).</li>
      </ul>

      <h2>5. Contenu publié par les utilisateurs</h2>
      <p>
        L'utilisateur peut publier du contenu (images de cartes, informations, descriptions, messages,
        annonces d'échange). À ce titre :
      </p>
      <ul>
        <li>L'utilisateur <strong>garantit détenir les droits</strong> nécessaires sur les contenus qu'il publie, notamment les photographies qu'il met en ligne, et <strong>assume seul la responsabilité</strong> de ce contenu.</li>
        <li>L'utilisateur s'engage à ne publier aucun contenu illicite, diffamatoire, trompeur, contrefaisant, ou portant atteinte aux droits de tiers.</li>
        <li>Les <strong>marques, logos et visuels officiels des cartes</strong> (Panini, Topps, etc.) ainsi que les noms et images des joueurs et des ligues appartiennent à leurs titulaires. Memorabilius n'est pas affilié à ces marques (voir les <a href="/mentions-legales">Mentions légales</a>).</li>
        <li>L'utilisateur concède à l'Éditeur une <strong>licence non exclusive et gratuite</strong> d'héberger, reproduire et afficher son contenu <strong>dans le seul but de faire fonctionner le Service</strong> (affichage de sa collection, profils publics, mise en relation). Cette licence prend fin à la suppression du contenu ou du compte, sous réserve des copies techniques résiduelles.</li>
      </ul>

      <h2>6. Analyse automatique des cartes</h2>
      <p>
        Le Service propose une analyse automatique des images de cartes (via un service tiers
        d'intelligence artificielle) afin de pré-remplir les informations. Ces informations sont fournies{' '}
        <strong>à titre indicatif</strong> et peuvent comporter des erreurs ; il appartient à
        l'utilisateur de les vérifier et de les corriger.
      </p>

      <h2>7. Échanges entre utilisateurs (« Trades »)</h2>
      <p>
        Memorabilius met à disposition des outils permettant aux utilisateurs de proposer et d'organiser
        des échanges de cartes. <strong>L'Éditeur n'est qu'un intermédiaire technique</strong> :
      </p>
      <ul>
        <li>Il <strong>n'est pas partie</strong> aux transactions ou échanges conclus entre utilisateurs.</li>
        <li>Il ne garantit ni l'authenticité, ni l'état, ni la valeur, ni la bonne fin des cartes échangées.</li>
        <li>Tout litige relatif à un échange relève de la seule responsabilité des utilisateurs concernés.</li>
      </ul>

      <h2>8. Données de marché et estimations de valeur</h2>
      <p>
        Les estimations de valeur et données de marché affichées (issues notamment d'annonces eBay) sont
        fournies <strong>à titre purement indicatif</strong>, correspondent à des <strong>prix demandés
        d'annonces en cours</strong> (et non à un historique de ventes garanti), et ne constituent{' '}
        <strong>ni une expertise, ni un conseil en investissement</strong>. L'Éditeur décline toute
        responsabilité quant aux décisions prises sur la base de ces données.
      </p>

      <h2>9. Règles de conduite</h2>
      <p>L'utilisateur s'interdit notamment de :</p>
      <ul>
        <li>harceler, menacer ou tromper d'autres utilisateurs ;</li>
        <li>publier des contenus illicites ou portant atteinte aux droits de tiers ;</li>
        <li>perturber le fonctionnement du Service (accès automatisé non autorisé, extraction massive de données, tentative d'intrusion) ;</li>
        <li>usurper l'identité d'un tiers.</li>
      </ul>

      <h2>10. Modération, suspension et résiliation</h2>
      <p>
        L'Éditeur peut retirer tout contenu signalé comme illicite et <strong>suspendre ou supprimer</strong>{' '}
        un compte en cas de manquement aux présentes CGU, sans préjudice d'éventuelles poursuites.
        L'utilisateur peut à tout moment supprimer son compte depuis son espace personnel ou en écrivant à
        contact@memorabilius.fr.
      </p>

      <h2>11. Responsabilité</h2>
      <p>Le Service est fourni « en l'état ». L'Éditeur ne saurait être tenu responsable :</p>
      <ul>
        <li>des contenus publiés par les utilisateurs ;</li>
        <li>des litiges entre utilisateurs (notamment lors d'échanges) ;</li>
        <li>des interruptions, pertes de données ou dysfonctionnements liés aux prestataires tiers ou à des causes indépendantes de sa volonté ;</li>
        <li>de l'inexactitude des informations de cartes ou des estimations de valeur.</li>
      </ul>

      <h2>12. Propriété intellectuelle du Service</h2>
      <p>
        La structure, le code, le design et les éléments propres du Service sont protégés et demeurent la
        propriété de l'Éditeur. Toute reproduction non autorisée est interdite.
      </p>

      <h2>13. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{' '}
        <a href="/confidentialite">Politique de confidentialité</a>.
      </p>

      <h2>14. Modification des CGU</h2>
      <p>
        L'Éditeur peut modifier les présentes CGU à tout moment. La version applicable est celle en
        vigueur lors de l'utilisation du Service. En cas de modification substantielle, les utilisateurs
        en seront informés.
      </p>

      <h2>15. Droit applicable et litiges</h2>
      <p>
        Les présentes CGU sont régies par le <strong>droit français</strong>. En cas de litige, et à
        défaut de résolution amiable, les tribunaux français seront compétents. Le Service étant fourni
        gratuitement aux utilisateurs (absence de vente directe), le dispositif de médiation de la
        consommation n'est pas applicable.
      </p>

      <h2>16. Contact</h2>
      <p>Pour toute question relative aux présentes CGU : <strong>contact@memorabilius.fr</strong>.</p>
    </LegalShell>
  )
}
