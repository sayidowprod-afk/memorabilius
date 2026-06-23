import type { Metadata } from 'next'
import LegalShell from '@/components/LegalShell'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité et protection des données (RGPD) du site Memorabilius.',
}

export default function ConfidentialitePage() {
  return (
    <LegalShell title="Politique de confidentialité" updated="23 juin 2026">
      <p>
        La présente politique explique comment <strong>Memorabilius</strong>{' '}
        (<a href="https://www.memorabilius.fr">https://www.memorabilius.fr</a>) collecte, utilise et
        protège les données personnelles de ses utilisateurs, conformément au Règlement Général sur la
        Protection des Données (RGPD – UE 2016/679) et à la loi « Informatique et Libertés ».
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l'éditeur du site (voir les{' '}
        <a href="/mentions-legales">Mentions légales</a>) : Killian BAJONI, 20 Boulevard Pater 59300
        Valenciennes, joignable à contact@memorabilius.fr.
      </p>

      <h2>2. Données que nous collectons</h2>
      <table>
        <thead>
          <tr><th>Catégorie</th><th>Données concernées</th><th>Origine</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Compte &amp; identification</strong></td><td>Adresse email, nom d'affichage (pseudo), mot de passe (stocké chiffré), avatar</td><td>Fournies par l'utilisateur à l'inscription</td></tr>
          <tr><td><strong>Profil</strong></td><td>Description, liens publics, préférences de langue, lien vers un fichier CSV de collection (facultatif)</td><td>Fournies par l'utilisateur</td></tr>
          <tr><td><strong>Contenu de collection</strong></td><td>Images de cartes (recto/verso), informations des cartes (joueur, année, marque, set, variation, numérotation…), classement dans des collections/setlists</td><td>Ajoutées par l'utilisateur</td></tr>
          <tr><td><strong>Échanges &amp; communications</strong></td><td>Messages entre utilisateurs, annonces d'échange (trades), participations aux événements</td><td>Générées par l'utilisateur</td></tr>
          <tr><td><strong>Données techniques</strong></td><td>Données de connexion, cookies de session, journaux techniques nécessaires au fonctionnement et à la sécurité</td><td>Collectées automatiquement</td></tr>
        </tbody>
      </table>
      <p>
        Nous <strong>ne collectons pas</strong> de données sensibles (santé, opinions, etc.) et ne
        demandons <strong>aucune donnée bancaire</strong> : le site ne réalise pas de paiement en ligne
        auprès des utilisateurs.
      </p>

      <h2>3. Finalités et bases légales</h2>
      <table>
        <thead>
          <tr><th>Finalité</th><th>Base légale</th></tr>
        </thead>
        <tbody>
          <tr><td>Création et gestion du compte utilisateur</td><td>Exécution du contrat (CGU)</td></tr>
          <tr><td>Affichage et gestion de la collection de cartes</td><td>Exécution du contrat (CGU)</td></tr>
          <tr><td>Mise en relation entre collectionneurs (échanges, messages, annuaire)</td><td>Exécution du contrat / intérêt légitime</td></tr>
          <tr><td>Analyse automatique des images de cartes pour pré-remplir les informations</td><td>Exécution du contrat (à la demande de l'utilisateur)</td></tr>
          <tr><td>Sécurité, prévention des abus, bon fonctionnement</td><td>Intérêt légitime</td></tr>
          <tr><td>Mesure d'audience (statistiques anonymes, sans cookie)</td><td>Intérêt légitime</td></tr>
        </tbody>
      </table>

      <h2>4. Destinataires et sous-traitants</h2>
      <p>
        Vos données ne sont <strong>jamais vendues</strong>. Elles peuvent être traitées par les
        sous-traitants techniques suivants, strictement pour le fonctionnement du service :
      </p>
      <ul>
        <li><strong>Supabase, Inc.</strong> — hébergement de la base de données, des images et de l'authentification. <em>Région : Union Européenne.</em></li>
        <li><strong>Vercel Inc.</strong> — hébergement de l'application et exécution des fonctions serveur (États-Unis).</li>
        <li><strong>Google LLC (API Gemini)</strong> — analyse automatique des <strong>images de cartes</strong> envoyées par l'utilisateur afin d'en extraire les informations (joueur, set, variation…). Seules les images de cartes soumises à l'analyse sont transmises.</li>
        <li><strong>Vercel Inc. (Vercel Web Analytics &amp; Speed Insights)</strong> — mesure d'audience et de performance du site. Cet outil est <strong>sans cookie</strong> et ne crée pas d'identifiant permettant de vous suivre. Il agrège des données de navigation anonymisées (pages consultées, type d'appareil, pays) sans stocker d'information sur votre appareil.</li>
        <li><strong>eBay</strong> — estimation indicative de la valeur des cartes. Seuls des <strong>mots-clés de recherche</strong> (nom de la carte, année, set…) sont transmis ; <strong>aucune donnée personnelle identifiante</strong> n'est envoyée.</li>
      </ul>

      <h2>5. Transferts hors Union Européenne</h2>
      <p>
        Certains sous-traitants (Vercel, Google) sont situés aux États-Unis. Ces transferts sont
        encadrés par les garanties appropriées prévues par le RGPD (clauses contractuelles types et/ou
        certification DPF – Data Privacy Framework). Dans la mesure du possible, les données de base sont
        hébergées dans une région <strong>Union Européenne</strong> chez Supabase.
      </p>

      <h2>6. Durée de conservation</h2>
      <ul>
        <li><strong>Données de compte et de collection :</strong> conservées tant que le compte est actif.</li>
        <li><strong>Après suppression du compte :</strong> suppression des données dans un délai de 30 jours, sauf obligation légale de conservation.</li>
        <li><strong>Journaux techniques :</strong> 12 mois maximum.</li>
      </ul>

      <h2>7. Vos droits</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Accès</strong> à vos données</li>
        <li><strong>Rectification</strong> des données inexactes</li>
        <li><strong>Effacement</strong> (« droit à l'oubli »)</li>
        <li><strong>Portabilité</strong> de vos données</li>
        <li><strong>Opposition</strong> et <strong>limitation</strong> du traitement</li>
        <li><strong>Retrait du consentement</strong> à tout moment (lorsqu'il constitue la base légale)</li>
      </ul>
      <p>
        Pour exercer ces droits, contactez : <strong>contact@memorabilius.fr</strong>. Une partie de ces
        actions (modification du profil, suppression du compte) est également disponible directement
        depuis votre espace personnel.
      </p>
      <p>
        Vous pouvez à tout moment introduire une réclamation auprès de la <strong>CNIL</strong>{' '}
        (<a href="https://www.cnil.fr">www.cnil.fr</a>) si vous estimez que vos droits ne sont pas
        respectés.
      </p>

      <h2>8. Cookies</h2>
      <p>Le site utilise :</p>
      <ul>
        <li><strong>Cookies strictement nécessaires</strong> : gestion de la session et de l'authentification. Ils ne nécessitent pas de consentement.</li>
      </ul>
      <p>
        Le site utilise par ailleurs un outil de mesure d'audience <strong>sans cookie</strong> (Vercel
        Web Analytics), qui ne dépose aucun traceur sur votre appareil et ne permet pas de vous
        identifier. <strong>Aucun cookie publicitaire ou de suivi tiers n'est utilisé</strong>, et le site
        n'affiche donc pas de bandeau de consentement aux cookies.
      </p>

      <h2>9. Sécurité</h2>
      <p>
        Les mots de passe sont stockés sous forme chiffrée. L'accès aux données est protégé par des
        mécanismes d'authentification et des règles d'accès au niveau de la base de données. Aucune
        transmission sur Internet n'étant totalement sûre, une sécurité absolue ne peut être garantie.
      </p>

      <h2>10. Mineurs</h2>
      <p>
        Le service n'est pas destiné aux enfants de moins de 15 ans sans autorisation du titulaire de
        l'autorité parentale, conformément à la réglementation française.
      </p>

      <h2>11. Modifications</h2>
      <p>
        La présente politique peut être mise à jour. La date de dernière mise à jour figure en haut du
        document. En cas de modification substantielle, les utilisateurs seront informés par un moyen
        approprié.
      </p>

      <h2>12. Contact</h2>
      <p>Pour toute question relative à vos données : <strong>contact@memorabilius.fr</strong>.</p>
    </LegalShell>
  )
}
