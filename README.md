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
5. Leave the build command empty and set the output directory to `.` (the repository root) because `index.html` lives at the root.
6. Click **Deploy**. Vercel will upload `index.html` and any other static assets and give you a live URL.

### Redeploying after changes

Whenever you push new commits to the connected branch, Vercel automatically triggers a redeploy. You can also trigger one manually from the **Deployments** tab by clicking **Redeploy**.

### Using a custom domain

1. In the Vercel dashboard, open your project and go to the **Domains** tab.
2. Add your domain and follow the DNS instructions Vercel provides (usually a `CNAME` record).
3. Once DNS propagates, Vercel will issue an SSL certificate automatically.

## Deployment configuration

A minimal `vercel.json` file is included so Vercel knows to serve the root `index.html` file and lets you expand the configuration later if you add more routes or headers.
