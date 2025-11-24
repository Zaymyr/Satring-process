import type { Metadata } from 'next';

import { JobDescriptionExplorer } from '@/components/job-descriptions/job-description-explorer';

export const metadata: Metadata = {
  title: 'Fiches de poste dynamiques — PI',
  description:
    'Visualisez le périmètre de chaque rôle : sélectionnez un département, explorez les rôles et générez automatiquement leur fiche de poste à partir des actions assignées.'
};

export default function JobDescriptionsPage() {
  return <JobDescriptionExplorer />;
}
