# Sport Analytics — Prédictions de matchs

Site complet : **Node.js + Express + PostgreSQL + frontend responsive + API sportive + IA**, prêt pour Render.

## Ce que fait le site

- Récupère les matchs à venir d'une ligue via une API sportive externe (TheSportsDB, gratuite).
- Stocke les matchs, équipes et statistiques dans une base PostgreSQL.
- Calcule une **prédiction** (probabilités victoire domicile / nul / victoire extérieur + score probable) à partir de la forme récente des équipes.
- Si tu ajoutes une clé Anthropic (`ANTHROPIC_API_KEY`), le site génère en plus une **analyse en langage naturel** du match (mode IA). Sans clé, il continue de fonctionner avec le moteur statistique interne — aucune fonctionnalité n'est bloquée.
- **Inscription / connexion sécurisées** : mots de passe hashés (bcrypt), sessions par token JWT.
- **Vérification email** : lien de confirmation envoyé par email à l'inscription.
- **Vérification téléphone** : code à 6 chiffres envoyé par SMS à l'inscription.
- Les analyses de matchs sont réservées aux clients dont l'email **et** le téléphone sont vérifiés.
- **Espace Administrateur** protégé : liste des clients (avec email et téléphone), statistiques du site, suspension/suppression de comptes, promotion en administrateur, gestion des matchs.
- Interface web responsive (mobile, tablette, ordinateur).

### Mode "test" sans configuration

Tant que tu n'as pas configuré de service SMTP (email) ou Twilio (SMS), le site **fonctionne quand même** : le lien de vérification email et le code SMS sont simplement affichés dans les logs du serveur (onglet **Logs** sur Render, ou ton terminal en local). Idéal pour tester avant de brancher de vrais services.

## Structure du projet

```
sport-analytics/
├── src/
│   ├── server.js          → serveur Express principal
│   ├── config/
│   │   ├── db.js          → connexion PostgreSQL
│   │   ├── mailer.js      → envoi d'emails (vérification)
│   │   └── sms.js         → envoi de SMS (vérification, via Twilio)
│   ├── middleware/auth.js → vérification JWT + contrôle des rôles (admin)
│   ├── utils/tokens.js    → génération des tokens/codes de vérification
│   ├── routes/
│   │   ├── auth.js        → inscription, connexion, vérification email/téléphone
│   │   ├── admin.js       → espace administrateur (clients, statistiques, matchs)
│   │   ├── matches.js     → matchs
│   │   └── predictions.js → prédictions (réservées aux comptes vérifiés)
│   ├── services/          → appel API sportive + moteur de prédiction IA
│   └── db/schema.sql      → structure de la base de données (inclut la table users)
├── public/                → frontend (HTML/CSS/JS, responsive)
│   ├── index.html / register.html / login.html / verify-email.html / admin.html
│   └── js/ (app.js, auth.js, admin.js)
├── render.yaml            → déploiement Render automatisé (Blueprint)
└── .env.example           → variables d'environnement à configurer
```

## Étape 1 — Tester en local (optionnel mais recommandé)

1. Installe les dépendances :
   ```
   npm install
   ```
2. Copie `.env.example` en `.env` et remplis `DATABASE_URL` avec une base PostgreSQL locale ou distante.
3. Initialise la base :
   ```
   npm run db:init
   ```
4. Lance le serveur :
   ```
   npm run dev
   ```
5. Ouvre `http://localhost:3000`.

## Étape 2 — Mettre le projet sur GitHub

1. Crée un nouveau dépôt sur GitHub (ex : `sport-analytics`).
2. Dans le dossier du projet :
   ```
   git init
   git add .
   git commit -m "Premier commit"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/sport-analytics.git
   git push -u origin main
   ```

## Étape 3 — Déployer sur Render (méthode simple avec Blueprint)

1. Va sur [render.com](https://render.com) et connecte-toi (ou crée un compte).
2. Clique sur **New +** → **Blueprint**.
3. Sélectionne ton dépôt GitHub `sport-analytics`. Render détecte automatiquement le fichier `render.yaml` et propose de créer :
   - un **service web** (ton site)
   - une **base PostgreSQL** gratuite
4. Clique sur **Apply** — Render crée les deux ressources et les relie automatiquement (`DATABASE_URL` est configuré tout seul).
5. Une fois le déploiement terminé, ouvre l'URL fournie par Render. La base est vide au début.

## Étape 4 — Initialiser la base de données sur Render

1. Dans le tableau de bord Render, ouvre ton service web → onglet **Shell**.
2. Lance :
   ```
   npm run db:init
   ```
   Cela crée les tables (`matches`, `teams`, `predictions`, etc.) dans la base Render.

## Étape 5 — Créer ton compte Administrateur

1. Avant de déployer (ou avant ta première inscription), configure la variable `ADMIN_EMAIL` avec **ton propre email**.
2. Inscris-toi normalement sur le site avec cet email → ton compte est automatiquement créé avec le rôle `admin`.
3. Vérifie ton email (lien reçu) et ton téléphone (code SMS reçu — ou visible dans les logs si Twilio n'est pas configuré).
4. Connecte-toi : tu es redirigé automatiquement vers `/admin.html`, ton espace administrateur.
5. Pour promouvoir quelqu'un d'autre administrateur plus tard, utilise le bouton "Promouvoir admin" depuis la liste des clients dans l'espace admin.

## Étape 6 — (Optionnel) Activer l'envoi réel d'emails et de SMS

Par défaut, les liens/codes de vérification s'affichent dans les logs (pratique pour démarrer). Pour un vrai lancement :

- **Email** : crée un compte SMTP (Gmail avec mot de passe d'application, Brevo, Mailjet...) et renseigne `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` dans les variables d'environnement Render.
- **SMS** : crée un compte [Twilio](https://twilio.com), achète un numéro, et renseigne `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

Redéploie après chaque changement de variable (Render le fait automatiquement).

## Étape 7 — (Optionnel) Activer l'analyse IA

1. Dans le tableau de bord Render, ouvre ton service web → **Environment**.
2. Ajoute la variable `ANTHROPIC_API_KEY` avec ta clé API Anthropic.
3. Redéploie (Render redéploie automatiquement après un changement de variable).
4. Les nouvelles prédictions afficheront désormais une analyse en français en plus des probabilités.

## Étape 8 — Utiliser le site

1. Ouvre le site déployé.
2. Un visiteur peut voir les matchs, mais doit **s'inscrire et vérifier son email + téléphone** pour accéder aux analyses.
3. Dans "Synchroniser une ligue", entre un identifiant de ligue TheSportsDB (ex : `4328` pour la Premier League anglaise — la liste complète est sur thesportsdb.com/api.php).
4. Une fois connecté, clique sur **"Voir l'analyse"** pour un match → la prédiction est calculée et affichée.
5. En tant qu'administrateur, va sur `/admin.html` pour voir tous les clients inscrits (avec leur email et téléphone), les statistiques du site, et gérer les comptes.

## Changer d'API sportive

Le fichier `src/services/sportsApi.js` centralise tous les appels à l'API sportive. Pour utiliser une autre API (API-Football, SportRadar, etc.), il suffit de modifier les fonctions de ce fichier — aucune autre partie du code n'a besoin de changer.

## Notes importantes

- Le plan gratuit de Render met le service en veille après une période d'inactivité ; le premier chargement après une pause peut prendre 30 à 60 secondes.
- Les prédictions sont des estimations statistiques, pas des garanties — c'est précisé dans l'analyse IA elle-même.
