import type { Metadata } from 'next';
import { RaciBuilder } from '@/components/raci/raci-builder';

export const metadata: Metadata = {
  title: 'Matrices RACI par département — Satring',
  description:
    'Créez rapidement des matrices RACI pour chaque département : définissez les rôles, les actions et clarifiez les responsabilités.'
};

export default function RaciPage() {
  return <RaciBuilder />;
}
