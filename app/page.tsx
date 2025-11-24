import type { Metadata } from 'next';
import { LandingPanels } from '@/components/landing-panels';

export const metadata: Metadata = {
  title: 'PI — Process Intelligence',
  description:
    'Unifiez votre processus dans une interface épurée : un espace, deux panneaux, zéro distraction.'
};

export default function HomePage() {
  return <LandingPanels highlights={[]} />;
}
