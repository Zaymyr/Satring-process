import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Départements & rôles — Visualiseur de processus Mermaid'
};

const tips = [
  'Assignez une couleur par département pour les retrouver facilement dans le diagramme.',
  'Renseignez les notes clés pour partager le contexte avec vos équipes transverses.',
  'Ajoutez les rôles directement dans l’arborescence pour garder une vision hiérarchique complète.'
];

export default function DepartmentsPage() {
  return (
    <div className="space-y-10">
      <Card>
        <CardHeader>
          <CardTitle>Structurez vos équipes</CardTitle>
          <CardDescription>
            Créez vos départements, imbriquez vos rôles et synchronisez les compteurs grâce au snapshot Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Utilisez les formulaires de la page d’accueil pour suivre l’évolution de vos effectifs. Chaque mise à jour est
            validée par Zod, stockée via une fonction RPC Supabase et protégée par des politiques RLS.
          </p>
          <Button asChild>
            <Link href="/">Retour au tableau de bord</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Conseils de modélisation</CardTitle>
          <CardDescription>Alignez vos équipes avant de générer le diagramme Mermaid.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
