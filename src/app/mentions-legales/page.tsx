import type { Metadata } from 'next'
import LegalShell from '@/components/LegalShell'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales du site Memorabilius.',
}

export default function MentionsLegalesPage() {
  return (
    <LegalShell title="Mentions légales" updated="23 juin 2026">
      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>Memorabilius</strong>, accessible à l'adresse{' '}
        <a href="https://www.memorabilius.fr">https://www.memorabilius.fr</a>, est édité par :
      </p>
      <ul>
        <li><strong>Statut :</strong> Particulier</li>
        <li><strong>Nom :</strong> Killian BAJONI</li>
        <li><strong>Adresse :</strong> 20 Boulevard Pater, 59300 Valenciennes</li>
        <li><strong>Email :</strong> contact@memorabilius.fr</li>
      </ul>

      <h2>2. Directeur de la publication</h2>
      <p>Killian BAJONI, en qualité d'éditeur.</p>

      <h2>3. Hébergement</h2>
      <p>L'application et les données sont hébergées par les prestataires suivants :</p>
      <p>
        <strong>Hébergement de l'application (front-end et fonctions serveur) :</strong><br />
        Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis —{' '}
        <a href="https://vercel.com">vercel.com</a>
      </p>
      <p>
        <strong>Hébergement de la base de données, du stockage des images et de l'authentification :</strong><br />
        Supabase, Inc. — 970 Toa Payoh North, #07-04, Singapour 318992 —{' '}
        <a href="https://supabase.com">supabase.com</a><br />
        <em>Région d'hébergement des données : Union Européenne.</em>
      </p>
      <p>
        <strong>Nom de domaine :</strong><br />
        LWS (Ligne Web Services) — <a href="https://www.lws.fr">lws.fr</a>
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        La structure du site, son design, ses textes et ses éléments graphiques propres sont la
        propriété de l'éditeur, sauf mention contraire.
      </p>
      <p>
        Les <strong>noms de marques, logos, visuels et désignations de cartes</strong> (notamment
        Panini, Topps, Upper Deck, Fleer, Donruss, Bowman, Pokémon, etc.), ainsi que les noms et
        images des joueurs et des ligues (NBA, NFL, MLB, NHL…), demeurent la propriété exclusive de
        leurs titulaires respectifs. Memorabilius <strong>n'est ni affilié, ni sponsorisé, ni
        approuvé</strong> par ces marques, ligues ou fabricants. Ces éléments n'apparaissent qu'à des
        fins d'identification et de référencement des cartes de collection au sein des collections des
        utilisateurs.
      </p>

      <h2>5. Contenu publié par les utilisateurs</h2>
      <p>
        Les images et informations de cartes ajoutées par les utilisateurs relèvent de leur seule
        responsabilité (voir les <a href="/cgu">Conditions Générales d'Utilisation</a>). Pour toute
        demande de retrait d'un contenu, écrire à : contact@memorabilius.fr.
      </p>

      <h2>6. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la{' '}
        <a href="/confidentialite">Politique de confidentialité</a>.
      </p>

      <h2>7. Contact</h2>
      <p>Pour toute question relative au site : contact@memorabilius.fr.</p>
    </LegalShell>
  )
}
