import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
import Collapse from 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.esm.min.js';

const dom = {
  diagram: document.getElementById('diagram'),
  startInput: document.getElementById('start-text'),
  endInput: document.getElementById('end-text'),
  addStepButton: document.getElementById('add-step'),
  addDecisionButton: document.getElementById('add-decision'),
  stepsList: document.getElementById('steps-list'),
  addDepartmentButton: document.getElementById('add-department'),
  departmentList: document.getElementById('department-list'),
  addRoleButton: document.getElementById('add-role'),
  roleList: document.getElementById('role-list'),
  orgSummary: document.getElementById('org-summary'),
  panelToggles: document.querySelectorAll('.panel-toggle')
};

const defaultDepartmentColors = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#facc15', '#ef4444', '#14b8a6'];

const sanitizeLabel = (raw, fallback) => {
  const safe = (raw ?? '').trim() || fallback;
  return safe
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/&/g, '\\&')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>');
};

const normalizeHexColor = (value, fallback = '#082f49') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHexColor(hex);
  const numeric = parseInt(normalized.slice(1), 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255
  };
};

const mixColor = (hex, amount) => {
  const { r, g, b } = hexToRgb(hex);
  const target = amount < 0 ? 0 : 255;
  const mixRatio = Math.min(1, Math.max(0, Math.abs(amount)));
  const mixChannel = (channel) => {
    const value = Math.round(channel + (target - channel) * mixRatio);
    return Math.min(255, Math.max(0, value));
  };
  const channels = [mixChannel(r), mixChannel(g), mixChannel(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('');
  return `#${channels}`;
};

const getContrastingTextColor = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const convert = (channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const [rLinear, gLinear, bLinear] = [convert(r), convert(g), convert(b)];
  const luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  return luminance > 0.55 ? '#0f172a' : '#f8fafc';
};

const deriveLaneColors = (baseColor) => {
  const fill = normalizeHexColor(baseColor);
  return {
    fill,
    stroke: mixColor(fill, -0.35),
    text: getContrastingTextColor(fill)
  };
};

const createElement = (tag, options = {}, children = []) => {
  const element = document.createElement(tag);
  const { className, dataset, attrs, text, html, on } = options;
  if (className) {
    element.className = className;
  }
  if (dataset) {
    Object.entries(dataset).forEach(([key, value]) => {
      if (value !== undefined) {
        element.dataset[key] = String(value);
      }
    });
  }
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== undefined) {
        element.setAttribute(key, String(value));
      }
    });
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  if (html !== undefined) {
    element.innerHTML = html;
  }
  if (on) {
    Object.entries(on).forEach(([event, handler]) => {
      element.addEventListener(event, handler);
    });
  }
  children.forEach((child) => {
    if (child instanceof Node) {
      element.appendChild(child);
    }
  });
  return element;
};

const createIconButton = (label, symbol, onClick) => {
  const button = createElement('button', {
    className: 'icon-button',
    attrs: { type: 'button', 'aria-label': label }
  });
  const icon = createElement('span', { attrs: { 'aria-hidden': 'true' }, text: symbol });
  button.appendChild(icon);
  if (onClick) {
    button.addEventListener('click', onClick);
  }
  return { button, icon };
};

class DepartmentColorPalette {
  constructor(colors = defaultDepartmentColors) {
    this.colors = colors;
    this.cursor = 0;
  }

  next() {
    const color = this.colors[this.cursor % this.colors.length];
    this.cursor += 1;
    return color;
  }
}

class EntityList {
  constructor({ type, container, addButton, onChange, palette }) {
    this.type = type;
    this.container = container;
    this.addButton = addButton;
    this.onChange = onChange;
    this.palette = palette;
    this.counter = 0;
    if (this.addButton) {
      this.addButton.addEventListener('click', () => {
        const row = this.add();
        row?.querySelector('.entity-input')?.focus();
      });
    }
  }

  notifyChange() {
    if (typeof this.onChange === 'function') {
      this.onChange();
    }
  }

  add(value = '', options = {}) {
    if (!this.container) {
      return null;
    }
    this.counter += 1;
    const id = `${this.type}-${this.counter}`;
    const row = createElement('div', {
      className: 'entity-row',
      dataset: { entityType: this.type, entityId: id, entityOrder: this.counter },
      attrs: { role: 'listitem' }
    });
    const input = createElement('input', {
      className: 'entity-input',
      attrs: {
        type: 'text',
        placeholder: this.type === 'department' ? 'Name the department' : 'Name the role',
        'aria-label': this.type === 'department' ? 'Department name' : 'Role name'
      }
    });
    input.value = value;
    input.addEventListener('input', () => this.notifyChange());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const newRow = this.add();
        newRow?.querySelector('.entity-input')?.focus();
      }
    });
    row.appendChild(input);

    if (this.type === 'department') {
      const colorInput = createElement('input', {
        className: 'entity-color',
        attrs: { type: 'color', 'aria-label': 'Department color', title: 'Pick department color' }
      });
      const initialColor = normalizeHexColor(options.color || this.palette?.next() || '#082f49');
      colorInput.value = initialColor;
      row.dataset.entityColor = initialColor;
      colorInput.addEventListener('input', () => {
        const normalized = normalizeHexColor(colorInput.value);
        row.dataset.entityColor = normalized;
        if (colorInput.value !== normalized) {
          colorInput.value = normalized;
        }
        this.notifyChange();
      });
      row.appendChild(colorInput);
    }

    const { button: removeButton } = createIconButton(
      this.type === 'department' ? 'Remove department' : 'Remove role',
      '\u00D7',
      () => {
        row.remove();
        this.notifyChange();
      }
    );
    row.appendChild(removeButton);

    this.container.appendChild(row);
    this.notifyChange();
    return row;
  }

  isEmpty() {
    return !this.container || this.container.childElementCount === 0;
  }

  getEntries() {
    if (!this.container) {
      return [];
    }
    const rows = Array.from(this.container.querySelectorAll('.entity-row'));
    return rows
      .map((row, index) => {
        const id = row.dataset.entityId;
        if (!id) {
          return null;
        }
        const input = row.querySelector('.entity-input');
        row.dataset.entityOrder = String(index + 1);
        const fallbackPrefix = this.type === 'department' ? 'Department' : 'Role';
        const fallback = `${fallbackPrefix} ${index + 1}`;
        const label = (input?.value || '').trim() || fallback;
        if (this.type === 'department') {
          const colorInput = row.querySelector('.entity-color');
          const color = normalizeHexColor(colorInput?.value || row.dataset.entityColor || '#082f49');
          row.dataset.entityColor = color;
          if (colorInput && colorInput.value !== color) {
            colorInput.value = color;
          }
          return { id, label, color };
        }
        return { id, label };
      })
      .filter(Boolean);
  }

  countFilled() {
    if (!this.container) {
      return 0;
    }
    return Array.from(this.container.querySelectorAll('.entity-input')).filter(
      (input) => input.value.trim().length > 0
    ).length;
  }
}

class OrgManager {
  constructor({ departmentContainer, departmentButton, roleContainer, roleButton, summary }) {
    const palette = new DepartmentColorPalette();
    this.departmentList = new EntityList({
      type: 'department',
      container: departmentContainer,
      addButton: departmentButton,
      onChange: () => this.handleChange(),
      palette
    });
    this.roleList = new EntityList({
      type: 'role',
      container: roleContainer,
      addButton: roleButton,
      onChange: () => this.handleChange()
    });
    this.summaryEl = summary;
    this.changeListeners = new Set();
    this.ensureDefaults();
    this.updateSummary();
  }

  ensureDefaults() {
    if (this.departmentList.isEmpty()) {
      ['Operations', 'Customer Success'].forEach((name) => this.departmentList.add(name));
    }
    if (this.roleList.isEmpty()) {
      ['Process Owner', 'Reviewer'].forEach((name) => this.roleList.add(name));
    }
  }

  onChange(listener) {
    if (typeof listener === 'function') {
      this.changeListeners.add(listener);
    }
  }

  emitChange() {
    this.changeListeners.forEach((listener) => listener());
  }

  handleChange() {
    this.updateSummary();
    this.emitChange();
  }

  updateSummary() {
    if (!this.summaryEl) {
      return;
    }
    const departmentCount = this.departmentList.countFilled();
    const roleCount = this.roleList.countFilled();
    if (departmentCount === 0 && roleCount === 0) {
      this.summaryEl.textContent = 'Start by adding departments and roles so your flow mirrors real teams.';
      return;
    }
    const parts = [];
    if (departmentCount > 0) {
      parts.push(`${departmentCount} ${departmentCount === 1 ? 'department' : 'departments'}`);
    }
    if (roleCount > 0) {
      parts.push(`${roleCount} ${roleCount === 1 ? 'role' : 'roles'}`);
    }
    this.summaryEl.textContent = `Tracking ${parts.join(' and ')} for this journey.`;
  }

  getDepartments() {
    return this.departmentList.getEntries();
  }

  getRoles() {
    return this.roleList.getEntries();
  }

  getAssignmentOptions() {
    return { departments: this.getDepartments(), roles: this.getRoles() };
  }

  getDepartmentLookup() {
    return new Map(
      this.getDepartments().map((entry) => [
        entry.id,
        { id: entry.id, label: sanitizeLabel(entry.label, entry.label), color: entry.color }
      ])
    );
  }

  getRoleLookup() {
    return new Map(this.getRoles().map((entry) => [entry.id, sanitizeLabel(entry.label, entry.label)]));
  }
}

class AssignmentGroup {
  constructor({ context = 'step', variant, onChange }) {
    this.onChange = onChange;
    const contextLabel =
      context === 'decision' ? 'decision' : context === 'branch' ? 'branch step' : 'step';
    this.element = createElement('div', {
      className: ['assignment-row', variant ? `assignment-row--${variant}` : ''].filter(Boolean).join(' ')
    });
    this.departmentSelect = this.createSelect('department', `Assign department for this ${contextLabel}`);
    this.roleSelect = this.createSelect('role', `Assign role for this ${contextLabel}`);
    this.element.appendChild(this.buildField('Department', this.departmentSelect));
    this.element.appendChild(this.buildField('Role', this.roleSelect));
  }

  createSelect(type, label) {
    const select = createElement('select', {
      className: 'assignment-select',
      dataset: { type },
      attrs: { 'aria-label': label }
    });
    select.addEventListener('change', () => this.onChange());
    return select;
  }

  buildField(label, control) {
    return createElement('label', { className: 'assignment-field' }, [
      createElement('span', { className: 'assignment-field-label', text: label }),
      control
    ]);
  }

  populateSelect(select, entries, type) {
    const previous = select.value;
    select.innerHTML = '';
    const placeholder = createElement('option', {
      attrs: { value: '' },
      text:
        entries.length === 0
          ? `Add ${type === 'department' ? 'departments' : 'roles'} to assign`
          : `Unassigned ${type}`
    });
    select.appendChild(placeholder);
    entries.forEach((entry) => {
      const option = createElement('option', {
        attrs: { value: entry.id },
        text: entry.label
      });
      if (type === 'department') {
        option.dataset.color = entry.color;
      }
      select.appendChild(option);
    });
    if (entries.some((entry) => entry.id === previous)) {
      select.value = previous;
    } else {
      select.value = '';
    }
    select.disabled = entries.length === 0;
  }

  updateOptions({ departments, roles }) {
    this.populateSelect(this.departmentSelect, departments, 'department');
    this.populateSelect(this.roleSelect, roles, 'role');
  }

  collect({ departmentLookup, roleLookup }) {
    const assignment = { department: null, role: null };
    if (this.departmentSelect.value) {
      const selected = departmentLookup.get(this.departmentSelect.value);
      const option = this.departmentSelect.selectedOptions?.[0];
      if (selected) {
        assignment.department = selected;
      } else if (option) {
        const label = option.textContent?.trim();
        if (label) {
          assignment.department = {
            id: this.departmentSelect.value,
            label: sanitizeLabel(label, label),
            color: normalizeHexColor(option.dataset.color || '#082f49')
          };
        }
      }
    }
    if (this.roleSelect.value) {
      const selectedRole = roleLookup.get(this.roleSelect.value);
      const option = this.roleSelect.selectedOptions?.[0];
      if (selectedRole) {
        assignment.role = selectedRole;
      } else if (option) {
        const label = option.textContent?.trim();
        if (label) {
          assignment.role = sanitizeLabel(label, label);
        }
      }
    }
    return assignment;
  }
}

class BranchStepRow {
  constructor(branchType, { onChange, onRemove }) {
    this.branchType = branchType;
    this.element = createElement('div', {
      className: 'branch-step',
      dataset: { branch: branchType }
    });
    this.labelEl = createElement('span', { className: 'branch-step-label' });
    this.input = createElement('input', {
      className: 'branch-step-input',
      attrs: { type: 'text' }
    });
    this.input.addEventListener('input', onChange);
    const { button: removeButton } = createIconButton('Remove branch step', '\u00D7', onRemove);
    this.assignments = new AssignmentGroup({ context: 'branch', variant: 'compact', onChange });
    this.element.appendChild(this.labelEl);
    this.element.appendChild(this.input);
    this.element.appendChild(removeButton);
    this.element.appendChild(this.assignments.element);
    this.updateIndex(1);
  }

  updateIndex(index) {
    const branchName = this.branchType === 'yes' ? 'Yes' : 'No';
    this.index = index;
    this.labelEl.textContent = `${branchName} ${index}`;
    this.input.placeholder = `Describe ${branchName.toLowerCase()} path ${index}`;
  }

  updateAssignmentsOptions(options) {
    this.assignments.updateOptions(options);
  }

  collect({ parentId, index, departmentLookup, roleLookup }) {
    const branchLabel = this.branchType === 'yes' ? 'yes' : 'no';
    const fallback = `${branchLabel.charAt(0).toUpperCase() + branchLabel.slice(1)} ${index}`;
    const label = sanitizeLabel(this.input.value, fallback);
    const assignment = this.assignments.collect({ departmentLookup, roleLookup });
    const inlineParts = [];
    if (assignment.role) {
      inlineParts.push(assignment.role);
    }
    const displayLabel = inlineParts.length > 0 ? `${label}\\n${inlineParts.join(' • ')}` : label;
    return {
      id: `${parentId}_${this.branchType}${index}`,
      label: displayLabel,
      departmentLane: assignment.department
    };
  }

  focus() {
    this.input.focus();
  }
}

class BranchSection {
  constructor(branchType, { onChange, getAssignmentOptions }) {
    this.branchType = branchType;
    this.onChange = onChange;
    this.getAssignmentOptions = getAssignmentOptions;
    this.steps = [];
    const labelText = branchType === 'yes' ? 'Yes branch' : 'No branch';
    this.element = createElement('div', {
      className: 'branch-section',
      dataset: { branch: branchType }
    });
    const header = createElement('div', { className: 'branch-header' }, [
      createElement('span', { className: 'branch-label', text: labelText })
    ]);
    const addButton = createElement('button', {
      className: 'secondary-button',
      attrs: { type: 'button' },
      text: 'Add step'
    });
    addButton.addEventListener('click', () => {
      const step = this.addStep();
      requestAnimationFrame(() => step.focus());
    });
    header.appendChild(addButton);
    this.element.appendChild(header);
    this.stepsContainer = createElement('div', {
      className: 'branch-steps',
      dataset: { branch: branchType }
    });
    this.element.appendChild(this.stepsContainer);
    const footerLabel = createElement('span', { className: 'branch-label', text: 'Close on' });
    this.targetSelect = createElement('select', {
      className: 'branch-target',
      dataset: { branch: branchType }
    });
    this.targetSelect.addEventListener('change', this.onChange);
    const footer = createElement('div', { className: 'branch-footer' }, [
      footerLabel,
      this.targetSelect
    ]);
    this.element.appendChild(footer);
    this.updateTargetOptions([], '');
  }

  addStep(value = '') {
    const step = new BranchStepRow(this.branchType, {
      onChange: this.onChange,
      onRemove: () => this.removeStep(step)
    });
    step.input.value = value;
    this.steps.push(step);
    this.stepsContainer.appendChild(step.element);
    step.updateAssignmentsOptions(this.getAssignmentOptions());
    this.updateLabels();
    this.onChange();
    return step;
  }

  removeStep(step) {
    const index = this.steps.indexOf(step);
    if (index === -1) {
      return;
    }
    this.steps.splice(index, 1);
    step.element.remove();
    this.updateLabels();
    this.onChange();
  }

  updateLabels() {
    this.steps.forEach((step, index) => step.updateIndex(index + 1));
  }

  updateAssignmentsOptions(options) {
    this.steps.forEach((step) => step.updateAssignmentsOptions(options));
  }

  updateTargetOptions(options, parentId) {
    const previous = this.targetSelect.value;
    this.targetSelect.innerHTML = '';
    this.targetSelect.appendChild(createElement('option', { attrs: { value: 'finish' }, text: 'Finish' }));
    options.forEach((option) => {
      if (option.id === parentId) {
        return;
      }
      this.targetSelect.appendChild(createElement('option', { attrs: { value: option.id }, text: option.label }));
    });
    const availableValues = Array.from(this.targetSelect.options).map((option) => option.value);
    this.targetSelect.value = availableValues.includes(previous) ? previous : 'finish';
  }

  getTarget() {
    return this.targetSelect.value || 'finish';
  }

  getStepsData({ parentId, departmentLookup, roleLookup }) {
    return this.steps.map((step, index) =>
      step.collect({
        parentId,
        index: index + 1,
        departmentLookup,
        roleLookup
      })
    );
  }
}

class ProcessRow {
  constructor({ value = '', onChange, onRemove }) {
    this.type = 'process';
    this.element = createElement('div', {
      className: 'step-row step-row--process',
      attrs: { role: 'listitem' },
      dataset: { type: 'process' }
    });
    const header = createElement('div', { className: 'step-header' });
    const { button: handle } = createIconButton('Reorder step', '☰');
    handle.classList.add('drag-handle');
    header.appendChild(handle);
    this.dragHandle = handle;
    const { button: toggle, icon } = createIconButton('Collapse step details', '▾');
    toggle.classList.add('step-toggle');
    toggle.addEventListener('click', () => {
      const collapsed = this.element.classList.toggle('step-collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${this.labelEl.textContent} details`);
      icon.textContent = collapsed ? '▸' : '▾';
    });
    header.appendChild(toggle);
    this.toggle = toggle;
    this.toggleIcon = icon;
    this.labelEl = createElement('span', { className: 'step-label', text: 'Step' });
    header.appendChild(this.labelEl);
    this.input = createElement('input', {
      className: 'input-control step-input',
      attrs: { type: 'text', placeholder: 'Describe the step' }
    });
    this.input.value = value;
    this.input.addEventListener('input', onChange);
    header.appendChild(this.input);
    const { button: removeButton } = createIconButton('Remove step', '\u00D7', onRemove);
    header.appendChild(removeButton);
    this.element.appendChild(header);
    this.body = createElement('div', { className: 'step-body' });
    this.assignments = new AssignmentGroup({ context: 'step', onChange });
    this.body.appendChild(this.assignments.element);
    this.element.appendChild(this.body);
    this.updateIndex(1);
  }

  updateIndex(index) {
    this.index = index;
    this.id = `step${index}`;
    this.element.dataset.entryId = this.id;
    this.labelEl.textContent = `Step ${index}`;
    this.input.placeholder = `Describe step ${index}`;
    this.dragHandle.setAttribute('aria-label', `Reorder step ${index}`);
    const collapsed = this.element.classList.contains('step-collapsed');
    this.toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    this.toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} Step ${index} details`);
  }

  updateAssignmentsOptions(options) {
    this.assignments.updateOptions(options);
  }

  collect({ departmentLookup, roleLookup }) {
    const fallback = `Step ${this.index}`;
    const label = sanitizeLabel(this.input.value, fallback);
    const assignment = this.assignments.collect({ departmentLookup, roleLookup });
    const inlineParts = [];
    if (assignment.role) {
      inlineParts.push(assignment.role);
    }
    const displayLabel = inlineParts.length > 0 ? `${label}\\n${inlineParts.join(' • ')}` : label;
    return {
      id: this.id,
      label: displayLabel,
      type: 'process',
      departmentLane: assignment.department
    };
  }

  getDisplayName() {
    return (this.input.value || '').trim() || `Step ${this.index}`;
  }

  focus() {
    this.input.focus();
  }
}

class DecisionRow {
  constructor({ value = '', onChange, onRemove, getAssignmentOptions }) {
    this.type = 'decision';
    this.getAssignmentOptions = getAssignmentOptions;
    this.element = createElement('div', {
      className: 'step-row step-row--decision',
      attrs: { role: 'listitem' },
      dataset: { type: 'decision' }
    });
    const header = createElement('div', { className: 'decision-header' });
    const { button: handle } = createIconButton('Reorder decision', '☰');
    handle.classList.add('drag-handle');
    header.appendChild(handle);
    this.dragHandle = handle;
    const { button: toggle, icon } = createIconButton('Collapse decision branches', '▾');
    toggle.classList.add('decision-toggle');
    toggle.addEventListener('click', () => {
      const collapsed = this.element.classList.toggle('decision-collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.setAttribute(
        'aria-label',
        `${collapsed ? 'Expand' : 'Collapse'} ${this.labelEl.textContent} branches`
      );
      icon.textContent = collapsed ? '▸' : '▾';
    });
    header.appendChild(toggle);
    this.toggle = toggle;
    this.toggleIcon = icon;
    this.labelEl = createElement('span', { className: 'step-label', text: 'Decision' });
    header.appendChild(this.labelEl);
    this.input = createElement('input', {
      className: 'input-control step-input',
      attrs: { type: 'text', placeholder: 'Describe the decision' }
    });
    this.input.value = value;
    this.input.addEventListener('input', onChange);
    header.appendChild(this.input);
    const { button: removeButton } = createIconButton('Remove decision', '\u00D7', onRemove);
    header.appendChild(removeButton);
    this.element.appendChild(header);
    this.assignments = new AssignmentGroup({ context: 'decision', onChange });
    this.element.appendChild(this.assignments.element);
    this.branches = {
      yes: new BranchSection('yes', { onChange, getAssignmentOptions }),
      no: new BranchSection('no', { onChange, getAssignmentOptions })
    };
    const branchesContainer = createElement('div', { className: 'decision-branches' }, [
      this.branches.yes.element,
      this.branches.no.element
    ]);
    this.element.appendChild(branchesContainer);
    this.updateIndex(1);
  }

  updateIndex(index) {
    this.index = index;
    this.id = `decision${index}`;
    this.element.dataset.entryId = this.id;
    this.labelEl.textContent = `Decision ${index}`;
    this.input.placeholder = `Describe decision ${index}`;
    this.dragHandle.setAttribute('aria-label', `Reorder decision ${index}`);
    const collapsed = this.element.classList.contains('decision-collapsed');
    this.toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    this.toggle.setAttribute(
      'aria-label',
      `${collapsed ? 'Expand' : 'Collapse'} Decision ${index} branches`
    );
    this.branches.yes.updateLabels();
    this.branches.no.updateLabels();
  }

  updateAssignmentsOptions(options) {
    this.assignments.updateOptions(options);
    this.branches.yes.updateAssignmentsOptions(options);
    this.branches.no.updateAssignmentsOptions(options);
  }

  updateBranchTargetOptions(options) {
    this.branches.yes.updateTargetOptions(options, this.id);
    this.branches.no.updateTargetOptions(options, this.id);
  }

  collect({ departmentLookup, roleLookup }) {
    const fallback = `Decision ${this.index}`;
    const label = sanitizeLabel(this.input.value, fallback);
    const assignment = this.assignments.collect({ departmentLookup, roleLookup });
    const inlineParts = [];
    if (assignment.role) {
      inlineParts.push(assignment.role);
    }
    const displayLabel = inlineParts.length > 0 ? `${label}\\n${inlineParts.join(' • ')}` : label;
    return {
      id: this.id,
      label: displayLabel,
      type: 'decision',
      departmentLane: assignment.department,
      branches: {
        yes: {
          steps: this.branches.yes.getStepsData({ parentId: this.id, departmentLookup, roleLookup }),
          target: this.branches.yes.getTarget()
        },
        no: {
          steps: this.branches.no.getStepsData({ parentId: this.id, departmentLookup, roleLookup }),
          target: this.branches.no.getTarget()
        }
      }
    };
  }

  getDisplayName() {
    return (this.input.value || '').trim() || `Decision ${this.index}`;
  }

  focus() {
    this.input.focus();
  }
}

class StepManager {
  constructor({ container, onChange }) {
    this.container = container;
    this.onChange = onChange;
    this.rows = [];
    this.assignmentOptions = { departments: [], roles: [] };
    this.draggedRow = null;
    if (this.container) {
      this.container.addEventListener('dragover', (event) => this.handleDragOver(event));
      this.container.addEventListener('drop', (event) => event.preventDefault());
    }
  }

  handleRowChange() {
    this.updateBranchTargets();
    this.onChange();
  }

  enableRowDrag(row) {
    const element = row.element;
    const handle = row.dragHandle;
    element.draggable = true;
    let handleActive = false;
    const resetHandle = () => {
      handleActive = false;
    };
    if (handle) {
      ['pointerup', 'pointerleave', 'lostpointercapture', 'blur', 'mouseup', 'mouseleave'].forEach((event) => {
        handle.addEventListener(event, resetHandle);
      });
      ['pointerdown', 'mousedown'].forEach((event) => {
        handle.addEventListener(event, () => {
          handleActive = true;
        });
      });
    }
    element.addEventListener('dragstart', (event) => {
      if (handle && !handleActive) {
        event.preventDefault();
        return;
      }
      handleActive = false;
      this.draggedRow = row;
      element.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.id || '');
    });
    element.addEventListener('dragend', () => {
      if (this.draggedRow === row) {
        element.classList.remove('is-dragging');
        this.draggedRow = null;
        this.syncRowsFromDom();
        this.refreshIndices();
        this.onChange();
      }
    });
  }

  handleDragOver(event) {
    if (!this.draggedRow) {
      return;
    }
    event.preventDefault();
    const targetElement = event.target.closest('.step-row');
    if (!targetElement || targetElement === this.draggedRow.element) {
      return;
    }
    const targetRect = targetElement.getBoundingClientRect();
    const shouldInsertBefore = event.clientY - targetRect.top < targetRect.height / 2;
    if (shouldInsertBefore) {
      this.container.insertBefore(this.draggedRow.element, targetElement);
    } else {
      this.container.insertBefore(this.draggedRow.element, targetElement.nextSibling);
    }
    this.syncRowsFromDom();
  }

  syncRowsFromDom() {
    const ordered = Array.from(this.container.querySelectorAll('.step-row'));
    this.rows = ordered
      .map((element) => this.rows.find((row) => row.element === element))
      .filter(Boolean);
  }

  refreshIndices() {
    let stepIndex = 0;
    let decisionIndex = 0;
    this.rows.forEach((row) => {
      if (row.type === 'decision') {
        decisionIndex += 1;
        row.updateIndex(decisionIndex);
      } else {
        stepIndex += 1;
        row.updateIndex(stepIndex);
      }
    });
    this.updateBranchTargets();
  }

  updateBranchTargets() {
    const options = this.rows.map((row) => ({ id: row.id, label: row.getDisplayName() }));
    this.rows.forEach((row) => {
      if (row.type === 'decision') {
        row.updateBranchTargetOptions(options);
      }
    });
  }

  addProcessStep(value = '') {
    const row = new ProcessRow({
      value,
      onChange: () => this.handleRowChange(),
      onRemove: () => this.removeRow(row)
    });
    this.mountRow(row);
    return row;
  }

  addDecisionStep(value = '') {
    const row = new DecisionRow({
      value,
      onChange: () => this.handleRowChange(),
      onRemove: () => this.removeRow(row),
      getAssignmentOptions: () => this.assignmentOptions
    });
    this.mountRow(row);
    return row;
  }

  mountRow(row) {
    this.rows.push(row);
    this.container.appendChild(row.element);
    this.enableRowDrag(row);
    row.updateAssignmentsOptions(this.assignmentOptions);
    this.refreshIndices();
    this.onChange();
  }

  removeRow(row) {
    const index = this.rows.indexOf(row);
    if (index === -1) {
      return;
    }
    this.rows.splice(index, 1);
    row.element.remove();
    this.refreshIndices();
    this.onChange();
  }

  updateAssignments(options) {
    this.assignmentOptions = options;
    this.rows.forEach((row) => row.updateAssignmentsOptions(options));
  }

  collectEntries({ departmentLookup, roleLookup }) {
    return this.rows.map((row) => row.collect({ departmentLookup, roleLookup }));
  }

  focusRow(row) {
    row?.focus();
  }
}

class DiagramRenderer {
  constructor({ diagramEl, stepManager, orgManager, startInput, endInput }) {
    this.diagramEl = diagramEl;
    this.stepManager = stepManager;
    this.orgManager = orgManager;
    this.startInput = startInput;
    this.endInput = endInput;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default'
    });
  }

  buildDefinition() {
    const startLabel = sanitizeLabel(this.startInput.value, 'Start');
    const endLabel = sanitizeLabel(this.endInput.value, 'End');
    const departmentLookup = this.orgManager.getDepartmentLookup();
    const roleLookup = this.orgManager.getRoleLookup();
    const entries = this.stepManager.collectEntries({ departmentLookup, roleLookup });
    const lines = [
      'flowchart TD',
      '  classDef start fill:#22c55e,color:#052e16,stroke:#16a34a,stroke-width:2px;',
      '  classDef step fill:#1f2937,color:#f8fafc,stroke:#334155,stroke-width:2px;',
      '  classDef decision fill:#fde68a,color:#78350f,stroke:#f59e0b,stroke-width:2px;',
      '  classDef finish fill:#fca5a5,color:#7f1d1d,stroke:#ef4444,stroke-width:2px;',
      '  classDef departmentLane fill:#082f49,color:#bae6fd,stroke:#38bdf8,stroke-width:1.5px,stroke-dasharray:6 4;',
      `  start((${startLabel})):::start`
    ];
    const linkStyleLines = [];
    let edgeIndex = 0;
    const nodeDeclarations = [];
    const registerNode = (line, departmentInfo) => {
      nodeDeclarations.push({ line, department: departmentInfo });
    };
    const addEdge = (from, to, options = {}) => {
      const { label, type = '-->', hidden } = options;
      const labelSegment = label ? `|${label}| ` : '';
      lines.push(`  ${from} ${type}${labelSegment}${to}`);
      if (hidden) {
        linkStyleLines.push(
          `  linkStyle ${edgeIndex} stroke-width:0px,stroke:transparent,color:transparent,opacity:0;`
        );
      }
      edgeIndex += 1;
    };
    entries.forEach((entry) => {
      if (entry.type === 'decision') {
        registerNode(`${entry.id}{"${entry.label}"}:::decision`, entry.departmentLane);
        entry.branches.yes.steps.forEach((step) => {
          registerNode(`${step.id}["${step.label}"]:::step`, step.departmentLane);
        });
        entry.branches.no.steps.forEach((step) => {
          registerNode(`${step.id}["${step.label}"]:::step`, step.departmentLane);
        });
      } else {
        registerNode(`${entry.id}["${entry.label}"]:::step`, entry.departmentLane);
      }
    });
    const departmentGroups = new Map();
    const departmentOrder = [];
    let departmentCounter = 0;
    nodeDeclarations.forEach(({ line, department }) => {
      if (!department || !department.id) {
        lines.push(`  ${line}`);
        return;
      }
      if (!departmentGroups.has(department.id)) {
        departmentCounter += 1;
        departmentGroups.set(department.id, {
          laneId: `department_${departmentCounter}`,
          label: department.label,
          color: department.color,
          nodes: []
        });
        departmentOrder.push(department.id);
      }
      departmentGroups.get(department.id).nodes.push(line);
    });
    departmentOrder.forEach((departmentId) => {
      const { laneId, label, color, nodes } = departmentGroups.get(departmentId);
      lines.push(`  subgraph ${laneId}["${label}"]`);
      lines.push('    direction TB');
      nodes.forEach((node) => {
        lines.push(`    ${node}`);
      });
      lines.push('  end');
      if (color) {
        const { fill, stroke, text } = deriveLaneColors(color);
        lines.push(
          `  classDef ${laneId} fill:${fill},color:${text},stroke:${stroke},stroke-width:1.5px,stroke-dasharray:6 4;`
        );
        lines.push(`  class ${laneId} ${laneId};`);
      } else {
        lines.push(`  class ${laneId} departmentLane;`);
      }
    });
    lines.push(`  finish((${endLabel})):::finish`);
    if (entries.length === 0) {
      addEdge('start', 'finish');
      lines.push(...linkStyleLines);
      return lines.join('\n');
    }
    addEdge('start', entries[0].id);
    for (let i = 0; i < entries.length - 1; i += 1) {
      const current = entries[i];
      const next = entries[i + 1];
      if (current.type !== 'decision') {
        addEdge(current.id, next.id);
      }
    }
    const lastEntry = entries[entries.length - 1];
    if (lastEntry.type !== 'decision') {
      addEdge(lastEntry.id, 'finish');
    }
    entries
      .filter((entry) => entry.type === 'decision')
      .forEach((entry) => {
        const connectBranch = (branch, label) => {
          const target = branch.target === 'finish' || !branch.target ? 'finish' : branch.target;
          if (branch.steps.length > 0) {
            addEdge(entry.id, branch.steps[0].id, { label });
            for (let i = 0; i < branch.steps.length - 1; i += 1) {
              addEdge(branch.steps[i].id, branch.steps[i + 1].id);
            }
            addEdge(branch.steps[branch.steps.length - 1].id, target);
          } else {
            addEdge(entry.id, target, { label });
          }
        };
        connectBranch(entry.branches.yes, 'Yes');
        connectBranch(entry.branches.no, 'No');
      });
    lines.push(...linkStyleLines);
    return lines.join('\n');
  }

  async render() {
    if (!this.diagramEl) {
      return;
    }
    const definition = this.buildDefinition();
    this.diagramEl.innerHTML = '';
    if (!definition) {
      return;
    }
    try {
      const { svg } = await mermaid.render(`diagram-${Date.now()}`, definition);
      this.diagramEl.innerHTML = svg;
    } catch (error) {
      this.diagramEl.innerHTML = `<pre style="color:#f97316; white-space:pre-wrap;">${error.message}</pre>`;
    }
  }
}

class PanelManager {
  static init(toggles) {
    const body = document.body;
    body.dataset.leftCollapsed = 'false';
    body.dataset.rightCollapsed = 'false';
    toggles.forEach((toggle) => {
      const panel = toggle.closest('.side-panel');
      if (!panel) {
        return;
      }
      const side = panel.dataset.side === 'left' ? 'left' : 'right';
      const targetId = toggle.getAttribute('aria-controls');
      const panelBody = targetId ? document.getElementById(targetId) : panel.querySelector('.panel-body');
      if (!panelBody) {
        return;
      }

      if (!panelBody.classList.contains('collapse')) {
        panelBody.classList.add('collapse');
      }

      const icon = toggle.querySelector('span[aria-hidden="true"]');

      const applyState = (collapsed) => {
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute(
          'aria-label',
          `${collapsed ? 'Expand' : 'Collapse'} ${side === 'left' ? 'organization panel' : 'builder panel'}`
        );
        if (icon) {
          icon.textContent = side === 'left' ? (collapsed ? '⟩' : '⟨') : collapsed ? '⟨' : '⟩';
        }
        body.dataset[side === 'left' ? 'leftCollapsed' : 'rightCollapsed'] = String(collapsed);
        panel.classList.toggle('is-collapsed', collapsed);
      };

      const initiallyCollapsed = panel.classList.contains('is-collapsed') || !panelBody.classList.contains('show');
      if (initiallyCollapsed) {
        panelBody.classList.remove('show');
      } else {
        panelBody.classList.add('show');
      }

      const collapse = new Collapse(panelBody, { toggle: false });
      applyState(initiallyCollapsed);
      if (initiallyCollapsed) {
        collapse.hide();
      } else {
        collapse.show();
      }

      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        collapse.toggle();
      });

      panelBody.addEventListener('show.bs.collapse', () => {
        applyState(false);
      });

      panelBody.addEventListener('hide.bs.collapse', () => {
        applyState(true);
      });

      const removeInlineHeight = () => {
        panelBody.style.removeProperty('height');
      };

      panelBody.addEventListener('shown.bs.collapse', removeInlineHeight);
      panelBody.addEventListener('hidden.bs.collapse', removeInlineHeight);
    });
  }
}

class App {
  constructor() {
    this.orgManager = new OrgManager({
      departmentContainer: dom.departmentList,
      departmentButton: dom.addDepartmentButton,
      roleContainer: dom.roleList,
      roleButton: dom.addRoleButton,
      summary: dom.orgSummary
    });
    this.stepManager = new StepManager({
      container: dom.stepsList,
      onChange: () => this.renderDiagram()
    });
    this.diagramRenderer = new DiagramRenderer({
      diagramEl: dom.diagram,
      stepManager: this.stepManager,
      orgManager: this.orgManager,
      startInput: dom.startInput,
      endInput: dom.endInput
    });
    PanelManager.init(dom.panelToggles);
    this.orgManager.onChange(() => {
      this.stepManager.updateAssignments(this.orgManager.getAssignmentOptions());
      this.renderDiagram();
    });
    dom.startInput.addEventListener('input', () => this.renderDiagram());
    dom.endInput.addEventListener('input', () => this.renderDiagram());
    dom.addStepButton.addEventListener('click', () => {
      const row = this.stepManager.addProcessStep();
      this.stepManager.focusRow(row);
      this.renderDiagram();
    });
    dom.addDecisionButton.addEventListener('click', () => {
      const row = this.stepManager.addDecisionStep();
      this.stepManager.focusRow(row);
      this.renderDiagram();
    });
    ['Plan', 'Build'].forEach((value) => this.stepManager.addProcessStep(value));
    this.stepManager.updateAssignments(this.orgManager.getAssignmentOptions());
    this.renderDiagram();
  }

  renderDiagram() {
    this.diagramRenderer.render();
  }
}

new App();
