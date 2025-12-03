import { DEFAULT_DEPARTMENT_COLOR } from '@/lib/validation/department';

import { HEX_COLOR_REGEX } from './colors';

const CLUSTER_STYLE_TEXT_COLOR = '#0f172a';
const CLUSTER_FILL_OPACITY = 0.18;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const wrapStepLabel = (value: string) => {
  const normalized = value.trim();
  const source = normalized.length > 0 ? normalized : 'Step';
  const maxCharsPerLine = 18;
  const words = source.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const tentative = currentLine ? `${currentLine} ${word}` : word;
    if (tentative.length <= maxCharsPerLine) {
      currentLine = tentative;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      if (word.length > maxCharsPerLine) {
        const segments = word.match(new RegExp(`.{1,${maxCharsPerLine}}`, 'g')) ?? [word];
        lines.push(...segments.slice(0, -1));
        currentLine = segments.at(-1) ?? '';
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const formatDepartmentClusterLabel = (value: string) => {
  const trimmed = value.trim();
  const base = trimmed.length > 0 ? trimmed : 'Department';
  const escaped = escapeHtml(base);
  return escaped.replace(/&quot;/g, '\\"');
};

const getClusterStyleDeclaration = (clusterId: string, color: string) => {
  const normalized = HEX_COLOR_REGEX.test(color) ? color : DEFAULT_DEPARTMENT_COLOR;
  return `style ${clusterId} fill:${normalized},stroke:${normalized},color:${CLUSTER_STYLE_TEXT_COLOR},stroke-width:2px,fill-opacity:${CLUSTER_FILL_OPACITY};`;
};

export {
  CLUSTER_FILL_OPACITY,
  CLUSTER_STYLE_TEXT_COLOR,
  escapeHtml,
  formatDepartmentClusterLabel,
  getClusterStyleDeclaration,
  wrapStepLabel
};
