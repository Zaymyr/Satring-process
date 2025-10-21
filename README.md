# Visualiseur de processus Mermaid (Next.js)

Plateforme moderne pour cartographier vos processus avec un socle Next.js 14 (App Router), Supabase et Drizzle ORM. Le tableau de bord protège l’accès par l’authentification Supabase, applique des politiques RLS et expose une API typée pour synchroniser les métriques de votre workspace.

## Stack principale

- [Next.js 14](https://nextjs.org/) (App Router) en TypeScript strict
- [Supabase](https://supabase.com/) pour l’authentification, la base de données Postgres et le temps réel
- [Drizzle ORM](https://orm.drizzle.team/) + migrations SQL Supabase
- [TanStack Query](https://tanstack.com/query/latest) pour la mise en cache client
- [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) et [Lucide](https://lucide.dev/)
- Validation par [Zod](https://zod.dev/) et formulaires [react-hook-form](https://react-hook-form.com/)

## Prérequis

- Node.js 20+
- Supabase CLI (optionnel pour exécuter les migrations en local)
- Variables d’environnement renseignées (voir `.env.example`)

## Démarrage local

```bash
npm install
npm run dev
```

L’application tourne ensuite sur http://localhost:3000. Les routes `/`, `/departments` et `/diagram` nécessitent une session Supabase active.

## Scripts npm

| Commande            | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Lance le serveur de développement Next.js               |
| `npm run build`     | Compile l’application pour la production                |
| `npm run start`     | Démarre l’application construite                        |
| `npm run lint`      | Vérifie le code avec ESLint                             |
| `npm run db:generate` | Génère les fichiers de migration Drizzle (optionnel)  |
| `npm run db:migrate`  | Pousse le schéma Drizzle vers la base de données      |

## Configuration Supabase

1. Créez un projet Supabase et renseignez les variables d’environnement :

   ```bash
   cp .env.example .env
   # Puis remplissez NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_DB_URL
   ```

2. Appliquez les migrations SQL pour provisionner la table `workspace_snapshots`, les politiques RLS et la fonction RPC :

   ```bash
   supabase db push
   # ou
   supabase migration up
   ```

3. Configurez un fournisseur d’e-mails pour l’envoi des liens magiques (onglet Authentication > Providers).

## Sécurité et bonnes pratiques

- **Authentification SSR** : toutes les routes protégées utilisent `@supabase/ssr` et les cookies pour récupérer la session.
- **RLS activé** : les migrations Supabase créent des politiques limitées au rôle `authenticated` et verrouillent l’accès par `owner_id`.
- **API typée** : `/api/workspace-snapshot` valide toutes les entrées/sorties via Zod et s’appuie sur une fonction RPC Supabase pour appliquer l’upsert.
- **En-têtes renforcés** : le middleware applique CSP, rate limiting léger et headers de sécurité supplémentaires.
- **Tests E2E** : intégrez Playwright ou Cypress au besoin ; la configuration actuelle est prête pour Vercel.

## Déploiement sur Vercel

1. Poussez le dépôt sur votre compte GitHub/GitLab.
2. Dans Vercel, importez le projet et choisissez le preset **Next.js**.
3. Définissez les variables d’environnement Supabase dans le tableau de bord Vercel.
4. Déployez : Vercel détecte automatiquement la configuration Next.js + App Router.

Une fois le déploiement en place, les liens magiques Supabase peuvent rediriger vers `https://votre-domaine/auth/callback` pour établir la session.
