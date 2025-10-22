import type { Metadata } from 'next';
import { LandingPanels } from '@/components/landing-panels';

export const metadata: Metadata = {
  title: 'Satring — Process clarity made simple',
  description:
    'Unifiez votre processus dans une interface épurée : un espace, deux panneaux, zéro distraction.'
};

const highlights = [
  {
    title: 'Structure limpide',
    description: "Une colonne pour la vision, l'autre pour l'action. Rien de plus, rien de moins.",
    icon: 'sparkles'
  },
  {
    title: 'Sécurité intégrée',
    description: 'Supabase, RLS et Drizzle sont prêts pour vos prochaines étapes.',
    icon: 'shield'
  }
] as const;

export default function HomePage() {
  return <LandingPanels highlights={highlights} />;
}
