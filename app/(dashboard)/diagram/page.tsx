import { Metadata } from 'next';

import { DiagramWorkspace } from './_components/workspace';

export const metadata: Metadata = {
  title: 'Diagramme — Visualiseur de processus Mermaid'
};

export default function DiagramPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-10 lg:pb-16 lg:pt-12">
      <DiagramWorkspace />
    </div>
  );
}
