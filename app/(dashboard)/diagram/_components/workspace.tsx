'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Minus,
  Plus,
  Trash2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

const START_NODE_LABEL = 'Lancement';
const END_NODE_LABEL = 'Mise en production';

const rolePalette = [
  '#38bdf8',
  '#f472b6',
  '#facc15',
  '#a855f7',
  '#fb7185',
  '#22d3ee',
  '#f97316'
] as const;

const orientationOptions = [
  { value: 'TB', label: 'Vertical (TB)' },
  { value: 'LR', label: 'Horizontal (LR)' },
  { value: 'BT', label: 'Bas → Haut (BT)' },
  { value: 'RL', label: 'Droite → Gauche (RL)' }
] as const;

type Orientation = (typeof orientationOptions)[number]['value'];

type Role = {
  id: string;
  name: string;
  color: string;
};

type Department = {
  id: string;
  name: string;
  roles: Role[];
  isExpanded: boolean;
};

type StepType = 'step' | 'decision';

type Step = {
  id: string;
  label: string;
  departmentId: string | null;
  roleId: string | null;
  type: StepType;
};

type MermaidModule = {
  initialize: (config: {
    startOnLoad: boolean;
    securityLevel: string;
    theme: string;
    themeVariables: Record<string, string>;
  }) => void;
  render: (id: string, definition: string) => Promise<{ svg: string }>;
};

const initialDepartments: Department[] = [
  {
    id: 'dept-operations',
    name: 'Opérations',
    isExpanded: true,
    roles: [
      { id: 'role-operations-coordination', name: 'Coordinateur·rice', color: '#38bdf8' },
      { id: 'role-operations-analyste', name: 'Analyste opérations', color: '#facc15' }
    ]
  },
  {
    id: 'dept-produit',
    name: 'Produit',
    isExpanded: true,
    roles: [{ id: 'role-produit-responsable', name: 'Product Manager', color: '#f472b6' }]
  },
  {
    id: 'dept-ingenierie',
    name: 'Ingénierie',
    isExpanded: true,
    roles: [
      { id: 'role-ingenierie-techlead', name: 'Tech Lead', color: '#a855f7' },
      { id: 'role-ingenierie-developpeur', name: 'Développeur·euse', color: '#22d3ee' }
    ]
  }
];

const initialSteps: Step[] = [
  {
    id: 'step-planifier',
    label: 'Planifier',
    departmentId: 'dept-operations',
    roleId: 'role-operations-coordination',
    type: 'step'
  },
  {
    id: 'step-construire',
    label: 'Construire',
    departmentId: 'dept-ingenierie',
    roleId: 'role-ingenierie-techlead',
    type: 'step'
  }
];

export function DiagramWorkspace() {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [showDepartments, setShowDepartments] = useState(true);
  const [showRoles, setShowRoles] = useState(true);
  const [orientation, setOrientation] = useState<Orientation>('TB');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});
  const roleColorIndex = useRef<number>(
    initialDepartments.reduce((count, department) => count + department.roles.length, 0)
  );
  const [startStepId, setStartStepId] = useState<string | null>(initialSteps[0]?.id ?? null);
  const [endStepId, setEndStepId] = useState<string | null>(
    initialSteps[initialSteps.length - 1]?.id ?? null
  );

  const departmentsMap = useMemo(() => {
    return new Map(departments.map((department) => [department.id, department]));
  }, [departments]);

  const rolesMap = useMemo(() => {
    const map = new Map<string, Role>();
    departments.forEach((department) => {
      department.roles.forEach((role) => {
        map.set(role.id, role);
      });
    });
    return map;
  }, [departments]);

  useEffect(() => {
    if (steps.length === 0) {
      if (startStepId !== null) {
        setStartStepId(null);
      }
      if (endStepId !== null) {
        setEndStepId(null);
      }
      return;
    }

    if (!startStepId || !steps.some((step) => step.id === startStepId)) {
      setStartStepId(steps[0].id);
    }

    if (!endStepId || !steps.some((step) => step.id === endStepId)) {
      setEndStepId(steps[steps.length - 1].id);
    }
  }, [steps, startStepId, endStepId]);

  const mermaidDefinition = useMemo(() => {
    const newline = '\n';
    if (steps.length === 0) {
      return [
        `flowchart ${orientation}`,
        '  classDef start fill:#bbf7d0,stroke:#047857,stroke-width:2px,color:#065f46;',
        '  classDef end fill:#fecdd3,stroke:#be123c,stroke-width:2px,color:#881337;',
        '  Start([' + START_NODE_LABEL + '])',
        '  End([' + END_NODE_LABEL + '])',
        '  class Start start;',
        '  class End end;'
      ].join(newline);
    }

    const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');
    const sanitizeRoleClass = (roleId: string) => sanitizeId(`role_${roleId}`);
    const sanitizeDepartmentId = (departmentId: string) => sanitizeId(`dept_${departmentId}`);

    const createClassAssignment = (nodeId: string, step: Step) => {
      if (step.type === 'decision') {
        return `  class ${nodeId} decision;`;
      }

      if (showRoles && step.roleId) {
        const role = rolesMap.get(step.roleId);
        if (role) {
          return `  class ${nodeId} ${sanitizeRoleClass(role.id)};`;
        }
      }

      return `  class ${nodeId} step;`;
    };

    const lines: string[] = [
      `flowchart ${orientation}`,
      '  classDef start fill:#bbf7d0,stroke:#047857,stroke-width:2px,color:#065f46;',
      '  classDef end fill:#fecdd3,stroke:#be123c,stroke-width:2px,color:#881337;',
      '  classDef step fill:#0f172a,stroke:#1f2937,stroke-width:1px,color:#f8fafc,rx:6px,ry:6px;',
      '  classDef decision fill:#111827,stroke:#1f2937,stroke-width:1px,color:#f8fafc,rx:10px,ry:10px;'
    ];

    if (showRoles) {
      departments.forEach((department) => {
        department.roles.forEach((role) => {
          lines.push(
            `  classDef ${sanitizeRoleClass(role.id)} fill:${role.color},stroke:${role.color},stroke-width:1px,color:#0f172a,rx:6px,ry:6px;`
          );
        });
      });
    }

    lines.push(`  Start([${START_NODE_LABEL}])`);
    lines.push(`  End([${END_NODE_LABEL}])`);
    lines.push('  class Start start;');
    lines.push('  class End end;');

    const classLines: string[] = [];

    if (showDepartments) {
      const orderedDepartmentIds = steps
        .map((step) => step.departmentId)
        .filter((departmentId): departmentId is string => Boolean(departmentId && departmentsMap.has(departmentId)))
        .filter((departmentId, index, array) => array.indexOf(departmentId) === index);

      const processed = new Set<string>();

      orderedDepartmentIds.forEach((departmentId) => {
        const department = departmentsMap.get(departmentId);
        if (!department) {
          return;
        }
        const subgraphId = sanitizeDepartmentId(departmentId);
        lines.push(`  subgraph ${subgraphId}["${department.name}"]`);
        lines.push('    direction TB');
        steps.forEach((step) => {
          if (step.departmentId !== departmentId || processed.has(step.id)) {
            return;
          }
          const nodeId = sanitizeId(step.id);
          const label = step.label.trim() || 'Étape sans titre';
          const shape = step.type === 'decision' ? `{${label}}` : `[${label}]`;
          lines.push(`    ${nodeId}${shape}`);
          processed.add(step.id);
          classLines.push(createClassAssignment(nodeId, step));
        });
        lines.push('  end');
      });

      steps.forEach((step) => {
        if (processed.has(step.id)) {
          return;
        }
        const nodeId = sanitizeId(step.id);
        const label = step.label.trim() || 'Étape sans titre';
        const shape = step.type === 'decision' ? `{${label}}` : `[${label}]`;
        lines.push(`  ${nodeId}${shape}`);
        processed.add(step.id);
        classLines.push(createClassAssignment(nodeId, step));
      });
    } else {
      steps.forEach((step) => {
        const nodeId = sanitizeId(step.id);
        const label = step.label.trim() || 'Étape sans titre';
        const shape = step.type === 'decision' ? `{${label}}` : `[${label}]`;
        lines.push(`  ${nodeId}${shape}`);
        classLines.push(createClassAssignment(nodeId, step));
      });
    }

    const edgeLines: string[] = [];

    if (startStepId) {
      const startTarget = steps.find((step) => step.id === startStepId);
      if (startTarget) {
        edgeLines.push(`  Start --> ${sanitizeId(startTarget.id)}`);
      }
    }

    for (let index = 0; index < steps.length - 1; index += 1) {
      const current = steps[index];
      const next = steps[index + 1];
      edgeLines.push(`  ${sanitizeId(current.id)} --> ${sanitizeId(next.id)}`);
    }

    if (endStepId) {
      const endSource = steps.find((step) => step.id === endStepId);
      if (endSource) {
        edgeLines.push(`  ${sanitizeId(endSource.id)} --> End`);
      }
    }

    return [...lines, ...classLines, ...edgeLines].join(newline);
  }, [departments, departmentsMap, endStepId, orientation, rolesMap, showDepartments, showRoles, startStepId, steps]);

  const selectClassName =
    'mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

  const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

  const getNextRoleColor = () => {
    const color = rolePalette[roleColorIndex.current % rolePalette.length];
    roleColorIndex.current += 1;
    return color;
  };

  const handleToggleDepartment = (departmentId: string) => {
    setDepartments((previous) =>
      previous.map((department) =>
        department.id === departmentId
          ? { ...department, isExpanded: !department.isExpanded }
          : department
      )
    );
  };

  const handleDepartmentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newDepartmentName.trim();
    if (!name) {
      return;
    }
    const id = createId('dept');
    setDepartments((previous) => [
      ...previous,
      {
        id,
        name,
        roles: [],
        isExpanded: true
      }
    ]);
    setNewDepartmentName('');
  };

  const handleRoleSubmit = (event: FormEvent<HTMLFormElement>, departmentId: string) => {
    event.preventDefault();
    const draft = (roleDrafts[departmentId] ?? '').trim();
    if (!draft) {
      return;
    }
    const role: Role = { id: createId('role'), name: draft, color: getNextRoleColor() };
    setDepartments((previous) =>
      previous.map((department) =>
        department.id === departmentId
          ? { ...department, roles: [...department.roles, role] }
          : department
      )
    );
    setRoleDrafts((previous) => ({ ...previous, [departmentId]: '' }));
  };

  const handleStepLabelChange = (stepId: string, label: string) => {
    setSteps((previous) => previous.map((step) => (step.id === stepId ? { ...step, label } : step)));
  };

  const handleStepDepartmentChange = (stepId: string, departmentId: string | null) => {
    setSteps((previous) =>
      previous.map((step) => {
        if (step.id !== stepId) {
          return step;
        }
        const department = departmentId ? departmentsMap.get(departmentId) : undefined;
        const roleId = department && department.roles.length > 0 ? department.roles[0].id : null;
        return { ...step, departmentId, roleId };
      })
    );
  };

  const handleStepRoleChange = (stepId: string, roleId: string | null) => {
    setSteps((previous) =>
      previous.map((step) => (step.id === stepId ? { ...step, roleId } : step))
    );
  };

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    setSteps((previous) => {
      const index = previous.findIndex((step) => step.id === stepId);
      if (index === -1) {
        return previous;
      }
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= previous.length) {
        return previous;
      }
      const updated = [...previous];
      const [step] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, step);
      return updated;
    });
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps((previous) => previous.filter((step) => step.id !== stepId));
  };

  const handleAddStep = (type: StepType) => {
    const defaultDepartment = departments[0];
    const defaultRole = defaultDepartment?.roles[0];
    const label = type === 'decision' ? 'Nouvelle décision' : 'Nouvelle étape';
    const newStep: Step = {
      id: createId('step'),
      label,
      departmentId: defaultDepartment?.id ?? null,
      roleId: defaultRole?.id ?? null,
      type
    };
    setSteps((previous) => [...previous, newStep]);
  };

  const handleStartStepChange = (value: string) => {
    setStartStepId(value ? value : null);
  };

  const handleEndStepChange = (value: string) => {
    setEndStepId(value ? value : null);
  };

  const iconButtonClassName =
    'inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="relative min-h-[calc(100vh-14rem)] rounded-3xl border border-slate-200/80 bg-slate-50/70 p-6 shadow-sm backdrop-blur lg:p-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <div className="absolute -left-12 top-10 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" aria-hidden />
        <div className="absolute bottom-6 right-0 h-72 w-72 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden />
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_minmax(0,360px)]">
        <section className="flex flex-col rounded-3xl border border-white/80 bg-white/95 p-6 shadow-lg">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Contexte organisationnel
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Départements & rôles</h2>
            <p className="mt-1 text-sm text-slate-600">
              Ajoutez vos équipes et rôles pour alimenter la légende du diagramme.
            </p>
          </header>

          <div className="mt-6 space-y-4">
            {departments.map((department) => (
              <article
                key={department.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{department.name}</h3>
                    <p className="text-xs text-slate-500">
                      {department.roles.length} rôle{department.roles.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleDepartment(department.id)}
                    aria-expanded={department.isExpanded}
                    aria-label={
                      department.isExpanded
                        ? `Replier les rôles du département ${department.name}`
                        : `Afficher les rôles du département ${department.name}`
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                  >
                    {department.isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>

                {department.isExpanded ? (
                  <div id={`department-${department.id}`} className="mt-4 space-y-3">
                    <ul className="space-y-2">
                      {department.roles.map((role) => (
                        <li
                          key={role.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: role.color }}
                              aria-hidden
                            />
                            {role.name}
                          </span>
                        </li>
                      ))}
                      {department.roles.length === 0 ? (
                        <li className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                          Aucun rôle pour le moment.
                        </li>
                      ) : null}
                    </ul>

                    <form
                      onSubmit={(event) => handleRoleSubmit(event, department.id)}
                      className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3"
                    >
                      <Label
                        htmlFor={`role-input-${department.id}`}
                        className="text-xs font-medium text-slate-600"
                      >
                        Ajouter un rôle
                      </Label>
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          id={`role-input-${department.id}`}
                          value={roleDrafts[department.id] ?? ''}
                          onChange={(event) =>
                            setRoleDrafts((previous) => ({
                              ...previous,
                              [department.id]: event.target.value
                            }))
                          }
                          placeholder="Ex. Responsable qualité"
                          className="h-9"
                        />
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          disabled={!(roleDrafts[department.id]?.trim())}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Ajouter
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form
            onSubmit={handleDepartmentSubmit}
            className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4"
          >
            <Label htmlFor="new-department" className="text-xs font-medium text-slate-600">
              Ajouter un département
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="new-department"
                value={newDepartmentName}
                onChange={(event) => setNewDepartmentName(event.target.value)}
                placeholder="Ex. Support client"
              />
              <Button type="submit" size="sm" disabled={!newDepartmentName.trim()}>
                <Plus className="mr-1 h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </form>
        </section>

        <section className="flex min-h-[540px] flex-col gap-6">
          <div className="flex flex-1 flex-col rounded-3xl border border-white/80 bg-white/95 p-6 shadow-lg">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Atelier diagramme
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  Composez votre canvas Mermaid
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Chaque modification met instantanément à jour le rendu.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                Orientation
                <span className="font-bold text-slate-900">{orientation}</span>
              </span>
            </div>

            <div className="relative mt-6 flex-1 overflow-hidden rounded-2xl border border-slate-900/40 bg-slate-950/95 p-4 text-slate-200 shadow-xl">
              <MermaidCanvas definition={mermaidDefinition} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-lg">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Options du diagramme</h3>
                <p className="text-xs text-slate-500">
                  Activez les repères visuels pour guider la lecture.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <OptionToggle
                  label="Départements"
                  active={showDepartments}
                  onToggle={() => setShowDepartments((value) => !value)}
                />
                <OptionToggle
                  label="Rôles & couleurs"
                  active={showRoles}
                  onToggle={() => setShowRoles((value) => !value)}
                />
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
                  <span className="uppercase tracking-[0.15em] text-[11px] text-slate-500">
                    Orientation
                  </span>
                  <select
                    className="bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                    value={orientation}
                    onChange={(event) => setOrientation(event.target.value as Orientation)}
                    aria-label="Orientation du diagramme"
                  >
                    {orientationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside
          className={cn(
            'relative flex flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl transition-all duration-300',
            'max-xl:order-last max-xl:w-full',
            isRightPanelOpen ? 'xl:w-[360px]' : 'xl:w-[72px] xl:px-0 xl:py-0'
          )}
        >
          <button
            type="button"
            onClick={() => setIsRightPanelOpen((value) => !value)}
            aria-expanded={isRightPanelOpen}
            aria-label={
              isRightPanelOpen
                ? 'Réduire le panneau des étapes'
                : 'Déployer le panneau des étapes'
            }
            className="absolute -left-4 top-8 hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:border-slate-300 hover:text-slate-900 xl:flex"
          >
            {isRightPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 xl:hidden">
            <span className="text-sm font-semibold text-slate-900">Étapes du process</span>
            <button
              type="button"
              onClick={() => setIsRightPanelOpen((value) => !value)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
            >
              {isRightPanelOpen ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          {isRightPanelOpen ? (
            <div className="flex h-full flex-col gap-6 px-5 py-6">
              <header>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Étapes du process
                </p>
                <h2 className="mt-2 text-base font-semibold text-slate-900">
                  Ordonnez & affectez vos actions
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Les modifications mettent à jour le canvas en direct.
                </p>
              </header>

              <div className="flex-1 overflow-hidden">
                <ul className="space-y-4 overflow-y-auto pr-1">
                  {steps.map((step, index) => {
                    const department = step.departmentId ? departmentsMap.get(step.departmentId) : undefined;
                    const availableRoles = department?.roles ?? [];
                    const roleValue =
                      step.roleId && availableRoles.some((role) => role.id === step.roleId)
                        ? step.roleId
                        : '';

                    return (
                      <li key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <GripVertical className="h-4 w-4 text-slate-300" aria-hidden />
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">
                              {index + 1}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em]',
                                step.type === 'decision'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {step.type === 'decision' ? 'Décision' : 'Étape'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <button
                              type="button"
                              onClick={() => handleMoveStep(step.id, 'up')}
                              className={iconButtonClassName}
                              disabled={index === 0}
                              aria-label="Monter l’étape"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(step.id, 'down')}
                              className={iconButtonClassName}
                              disabled={index === steps.length - 1}
                              aria-label="Descendre l’étape"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(step.id)}
                              className={iconButtonClassName}
                              aria-label="Supprimer l’étape"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-4">
                          <div>
                            <Label
                              htmlFor={`step-label-${step.id}`}
                              className="text-xs font-medium text-slate-600"
                            >
                              Libellé
                            </Label>
                            <Input
                              id={`step-label-${step.id}`}
                              value={step.label}
                              onChange={(event) => handleStepLabelChange(step.id, event.target.value)}
                              placeholder="Nom de l’étape"
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label
                                htmlFor={`step-department-${step.id}`}
                                className="text-xs font-medium text-slate-600"
                              >
                                Département
                              </Label>
                              <select
                                id={`step-department-${step.id}`}
                                value={step.departmentId ?? ''}
                                onChange={(event) =>
                                  handleStepDepartmentChange(
                                    step.id,
                                    event.target.value ? event.target.value : null
                                  )
                                }
                                className={selectClassName}
                              >
                                <option value="">Aucun</option>
                                {departments.map((departmentOption) => (
                                  <option key={departmentOption.id} value={departmentOption.id}>
                                    {departmentOption.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label
                                htmlFor={`step-role-${step.id}`}
                                className="text-xs font-medium text-slate-600"
                              >
                                Rôle
                              </Label>
                              <select
                                id={`step-role-${step.id}`}
                                value={roleValue}
                                onChange={(event) =>
                                  handleStepRoleChange(
                                    step.id,
                                    event.target.value ? event.target.value : null
                                  )
                                }
                                className={selectClassName}
                                disabled={availableRoles.length === 0}
                              >
                                <option value="">Aucun</option>
                                {availableRoles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {steps.length === 0 ? (
                    <li className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                      Ajoutez une étape pour commencer à construire votre process.
                    </li>
                  ) : null}
                </ul>
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-4">
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="start-step" className="text-xs font-medium text-slate-600">
                      Étape de début
                    </Label>
                    <select
                      id="start-step"
                      value={startStepId ?? ''}
                      onChange={(event) => handleStartStepChange(event.target.value)}
                      className={selectClassName}
                    >
                      <option value="">Aucune</option>
                      {steps.map((step) => (
                        <option key={step.id} value={step.id}>
                          {step.label || 'Étape sans titre'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="end-step" className="text-xs font-medium text-slate-600">
                      Étape finale
                    </Label>
                    <select
                      id="end-step"
                      value={endStepId ?? ''}
                      onChange={(event) => handleEndStepChange(event.target.value)}
                      className={selectClassName}
                    >
                      <option value="">Aucune</option>
                      {steps.map((step) => (
                        <option key={step.id} value={step.id}>
                          {step.label || 'Étape sans titre'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => handleAddStep('step')} size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Ajouter une étape
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleAddStep('decision')}
                    size="sm"
                    variant="secondary"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Ajouter une décision
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-6 text-slate-400">
              <GripVertical className="h-5 w-5" aria-hidden />
              <p className="text-xs font-medium uppercase tracking-[0.3em] [writing-mode:vertical-rl]">
                Étapes
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

type OptionToggleProps = {
  label: string;
  active: boolean;
  onToggle: () => void;
};

function OptionToggle({ label, active, onToggle }: OptionToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-sky-400 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
      )}
    >
      <span
        className={cn('h-2.5 w-2.5 rounded-full', active ? 'bg-sky-500' : 'bg-slate-300')}
        aria-hidden
      />
      {label}
    </button>
  );
}

type MermaidCanvasProps = {
  definition: string;
};

function MermaidCanvas({ definition }: MermaidCanvasProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const mermaidInstance = useRef<MermaidModule | null>(null);

  useEffect(() => {
    let isActive = true;

    const renderDiagram = async () => {
      try {
        if (!definition.trim()) {
          setSvg('');
          setError(null);
          return;
        }

        const mermaid =
          mermaidInstance.current ??
          ((await import(
            /* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'
          )) as { default: MermaidModule }).default;

        if (!mermaidInstance.current) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'base',
            themeVariables: {
              primaryColor: '#0f172a',
              primaryTextColor: '#f8fafc',
              lineColor: '#94a3b8',
              background: '#020617',
              nodeBorder: '#1f2937'
            }
          });
          mermaidInstance.current = mermaid;
        }

        const { svg } = await mermaid.render(
          `diagram-${Math.random().toString(36).slice(2, 9)}`,
          definition
        );

        if (isActive) {
          setSvg(svg);
          setError(null);
        }
      } catch (unknownError) {
        if (isActive) {
          setError('Impossible de générer le diagramme pour le moment.');
          setSvg('');
          console.error(unknownError);
        }
      }
    };

    renderDiagram();

    return () => {
      isActive = false;
    };
  }, [definition]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Génération du diagramme...
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram [&>svg]:h-auto [&>svg]:w-full"
      aria-live="polite"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
