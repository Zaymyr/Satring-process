import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

const dom = {
  diagram: document.getElementById('diagram'),
  startInput: document.getElementById('start-text'),
  endInput: document.getElementById('end-text'),
  addStepButton: document.getElementById('add-step'),
  addDecisionButton: document.getElementById('add-decision'),
  stepsList: document.getElementById('steps-list'),
  addDepartmentButton: document.getElementById('add-department'),
  departmentList: document.getElementById('department-list'),
  orgSummary: document.getElementById('org-summary'),
  panelToggles: document.querySelectorAll('.panel-toggle'),
  entitySections: document.querySelectorAll('.entity-section')
};

const defaultDepartmentColors = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#facc15', '#ef4444', '#14b8a6'];
const defaultRoleColors = ['#38bdf8', '#f472b6', '#fde68a', '#c084fc', '#34d399', '#fb7185', '#f97316'];

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

const deriveRoleCardStyles = (baseColor) => {
  const fill = normalizeHexColor(baseColor);
  const text = getContrastingTextColor(fill);
  const prefersLightText = text === '#f8fafc';
  const accent = prefersLightText ? mixColor(fill, 0.55) : mixColor(fill, -0.45);
  const muted = prefersLightText ? mixColor(fill, 0.7) : mixColor(fill, -0.25);
  const controlBg = prefersLightText ? mixColor(fill, 0.35) : mixColor(fill, -0.1);
  const border = mixColor(fill, -0.45);
  const controlBorder = mixColor(fill, -0.55);
  return { fill, text, accent, muted, controlBg, border, controlBorder };
};

const deriveRoleNodeStyles = (baseColor) => {
  const fill = normalizeHexColor(baseColor);
  return {
    fill,
    stroke: mixColor(fill, -0.45),
    text: getContrastingTextColor(fill)
  };
};

const applyRoleCardTheme = (element, color) => {
  if (!element) {
    return;
  }
  const properties = [
    '--role-card-bg',
    '--role-card-border',
    '--role-card-text',
    '--role-card-accent',
    '--role-card-muted',
    '--role-card-control-bg',
    '--role-card-control-border'
  ];
  if (!color) {
    properties.forEach((property) => element.style.removeProperty(property));
    element.removeAttribute('data-role-color');
    return;
  }
  const styles = deriveRoleCardStyles(color);
  element.style.setProperty('--role-card-bg', styles.fill);
  element.style.setProperty('--role-card-border', styles.border);
  element.style.setProperty('--role-card-text', styles.text);
  element.style.setProperty('--role-card-accent', styles.accent);
  element.style.setProperty('--role-card-muted', styles.muted);
  element.style.setProperty('--role-card-control-bg', styles.controlBg);
  element.style.setProperty('--role-card-control-border', styles.controlBorder);
  element.dataset.roleColor = styles.fill;
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

class ColorPalette {
  constructor(colors) {
    this.colors = Array.isArray(colors) && colors.length > 0 ? colors : ['#38bdf8'];
    this.cursor = 0;
  }

  next() {
    const color = this.colors[this.cursor % this.colors.length];
    this.cursor += 1;
    return color;
  }
}

class DepartmentTree {
  constructor({
    container,
    addButton,
    onChange,
    departmentPalette,
    rolePalette,
    departmentColorFallback = '#082f49',
    roleColorFallback = '#2563eb'
  }) {
    this.container = container;
    this.addButton = addButton;
    this.onChange = onChange;
    this.departmentPalette = departmentPalette;
    this.rolePalette = rolePalette;
    this.departmentColorFallback = normalizeHexColor(departmentColorFallback, '#082f49');
    this.roleColorFallback = normalizeHexColor(roleColorFallback, '#2563eb');
    this.departmentCounter = 0;
    this.roleCounter = 0;
    if (this.addButton) {
      this.addButton.addEventListener('click', () => {
        const node = this.addDepartment();
        node?.querySelector('.entity-input')?.focus();
      });
    }
  }

  notifyChange() {
    if (typeof this.onChange === 'function') {
      this.onChange();
    }
  }

  isEmpty() {
    return !this.container || this.container.childElementCount === 0;
  }

  addDepartment(value = '', options = {}) {
    if (!this.container) {
      return null;
    }
    this.departmentCounter += 1;
    const id = options.id || `department-${this.departmentCounter}`;
    const node = createElement('div', {
      className: 'department-node',
      dataset: { entityId: id, entityType: 'department' },
      attrs: { role: 'listitem' }
    });
    const row = createElement('div', {
      className: 'entity-row',
      dataset: { entityType: 'department', entityId: id }
    });
    const { button: collapseButton, icon: collapseIcon } = createIconButton(
      'Collapse department roles',
      '\u25BE'
    );
    collapseButton.classList.add('department-collapse');
    collapseButton.setAttribute('aria-expanded', 'true');
    const input = createElement('input', {
      className: 'entity-input',
      attrs: { type: 'text', placeholder: 'Name the department', 'aria-label': 'Department name' }
    });
    input.value = value;

    const colorInput = createElement('input', {
      className: 'entity-color',
      attrs: {
        type: 'color',
        'aria-label': 'Department color',
        title: 'Pick department color'
      }
    });
    const initialColor = normalizeHexColor(
      options.color || this.departmentPalette?.next() || this.departmentColorFallback,
      this.departmentColorFallback
    );
    colorInput.value = initialColor;
    row.dataset.entityColor = initialColor;
    colorInput.addEventListener('input', () => {
      const normalized = normalizeHexColor(colorInput.value, this.departmentColorFallback);
      row.dataset.entityColor = normalized;
      if (colorInput.value !== normalized) {
        colorInput.value = normalized;
      }
      this.notifyChange();
    });
    row.appendChild(colorInput);

    const addRoleButton = createElement('button', {
      className: 'add-role-button',
      attrs: { type: 'button' },
      text: 'Add role'
    });
    addRoleButton.addEventListener('click', () => {
      const roleRow = this.addRole(node);
      roleRow?.querySelector('.entity-input')?.focus();
    });

    const { button: removeButton } = createIconButton('Remove department', '\u00D7', () => {
      node.remove();
      this.notifyChange();
    });

    const rolesContainer = createElement('div', {
      className: 'role-list',
      attrs: { role: 'group' }
    });
    rolesContainer.dataset.emptyText = 'Add roles to clarify who supports this department.';
    const rolesId = `${id}-roles`;
    rolesContainer.id = rolesId;
    collapseButton.setAttribute('aria-controls', rolesId);

    const getDepartmentLabel = () => input.value.trim() || 'this department';
    const updateRoleButtonLabel = () => {
      const label = getDepartmentLabel();
      addRoleButton.setAttribute('aria-label', `Add role to ${label}`);
      addRoleButton.title = `Add role to ${label}`;
    };
    const updateCollapseLabel = () => {
      const collapsed = node.dataset.collapsed === 'true';
      collapseButton.setAttribute(
        'aria-label',
        `${collapsed ? 'Expand' : 'Collapse'} ${getDepartmentLabel()} roles`
      );
    };
    const setCollapsed = (collapsed) => {
      node.dataset.collapsed = collapsed ? 'true' : 'false';
      rolesContainer.hidden = collapsed;
      collapseButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      if (collapseIcon) {
        collapseIcon.textContent = collapsed ? '\u25B8' : '\u25BE';
      }
      updateCollapseLabel();
    };

    collapseIcon?.classList.add('department-collapse-icon');

    collapseButton.addEventListener('click', () => {
      const collapsed = node.dataset.collapsed === 'true';
      setCollapsed(!collapsed);
    });

    input.addEventListener('input', () => {
      updateRoleButtonLabel();
      updateCollapseLabel();
      this.notifyChange();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const newNode = this.addDepartment();
        newNode?.querySelector('.entity-input')?.focus();
      }
    });

    row.append(collapseButton, input, colorInput, addRoleButton, removeButton);
    node.appendChild(row);
    node.appendChild(rolesContainer);
    this.container.appendChild(node);
    setCollapsed(false);
    updateRoleButtonLabel();

    const roles = Array.isArray(options.roles) ? options.roles : [];
    roles.forEach((role) => {
      if (typeof role === 'string') {
        this.addRole(node, role);
      } else if (role && typeof role === 'object') {
        this.addRole(node, role.value || '', role);
      }
    });

    this.notifyChange();
    return node;
  }

  addRole(departmentNode, value = '', options = {}) {
    if (!departmentNode) {
      return null;
    }
    const departmentId = departmentNode.dataset.entityId;
    const rolesContainer = departmentNode.querySelector('.role-list');
    if (!rolesContainer) {
      return null;
    }
    this.roleCounter += 1;
    const id = options.id || `role-${this.roleCounter}`;
    const row = createElement('div', {
      className: 'entity-row',
      dataset: { entityType: 'role', entityId: id, parentDepartment: departmentId },
      attrs: { role: 'listitem' }
    });
    const input = createElement('input', {
      className: 'entity-input',
      attrs: { type: 'text', placeholder: 'Name the role', 'aria-label': 'Role name' }
    });
    input.value = value;
    input.addEventListener('input', () => this.notifyChange());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const newRow = this.addRole(departmentNode);
        newRow?.querySelector('.entity-input')?.focus();
      }
    });
    row.appendChild(input);

    const colorInput = createElement('input', {
      className: 'entity-color',
      attrs: {
        type: 'color',
        'aria-label': 'Role color',
        title: 'Pick role color'
      }
    });
    const initialColor = normalizeHexColor(
      options.color || this.rolePalette?.next() || this.roleColorFallback,
      this.roleColorFallback
    );
    colorInput.value = initialColor;
    row.dataset.entityColor = initialColor;
    colorInput.addEventListener('input', () => {
      const normalized = normalizeHexColor(colorInput.value, this.roleColorFallback);
      row.dataset.entityColor = normalized;
      if (colorInput.value !== normalized) {
        colorInput.value = normalized;
      }
      this.notifyChange();
    });
    row.appendChild(colorInput);

    const { button: removeButton } = createIconButton('Remove role', '\u00D7', () => {
      row.remove();
      this.notifyChange();
    });
    row.appendChild(removeButton);

    rolesContainer.appendChild(row);
    this.notifyChange();
    return row;
  }

  countDepartmentsFilled() {
    if (!this.container) {
      return 0;
    }
    return Array.from(
      this.container.querySelectorAll(
        ".department-node .entity-row[data-entity-type='department'] .entity-input"
      )
    ).filter((input) => input.value.trim().length > 0).length;
  }

  countRolesFilled() {
    if (!this.container) {
      return 0;
    }
    return Array.from(
      this.container.querySelectorAll(
        ".department-node .entity-row[data-entity-type='role'] .entity-input"
      )
    ).filter((input) => input.value.trim().length > 0).length;
  }

  getDepartments() {
    if (!this.container) {
      return [];
    }
    const nodes = Array.from(this.container.querySelectorAll('.department-node'));
    return nodes
      .map((node, index) => {
        const row = node.querySelector(".entity-row[data-entity-type='department']");
        if (!row) {
          return null;
        }
        const input = row.querySelector('.entity-input');
        const fallback = `Department ${index + 1}`;
        const label = (input?.value || '').trim() || fallback;
        node.dataset.entityOrder = String(index + 1);
        const colorInput = row.querySelector('.entity-color');
        const color = normalizeHexColor(
          colorInput?.value || row.dataset.entityColor || this.departmentColorFallback,
          this.departmentColorFallback
        );
        row.dataset.entityColor = color;
        if (colorInput && colorInput.value !== color) {
          colorInput.value = color;
        }
        return { id: node.dataset.entityId, label, color };
      })
      .filter(Boolean);
  }

  getRoles() {
    if (!this.container) {
      return [];
    }
    const departments = this.getDepartments();
    const departmentLookup = new Map(departments.map((entry) => [entry.id, entry]));
    const nodes = Array.from(this.container.querySelectorAll('.department-node'));
    const roles = [];
    nodes.forEach((node, deptIndex) => {
      const departmentId = node.dataset.entityId;
      const departmentEntry = departmentLookup.get(departmentId);
      const departmentLabel = departmentEntry?.label || `Department ${deptIndex + 1}`;
      const rolesContainer = node.querySelector('.role-list');
      if (!rolesContainer) {
        return;
      }
      const rows = Array.from(rolesContainer.querySelectorAll(".entity-row[data-entity-type='role']"));
      rows.forEach((row, roleIndex) => {
        const input = row.querySelector('.entity-input');
        const fallback = `Role ${roleIndex + 1}`;
        const roleName = (input?.value || '').trim() || fallback;
        row.dataset.entityOrder = String(roleIndex + 1);
        const colorInput = row.querySelector('.entity-color');
        const color = normalizeHexColor(
          colorInput?.value || row.dataset.entityColor || this.roleColorFallback,
          this.roleColorFallback
        );
        row.dataset.entityColor = color;
        if (colorInput && colorInput.value !== color) {
          colorInput.value = color;
        }
        const combinedLabel = departmentLabel ? `${roleName} • ${departmentLabel}` : roleName;
        roles.push({
          id: row.dataset.entityId,
          label: combinedLabel,
          color,
          departmentId,
          departmentLabel,
          roleName
        });
      });
    });
    return roles;
  }
}

class OrgManager {
  constructor({ departmentContainer, departmentButton, summary }) {
    this.tree = new DepartmentTree({
      container: departmentContainer,
      addButton: departmentButton,
      onChange: () => this.handleChange(),
      departmentPalette: new ColorPalette(defaultDepartmentColors),
      rolePalette: new ColorPalette(defaultRoleColors),
      departmentColorFallback: '#082f49',
      roleColorFallback: '#2563eb'
    });
    this.summaryEl = summary;
    this.changeListeners = new Set();
    this.ensureDefaults();
    this.updateSummary();
  }

  ensureDefaults() {
    if (this.tree.isEmpty()) {
      const defaults = [
        { name: 'Operations', roles: ['Process Owner'] },
        { name: 'Customer Success', roles: ['Reviewer'] }
      ];
      defaults.forEach(({ name, roles }) => {
        const node = this.tree.addDepartment(name);
        (roles || []).forEach((roleName) => this.tree.addRole(node, roleName));
      });
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
    const departmentCount = this.tree.countDepartmentsFilled();
    const roleCount = this.tree.countRolesFilled();
    if (departmentCount === 0 && roleCount === 0) {
      this.summaryEl.textContent = 'Start by adding departments and linking the roles that support them.';
      return;
    }
    const parts = [];
    if (departmentCount > 0) {
      parts.push(`${departmentCount} ${departmentCount === 1 ? 'department' : 'departments'}`);
    }
    if (roleCount > 0) {
      parts.push(`${roleCount} ${roleCount === 1 ? 'role' : 'roles'}`);
    }
    this.summaryEl.textContent = `Tracking ${parts.join(' and ')} across your journey.`;
  }

  getDepartments() {
    return this.tree.getDepartments();
  }

  getRoles() {
    return this.tree.getRoles();
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
    return new Map(
      this.getRoles().map((entry) => [
        entry.id,
        {
          id: entry.id,
          label: sanitizeLabel(entry.label, entry.label),
          color: entry.color,
          departmentId: entry.departmentId,
          departmentLabel: entry.departmentLabel,
          roleName: entry.roleName
        }
      ])
    );
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

  populateSelect(select, entries) {
    const previous = select.value;
    const category = select.dataset.type || (select === this.departmentSelect ? 'department' : 'role');
    select.innerHTML = '';
    const placeholder = createElement('option', {
      attrs: { value: '' },
      text:
        entries.length === 0
          ? `Add ${category === 'department' ? 'departments' : 'roles'} to assign`
          : `Unassigned ${category}`
    });
    select.appendChild(placeholder);
    entries.forEach((entry) => {
      const option = createElement('option', {
        attrs: { value: entry.id },
        text: entry.label
      });
      if (entry.color) {
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
    this.populateSelect(this.departmentSelect, departments);
    this.populateSelect(this.roleSelect, roles);
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
          assignment.role = {
            id: this.roleSelect.value,
            label: sanitizeLabel(label, label),
            color: normalizeHexColor(option.dataset.color || '#2563eb', '#2563eb')
          };
        }
      }
    }
    return assignment;
  }

  getSelectedRoleDetails() {
    if (!this.roleSelect || !this.roleSelect.value) {
      return null;
    }
    const option = this.roleSelect.selectedOptions?.[0];
    if (!option) {
      return null;
    }
    const label = option.textContent?.trim() || '';
    const color = option.dataset.color ? normalizeHexColor(option.dataset.color) : null;
    return {
      id: this.roleSelect.value,
      label,
      color
    };
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
    this.assignments.roleSelect.addEventListener('change', () => this.applyRoleHighlight());
    this.applyRoleHighlight();
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
    this.applyRoleHighlight();
  }

  collect({ parentId, index, departmentLookup, roleLookup }) {
    const branchLabel = this.branchType === 'yes' ? 'yes' : 'no';
    const fallback = `${branchLabel.charAt(0).toUpperCase() + branchLabel.slice(1)} ${index}`;
    const label = sanitizeLabel(this.input.value, fallback);
    const assignment = this.assignments.collect({ departmentLookup, roleLookup });
    const inlineParts = [];
    if (assignment.role) {
      inlineParts.push(assignment.role.label);
    }
    const displayLabel = inlineParts.length > 0 ? `${label}\\n${inlineParts.join(' • ')}` : label;
    return {
      id: `${parentId}_${this.branchType}${index}`,
      label: displayLabel,
      departmentLane: assignment.department,
      role: assignment.role
    };
  }

  focus() {
    this.input.focus();
  }

  applyRoleHighlight() {
    applyRoleCardTheme(this.element);
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
    this.assignments.roleSelect.addEventListener('change', () => this.applyRoleHighlight());
    this.applyRoleHighlight();
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
    this.applyRoleHighlight();
  }

  collect({ departmentLookup, roleLookup }) {
    const fallback = `Step ${this.index}`;
    const label = sanitizeLabel(this.input.value, fallback);
    const assignment = this.assignments.collect({ departmentLookup, roleLookup });
    const inlineParts = [];
    if (assignment.role) {
      inlineParts.push(assignment.role.label);
    }
    const displayLabel = inlineParts.length > 0 ? `${label}\\n${inlineParts.join(' • ')}` : label;
    return {
      id: this.id,
      label: displayLabel,
      type: 'process',
      departmentLane: assignment.department,
      role: assignment.role
    };
  }

  getDisplayName() {
    return (this.input.value || '').trim() || `Step ${this.index}`;
  }

  focus() {
    this.input.focus();
  }

  applyRoleHighlight() {
    applyRoleCardTheme(this.element);
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
      inlineParts.push(assignment.role.label);
    }
    const displayLabel = inlineParts.length > 0 ? `${label}\\n${inlineParts.join(' • ')}` : label;
    return {
      id: this.id,
      label: displayLabel,
      type: 'decision',
      departmentLane: assignment.department,
      role: assignment.role,
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
    const registerNode = (node) => {
      nodeDeclarations.push(node);
    };
    const roleClassForColor = new Map();
    const roleClassLines = [];
    const roleAssignments = [];
    const queueRoleStyle = (node) => {
      if (!node || !node.role || !node.role.color) {
        return;
      }
      const normalized = normalizeHexColor(node.role.color);
      if (!roleClassForColor.has(normalized)) {
        const className = `roleColor${roleClassForColor.size + 1}`;
        const { fill, stroke, text } = deriveRoleNodeStyles(normalized);
        roleClassForColor.set(normalized, className);
        roleClassLines.push(
          `  classDef ${className} fill:${fill},stroke:${stroke},color:${text},stroke-width:2px;`
        );
      }
      const className = roleClassForColor.get(normalized);
      roleAssignments.push(`  class ${node.id} ${className};`);
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
        registerNode({
          id: entry.id,
          line: `${entry.id}{"${entry.label}"}:::decision`,
          department: entry.departmentLane,
          role: entry.role,
          type: 'decision'
        });
        entry.branches.yes.steps.forEach((step) => {
          registerNode({
            id: step.id,
            line: `${step.id}["${step.label}"]:::step`,
            department: step.departmentLane,
            role: step.role,
            type: 'branch'
          });
        });
        entry.branches.no.steps.forEach((step) => {
          registerNode({
            id: step.id,
            line: `${step.id}["${step.label}"]:::step`,
            department: step.departmentLane,
            role: step.role,
            type: 'branch'
          });
        });
      } else {
        registerNode({
          id: entry.id,
          line: `${entry.id}["${entry.label}"]:::step`,
          department: entry.departmentLane,
          role: entry.role,
          type: 'process'
        });
      }
    });
    const departmentGroups = new Map();
    const departmentOrder = [];
    let departmentCounter = 0;
    nodeDeclarations.forEach((node) => {
      const { line, department } = node;
      if (!department || !department.id) {
        lines.push(`  ${line}`);
        queueRoleStyle(node);
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
      departmentGroups.get(department.id).nodes.push(node);
    });
    departmentOrder.forEach((departmentId) => {
      const { laneId, label, color, nodes } = departmentGroups.get(departmentId);
      lines.push(`  subgraph ${laneId}["${label}"]`);
      lines.push('    direction TB');
      nodes.forEach((node) => {
        lines.push(`    ${node.line}`);
        queueRoleStyle(node);
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
    lines.push(...roleClassLines);
    lines.push(...roleAssignments);
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

class CollapsibleSection {
  constructor(section) {
    this.section = section;
    this.button = section.querySelector('.entity-collapse');
    if (!this.button) {
      return;
    }
    this.heading = section.querySelector('h3');
    this.icon = this.button.querySelector('.entity-collapse-icon');
    this.targets = Array.from(section.querySelectorAll('[data-collapsible]'));
    this.label = this.heading?.textContent?.trim() || 'section';
    const initiallyCollapsed = section.dataset.collapsed === 'true';
    this.setExpanded(!initiallyCollapsed);
    this.button.addEventListener('click', () => {
      const isCollapsed = this.section.dataset.collapsed === 'true';
      this.setExpanded(isCollapsed);
    });
  }

  setExpanded(expanded) {
    this.section.dataset.collapsed = expanded ? 'false' : 'true';
    this.button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    this.button.setAttribute(
      'aria-label',
      `${expanded ? 'Collapse' : 'Expand'} ${this.label}`
    );
    if (this.icon) {
      this.icon.textContent = expanded ? '⌄' : '⌃';
    }
    this.targets.forEach((target) => {
      if (expanded) {
        target.hidden = false;
      } else {
        target.hidden = true;
      }
    });
  }

  static init(sections) {
    return Array.from(sections, (section) => new CollapsibleSection(section));
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
      const icon = toggle.querySelector('span[aria-hidden="true"]');
      const updateState = (collapsed) => {
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute(
          'aria-label',
          `${collapsed ? 'Expand' : 'Collapse'} ${side === 'left' ? 'organization panel' : 'builder panel'}`
        );
        if (icon) {
          icon.textContent = side === 'left' ? (collapsed ? '⟩' : '⟨') : collapsed ? '⟨' : '⟩';
        }
        if (side === 'left') {
          body.dataset.leftCollapsed = String(collapsed);
        } else {
          body.dataset.rightCollapsed = String(collapsed);
        }
      };
      updateState(panel.classList.contains('is-collapsed'));
      toggle.addEventListener('click', () => {
        const collapsed = panel.classList.toggle('is-collapsed');
        updateState(collapsed);
      });
    });
  }
}

class App {
  constructor() {
    this.orgManager = new OrgManager({
      departmentContainer: dom.departmentList,
      departmentButton: dom.addDepartmentButton,
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
    CollapsibleSection.init(dom.entitySections);
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
