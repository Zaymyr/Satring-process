import { useMemo } from 'react';

import { FALLBACK_STEP_FILL_ALPHA, toRgba } from '@/lib/process/colors';
import { normalizeBranchTarget, normalizeDraftName, normalizeNameKey } from '@/lib/process/normalizers';
import { wrapStepLabel } from '@/lib/process/mermaid-format';
import type { Step } from '@/lib/process/types';
import type { DepartmentWithDraftStatus } from './LandingPanelsShell';
import type { ProcessStep } from '@/lib/validation/process';
import type { Role } from '@/lib/validation/role';

type ProcessDiagramProps = {
  steps: ProcessStep[];
  departments: DepartmentWithDraftStatus[];
  areDepartmentsVisible: boolean;
  defaultDepartmentName: string;
  defaultRoleName: string;
  getStepDisplayLabel: (step: Step) => string;
};

export function ProcessDiagram({
  steps,
  departments,
  areDepartmentsVisible,
  defaultDepartmentName,
  defaultRoleName,
  getStepDisplayLabel
}: ProcessDiagramProps) {
  const diagram = useMemo(() => {
    if (steps.length === 0) {
      return null;
    }

    const centerX = 450;
    const canvasWidth = 900;
    const horizontalPadding = 64;
    const verticalPadding = 120;
    const stackSpacing = 80;
    const charWidth = 9;
    const lineHeight = 26;
    const maxWidth = 320;
    const minWidth = 180;
    const minActionHeight = 88;
    const minDecisionHeight = 120;
    const minTerminalHeight = 96;
    const contentPaddingY = 36;

    const stepById = new Map(steps.map((step) => [step.id, step] as const));
    const departmentById = new Map(departments.map((department) => [department.id, department] as const));
    const departmentByName = new Map(
      departments
        .map((department) => {
          const key = normalizeNameKey(department.name);
          return key ? ([key, department] as const) : null;
        })
        .filter(Boolean) as Array<readonly [string, DepartmentWithDraftStatus]>
    );
    const roleById = new Map<string, { role: Role; department: DepartmentWithDraftStatus }>();

    for (const department of departments) {
      for (const role of department.roles) {
        roleById.set(role.id, { role, department });
      }
    }

    const nodes = steps.reduce<
      Array<{
        step: Step;
        centerY: number;
        halfHeight: number;
        lines: string[];
        width: number;
        height: number;
        department: DepartmentWithDraftStatus | undefined;
        roleColor: string | null;
      }>
    >((acc, step) => {
      const baseLabel = getStepDisplayLabel(step);
      const labelLines = wrapStepLabel(baseLabel);
      const displayLines = [...labelLines];
      const roleEntry = step.roleId ? roleById.get(step.roleId) : undefined;
      const departmentFromStep = step.departmentId ? departmentById.get(step.departmentId) : undefined;
      const draftDepartmentName = normalizeDraftName(step.draftDepartmentName);
      const departmentFromDraft = draftDepartmentName
        ? departmentByName.get(normalizeNameKey(draftDepartmentName) ?? '')
        : undefined;
      const department = areDepartmentsVisible
        ? roleEntry?.department ?? departmentFromStep ?? departmentFromDraft
        : undefined;
      const departmentLabel = department?.name ?? draftDepartmentName ?? roleEntry?.department.name ?? defaultDepartmentName;
      const role = roleEntry?.role;
      const roleLabel = role?.name ?? normalizeDraftName(step.draftRoleName) ?? defaultRoleName;
      const stepIndex = acc.length;
      const defaultNextStep = steps[stepIndex + 1];
      const fallbackLabel = defaultNextStep ? getStepDisplayLabel(defaultNextStep) : '—';

      const metadataLines: string[] = [];

      if (roleLabel) {
        metadataLines.push(`Rôle : ${roleLabel}`);
      }

      if (areDepartmentsVisible && departmentLabel) {
        metadataLines.push(`Département : ${departmentLabel}`);
      }

      if (metadataLines.length > 0) {
        displayLines.push('');
        displayLines.push(...metadataLines);
      }

      if (step.type === 'decision') {
        const resolveTargetLabel = (targetId: string | null | undefined) => {
          const normalized = normalizeBranchTarget(targetId);
          if (!normalized) {
            return fallbackLabel;
          }

          const target = stepById.get(normalized);
          return target ? getStepDisplayLabel(target) : fallbackLabel;
        };

        const yesLabel = resolveTargetLabel(step.yesTargetId);
        const noLabel = resolveTargetLabel(step.noTargetId);
        const branchLines: string[] = [];

        if (yesLabel) {
          branchLines.push(`Oui → ${yesLabel}`);
        }
        if (noLabel) {
          branchLines.push(`Non → ${noLabel}`);
        }

        if (branchLines.length > 0) {
          displayLines.push('');
          displayLines.push(...branchLines);
        }
      }

      const longestLine = displayLines.reduce((max, line) => Math.max(max, line.length), 0);
      const rawWidth = longestLine * charWidth + horizontalPadding;
      const width = Math.min(maxWidth, Math.max(minWidth, rawWidth));
      const contentHeight = Math.max(displayLines.length, 1) * lineHeight;
      let height = contentHeight + contentPaddingY;

      if (step.type === 'action') {
        height = Math.max(height, minActionHeight);
      } else if (step.type === 'decision') {
        height = Math.max(height, minDecisionHeight);
      } else {
        height = Math.max(height, minTerminalHeight);
      }

      const halfHeight = height / 2;
      const previous = acc.at(-1);
      const centerY = previous
        ? previous.centerY + previous.halfHeight + stackSpacing + halfHeight
        : verticalPadding + halfHeight;

      acc.push({
        step,
        centerY,
        halfHeight,
        lines: displayLines,
        width,
        height,
        department,
        roleColor: role?.color ?? null
      });
      return acc;
    }, []);

    const canvasHeight =
      (nodes.at(-1)?.centerY ?? verticalPadding) + (nodes.at(-1)?.halfHeight ?? 0) + verticalPadding;

    const diamondPoints = (centerY: number, width: number, height: number) =>
      [
        `${centerX},${centerY - height / 2}`,
        `${centerX + width / 2},${centerY}`,
        `${centerX},${centerY + height / 2}`,
        `${centerX - width / 2},${centerY}`
      ].join(' ');

    return (
      <svg
        role="presentation"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="max-h-full w-full max-w-6xl opacity-90"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="process-arrow"
            viewBox="0 0 12 12"
            refX="6"
            refY="6"
            markerWidth="10"
            markerHeight="10"
            orient="auto"
          >
            <path d="M0 0L12 6L0 12Z" fill="#0f172a" />
          </marker>
          <filter id="process-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="rgba(15,23,42,0.18)" />
          </filter>
        </defs>
        {nodes.slice(0, -1).map((node, index) => {
          const nextNode = nodes[index + 1];
          const startY = node.centerY + node.halfHeight;
          const endY = nextNode.centerY - nextNode.halfHeight;

          return (
            <path
              key={`edge-${node.step.id}-${nextNode.step.id}`}
              d={`M ${centerX} ${startY} C ${centerX} ${startY + 48} ${centerX} ${endY - 48} ${centerX} ${endY}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth={2}
              markerEnd="url(#process-arrow)"
              opacity={0.7}
            />
          );
        })}
        {nodes.map((node) => {
          const { step, centerY, lines, width, height, department, roleColor } = node;
          const isTerminal = step.type === 'start' || step.type === 'finish';
          const isDecision = step.type === 'decision';
          const isAction = step.type === 'action';
          const baseFill = isTerminal ? '#f8fafc' : '#ffffff';
          const strokeDefault = '#0f172a';
          const departmentColor = areDepartmentsVisible ? department?.color ?? null : null;
          const colorSource = roleColor ?? departmentColor;
          const fillColor = colorSource ? toRgba(colorSource, FALLBACK_STEP_FILL_ALPHA, baseFill) : baseFill;
          const strokeColor = colorSource ?? strokeDefault;
          const blockOffset = ((lines.length - 1) * 24) / 2;

          return (
            <g key={step.id} filter="url(#process-shadow)">
              {isTerminal ? (
                <ellipse
                  cx={centerX}
                  cy={centerY}
                  rx={width / 2}
                  ry={height / 2}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              {isAction ? (
                <rect
                  x={centerX - width / 2}
                  y={centerY - height / 2}
                  width={width}
                  height={height}
                  rx={24}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              {isDecision ? (
                <polygon
                  points={diamondPoints(centerY, width, height)}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={2}
                />
              ) : null}
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                fontSize={20}
                fontWeight={600}
                fill="#0f172a"
                dominantBaseline="middle"
              >
                {lines.map((line, lineIndex) => {
                  const dy = lineIndex === 0 ? (lines.length > 1 ? -blockOffset : 0) : 24;

                  return (
                    <tspan key={`${step.id}-line-${lineIndex}`} x={centerX} dy={dy}>
                      {line}
                    </tspan>
                  );
                })}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }, [
    areDepartmentsVisible,
    defaultDepartmentName,
    defaultRoleName,
    departments,
    getStepDisplayLabel,
    steps
  ]);

  return diagram;
}
