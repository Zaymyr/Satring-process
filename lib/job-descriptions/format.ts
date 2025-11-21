import { z } from 'zod';

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
