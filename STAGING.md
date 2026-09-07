# Version de test (staging)

Une version de test **du code**, déployée séparément de la prod, mais qui partage
**la même base de données Supabase** (mêmes vraies données) — décision volontaire :
plus simple à tester avec du contenu réel, au prix d'un risque si un bug de la
version test écrit des données invalides (voir « Précautions » plus bas).

```
┌────────────────────┐        ┌────────────────────┐
│   PROD              │        │   STAGING (test)   │
│ branche  main       │        │ branche  staging   │
│ Vercel   memorabilius        │ Vercel  memorabilius-staging
│ Supabase projet A   │◄──────►│ Supabase projet A (le même)
│ memorabilius.fr     │        │ …-staging.vercel.app
└────────────────────┘        └────────────────────┘
```

Le code peut diverger librement (design, features en cours...). La séparation se
fait uniquement au niveau du **déploiement** : deux projets Vercel distincts sur
deux branches distinctes du même repo, avec les **mêmes variables Supabase**.

## 1. Créer le déploiement Vercel de test

1. La branche `staging` existe déjà (`git checkout staging`).
2. Vercel → **Add New Project** → importe le même repo GitHub.
   - Nom : `memorabilius-staging`.
   - **Production Branch** (Settings → Git) : `staging`.
3. **Environment Variables** : recopie toutes les variables de `.env.example`,
   avec les **mêmes valeurs Supabase que la prod** (même URL, même service role
   key — c'est voulu, mêmes données). Change uniquement :
   - `NEXT_PUBLIC_SITE_URL` = l'URL du déploiement de test.
   - Une **paire VAPID dédiée** (`npx web-push generate-vapid-keys`) — sinon les
     notifs push de test et de prod se mélangent pour un même utilisateur.
4. Deploy.

## 2. Précautions (données partagées)

- **Aucun cron sur cette branche** : `vercel.json` ici n'a volontairement pas de
  bloc `crons` — sinon les tâches planifiées (backup, recalcul stats, tick
  concours Discord, emails winback...) tourneraient EN DOUBLE avec la prod sur
  les mêmes vraies données. Ne rajoute pas de `crons` ici sans y repenser.
- **Migrations SQL** : une migration testée ici modifie la vraie base — teste
  d'abord sur une table/colonne non critique, ou fais un vrai backup avant un
  changement de schéma risqué.
- **Écritures destructives** : un bug qui supprime/écrase des données pendant un
  test affecte les vrais utilisateurs. Teste les flows de suppression avec ton
  propre compte, pas au hasard.
- **Bot Discord / webhooks externes** : ce code contient les mêmes routes
  (`/api/discord/route.ts`...), mais elles ne reçoivent des appels que si le
  service externe (Discord, Resend...) est configuré pour pointer vers CETTE
  URL — donc pas de conflit tant que seule la prod est enregistrée comme
  endpoint officiel.

## 3. Workflow

- Développe/teste sur la branche `staging` → déploiement de test automatique à
  chaque push.
- Quand une feature est validée et prête à devenir la vraie version :
  `git checkout main && git merge staging && git push` → prod.
