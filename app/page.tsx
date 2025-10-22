import type { Metadata } from 'next';
import { LandingPanels } from '@/components/landing-panels';

export const metadata: Metadata = {
  title: 'Satring — Process clarity made simple',
  description:
    'Unifiez votre processus dans une interface épurée : un espace, deux panneaux, zéro distraction.'
};

const highlights = [
  {
    title: 'Actions et décisions',
    description: 'Documentez les noeuds clés de votre parcours et ajustez-les en temps réel.',
    icon: 'sparkles'
  },
  {
    title: 'Cadre sécurisé',
    description: 'Supabase, RLS et Drizzle orchestrent vos données sans compromettre la clarté.',
    icon: 'shield'
  }
] as const;

export default function HomePage() {
  return <LandingPanels highlights={highlights} />;
}
