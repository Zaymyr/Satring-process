import { Metadata } from 'next';
import { WorkspaceMetrics } from '@/components/workspace-metrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Share2, Workflow } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tableau de bord — Visualiseur de processus Mermaid'
};

const highlights = [
  {
    title: 'Construire',
    description: 'Ajoutez des départements, organisez vos rôles et structurez vos fiches en quelques minutes.',
    icon: Workflow
  },
  {
    title: 'Visualiser',
    description: 'Générez automatiquement un diagramme Mermaid clair pour vos ateliers et présentations.',
    icon: Lightbulb
  },
  {
    title: 'Partager',
    description: 'Diffusez vos processus avec des liens sécurisés et gardez votre équipe alignée.',
    icon: Share2
  }
];

export default function DashboardPage() {
  return (
    <div className="space-y-12">
      <section className="section-card">
        <div className="section-card__header">
          <h2 className="text-xl font-semibold text-slate-900">Bienvenue dans votre studio de modélisation</h2>
          <p className="text-sm text-slate-600">
            Préparez votre prochain diagramme Mermaid avec une base sécurisée, typée et synchronisée avec Supabase.
          </p>
        </div>
        <div className="section-card__body space-y-10">
          <WorkspaceMetrics />
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Utilisez les formulaires typés, les politiques RLS et les RPC Supabase pour orchestrer chaque étape sans compromis
                sur la sécurité.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
