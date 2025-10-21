import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Diagramme — Visualiseur de processus Mermaid'
};

export default function DiagramPage() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Préparez votre diagramme</CardTitle>
          <CardDescription>
            Exportez les métriques mises à jour pour alimenter votre rendu Mermaid ou votre pipeline d’automatisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            La nouvelle base Next.js met en cache vos données via TanStack Query, applique des headers de sécurité stricts et
            propose une API typée pour récupérer vos snapshots.
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-950/95 p-4 text-slate-100">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed">
{`flowchart TD
  A[Découverte] --> B[Planification]
  B --> C{Atelier Mermaid}
  C -->|Comptes à jour| D[Publication]
  C -->|Refonte| E[Itération]
`}
            </pre>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <Code className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Intégrez l’API</CardTitle>
            <CardDescription>Consommez le snapshot pour générer vos diagrammes dynamiquement.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <code className="block rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            curl -H "Authorization: Bearer &lt;token&gt;" https://votre-app.vercel.app/api/workspace-snapshot
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
