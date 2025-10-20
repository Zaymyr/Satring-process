# Mermaid Process Visualizer

This project is a single-page Mermaid playground where you can author and preview diagrams in real-time.

## Local development

Because the page is 100% static, you can open `index.html` directly in your browser or serve it with any static file server.

```bash
# for example, using the built-in Python server
python3 -m http.server 4173
```

Then visit http://localhost:4173 in your browser.

## Deploying to Vercel

1. [Create a Vercel account](https://vercel.com/signup) if you do not already have one.
2. Push this repository to your own GitHub/GitLab/Bitbucket account.
3. In the Vercel dashboard, click **Add New... → Project** and import the repository.
4. When prompted for a framework preset, choose **Other** so Vercel treats the project as a static site.
5. Leave the build command empty and keep the output directory blank — the included `vercel.json` tells Vercel to serve the root `index.html` automatically.
6. Click **Deploy**. Vercel will upload `index.html` and any other static assets and give you a live URL.

### Redeploying after changes

Whenever you push new commits to the connected branch, Vercel automatically triggers a redeploy. You can also trigger one manually from the **Deployments** tab by clicking **Redeploy**.

### Using a custom domain

1. In the Vercel dashboard, open your project and go to the **Domains** tab.
2. Add your domain and follow the DNS instructions Vercel provides (usually a `CNAME` record).
3. Once DNS propagates, Vercel will issue an SSL certificate automatically.

## Deployment configuration

The bundled `vercel.json` keeps Vercel in static hosting mode (no deprecated builders) while adding friendly defaults like clean URLs, cache-control headers, and a catch-all rewrite back to `index.html` for any deep links.

## Connecting Supabase for shared metrics

The UI can synchronise the workspace counters (departments, roles, diagram steps, etc.) through Supabase. To enable the
integration:

1. Create the table by running the included migration in your Supabase project:

   ```bash
   supabase migration up
   ```

   The migration adds a `workspace_snapshots` table that stores the aggregated metrics for your workspace.

2. Retrieve your Supabase project URL and anon key from the dashboard and expose them to the pages. The simplest way is to fill
   the placeholders that are already present in each HTML `<head>`:

   ```html
   <meta name="supabase-url" content="https://your-project.supabase.co" />
   <meta name="supabase-anon-key" content="your-public-anon-key" />
   ```

   You can also set a global `window.__SUPABASE_CONFIG__ = { url: '...', anonKey: '...' };` before the module scripts run if you
   prefer injecting the credentials from another script tag.

Once configured, the application stores metrics in Supabase while keeping localStorage as a fallback when the credentials are
missing or the network is unavailable.
