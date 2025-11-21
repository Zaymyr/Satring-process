import { z } from 'zod';

import { jobDescriptionSectionsSchema } from '@/lib/validation/job-description';

export type JobDescriptionSections = z.infer<typeof jobDescriptionSectionsSchema>;

export type JobDescriptionBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

const headingLabels = [
  'mission',
  'mission generale',
  'responsabilites',
  'responsabilites cles',
  'responsabilites clés',
  'indicateurs',
  'indicateurs de succes',
  'indicateurs de succès',
  'collaborations',
  'collaborations internes',
  'profil',
  'contexte'
];

const headingSchema = z.string().min(1);

const normalizeLabel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const looksLikeHeading = (value: string) => {
  const safeValue = headingSchema.safeParse(value);
  if (!safeValue.success) {
    return false;
  }

  const normalized = normalizeLabel(safeValue.data);
  return headingLabels.some((label) => normalized.startsWith(label));
};

const flushParagraph = (buffer: string[], blocks: JobDescriptionBlock[]) => {
  if (buffer.length === 0) {
    return;
  }

  const paragraph = buffer.join(' ');
  blocks.push({ type: 'paragraph', text: paragraph });
  buffer.length = 0;
};

const flushList = (buffer: string[], blocks: JobDescriptionBlock[]) => {
  if (buffer.length === 0) {
    return;
  }

  blocks.push({ type: 'list', items: [...buffer] });
  buffer.length = 0;
};

export const parseJobDescriptionContent = (content: string): JobDescriptionBlock[] => {
  const lines = content.split(/\r?\n/);
  const blocks: JobDescriptionBlock[] = [];

  const paragraphBuffer: string[] = [];
  const listBuffer: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listBuffer, blocks);
      continue;
    }

    const bulletMatch = line.match(/^[-•]\s*(.+)$/);
    if (bulletMatch && bulletMatch[1]) {
      flushParagraph(paragraphBuffer, blocks);
      listBuffer.push(bulletMatch[1].trim());
      continue;
    }

    const headingMatch = line.match(/^(?<label>[^:]+):?\s*(?<rest>.*)$/);
    const headingLabel = headingMatch?.groups?.label?.trim() ?? '';
    const headingRest = headingMatch?.groups?.rest?.trim() ?? '';

    if (headingLabel && looksLikeHeading(headingLabel)) {
      flushParagraph(paragraphBuffer, blocks);
      flushList(listBuffer, blocks);
      blocks.push({ type: 'heading', text: headingLabel.replace(/:$/, '') });

      if (headingRest) {
        paragraphBuffer.push(headingRest);
      }

      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph(paragraphBuffer, blocks);
  flushList(listBuffer, blocks);

  return blocks;
};

export const collapseBlocksToText = (blocks: JobDescriptionBlock[]): string[] => {
  const lines: string[] = [];

  for (const block of blocks) {
    if (block.type === 'heading') {
      lines.push(block.text.toUpperCase());
      continue;
    }

    if (block.type === 'paragraph') {
      lines.push(block.text);
      continue;
    }

    lines.push(...block.items.map((item) => `• ${item}`));
  }

  return lines;
};

const normalizeList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|•|-\s+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const classifyHeading = (value: string) => {
  const normalized = normalizeLabel(value);

  if (normalized.includes('mission')) {
    return 'mission' as const;
  }

  if (normalized.includes('responsab')) {
    return 'responsibilities' as const;
  }

  if (normalized.includes('objectif') || normalized.includes('indicateur')) {
    return 'objectives' as const;
  }

  if (normalized.includes('collabor')) {
    return 'collaboration' as const;
  }

  return 'other' as const;
};

const buildSectionsFromBlocks = (blocks: JobDescriptionBlock[]): JobDescriptionSections => {
  const responsibilities: string[] = [];
  const objectives: string[] = [];
  const collaboration: string[] = [];
  const mission: string[] = [];
  let currentSection: ReturnType<typeof classifyHeading> = 'other';

  for (const block of blocks) {
    if (block.type === 'heading') {
      currentSection = classifyHeading(block.text);
      continue;
    }

    if (block.type === 'list') {
      if (currentSection === 'responsibilities') {
        responsibilities.push(...block.items);
      } else if (currentSection === 'objectives') {
        objectives.push(...block.items);
      } else if (currentSection === 'collaboration') {
        collaboration.push(...block.items);
      } else if (currentSection === 'mission') {
        mission.push(...block.items);
      }
      continue;
    }

    if (block.type === 'paragraph') {
      if (currentSection === 'responsibilities') {
        responsibilities.push(block.text);
      } else if (currentSection === 'objectives') {
        objectives.push(block.text);
      } else if (currentSection === 'collaboration') {
        collaboration.push(block.text);
      } else if (currentSection === 'mission') {
        mission.push(block.text);
      }
    }
  }

  const cleanedResponsibilities = normalizeList(responsibilities);
  const cleanedObjectives = normalizeList(objectives);
  const cleanedCollaboration = normalizeList(collaboration);

  const missionText = mission.join(' ').trim();

  return {
    title: 'Fiche de poste',
    generalDescription: missionText.length > 0 ? missionText : '',
    responsibilities: cleanedResponsibilities.length > 0 ? cleanedResponsibilities : [],
    objectives: cleanedObjectives.length > 0 ? cleanedObjectives : [],
    collaboration: cleanedCollaboration.length > 0 ? cleanedCollaboration : []
  };
};

export const ensureJobDescriptionSections = (params: {
  content: string;
  sections?: Partial<JobDescriptionSections>;
  fallbackTitle?: string;
}): JobDescriptionSections => {
  const parsedSections = jobDescriptionSectionsSchema.partial().safeParse(params.sections ?? {});
  const baseSections = parsedSections.success ? parsedSections.data : {};

  const blocks = parseJobDescriptionContent(params.content);
  const derived = buildSectionsFromBlocks(blocks);

  const title = (baseSections.title ?? params.fallbackTitle ?? derived.title).trim() || 'Fiche de poste';
  const generalDescription = (baseSections.generalDescription ?? derived.generalDescription ?? '').trim();
  const responsibilities = normalizeList(baseSections.responsibilities ?? derived.responsibilities);
  const objectives = normalizeList(baseSections.objectives ?? derived.objectives);
  const collaboration = normalizeList(baseSections.collaboration ?? derived.collaboration);

  return jobDescriptionSectionsSchema.parse({
    title,
    generalDescription: generalDescription.length > 0 ? generalDescription : params.content.trim(),
    responsibilities: responsibilities.length > 0 ? responsibilities : ["Responsabilités à préciser."],
    objectives: objectives.length > 0 ? objectives : ["Objectifs et indicateurs à préciser."],
    collaboration: collaboration.length > 0 ? collaboration : ["Collaborations attendues à préciser."]
  });
};

export const stringifySections = (sections: JobDescriptionSections) => {
  const responsibilities = sections.responsibilities.map((item) => `- ${item}`).join('\n');
  const objectives = sections.objectives.map((item) => `- ${item}`).join('\n');
  const collaboration = sections.collaboration.map((item) => `- ${item}`).join('\n');

  return [
    sections.title,
    '',
    `Mission générale: ${sections.generalDescription}`,
    '',
    'Responsabilités:',
    responsibilities,
    '',
    'Objectifs et indicateurs:',
    objectives,
    '',
    'Collaboration attendue:',
    collaboration
  ]
    .filter((line) => line !== undefined)
    .join('\n');
};
