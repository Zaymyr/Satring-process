const dom = {
  addDepartmentButton: document.getElementById('add-department'),
  departmentList: document.getElementById('department-list'),
  orgSummary: document.getElementById('org-summary'),
  detailEmpty: document.getElementById('detail-empty'),
  detailForm: document.getElementById('detail-form'),
  detailName: document.getElementById('detail-name'),
  detailColor: document.getElementById('detail-color'),
  detailSelectionSummary: document.getElementById('detail-selection-summary'),
  detailDescription: document.getElementById('detail-description'),
  detailBadges: document.getElementById('detail-badges'),
  metricDepartments: document.getElementById('metric-departments-count'),
  metricRoles: document.getElementById('metric-roles-count'),
  metricDetails: document.getElementById('metric-details-count')
};

const workspaceSnapshot = (() => {
  const STORAGE_KEY = 'mermaidWorkspaceSnapshot';
  const read = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {};
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  };
  const write = (partial) => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const current = read();
    const next = { ...current };
    Object.entries(partial || {}).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      next[key] = value;
    });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Ignore storage errors */
    }
  };
  return { key: STORAGE_KEY, read, write };
})();

dom.departmentList?.setAttribute(
  'data-empty-text',
  dom.departmentList?.getAttribute('data-empty-text') ||
    "Ajoutez des départements pour commencer à organiser vos équipes."
);

const defaultDepartmentColors = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#facc15', '#ef4444', '#14b8a6'];
const defaultRoleColors = ['#38bdf8', '#f472b6', '#fde68a', '#c084fc', '#34d399', '#fb7185', '#f97316'];

const metadataStore = new Map();
let currentSelection = null;

const defaultMetadata = {
  department: () => ({ id: '', type: 'department', lead: '', description: '', objectives: '', notes: '' }),
  role: () => ({ id: '', type: 'role', owner: '', responsibilities: '', skills: '', notes: '' })
};

const metadataKeys = {
  department: ['lead', 'description', 'objectives', 'notes'],
  role: ['owner', 'responsibilities', 'skills', 'notes']
};

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

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
    onSelect,
    onRemove,
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
    this.selectionListeners = new Set();
    this.removeListeners = new Set();
    this.selectedRow = null;
    this.selection = null;
    if (typeof onSelect === 'function') {
      this.onSelect(onSelect);
    }
    if (typeof onRemove === 'function') {
      this.onRemove(onRemove);
    }
    if (this.addButton) {
      this.addButton.addEventListener('click', () => {
        const node = this.addDepartment();
        node?.querySelector('.entity-input')?.focus();
      });
    }
  }

  onSelect(listener) {
    if (typeof listener === 'function') {
      this.selectionListeners.add(listener);
    }
  }

  emitSelect(selection) {
    this.selectionListeners.forEach((listener) => listener(selection));
  }

  onRemove(listener) {
    if (typeof listener === 'function') {
      this.removeListeners.add(listener);
    }
  }

  emitRemove(payload) {
    this.removeListeners.forEach((listener) => listener(payload));
  }

  notifyChange() {
    if (typeof this.onChange === 'function') {
      this.onChange();
    }
  }

  isEmpty() {
    return !this.container || this.container.childElementCount === 0;
  }

  selectEntity(selection) {
    if (this.selectedRow) {
      this.selectedRow.classList.remove('is-selected');
    }
    this.selection = selection || null;
    this.selectedRow = selection?.row || null;
    if (this.selectedRow) {
      this.selectedRow.classList.add('is-selected');
    }
    this.emitSelect(this.selection ? { ...this.selection } : null);
  }

  clearSelection() {
    this.selectEntity(null);
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
      'Réduire les rôles du département',
      '\u25BE'
    );
    collapseButton.classList.add('department-collapse');
    collapseButton.setAttribute('aria-expanded', 'true');

    const input = createElement('input', {
      className: 'entity-input',
      attrs: {
        type: 'text',
        placeholder: 'Nommer le département',
        'aria-label': 'Nom du département'
      }
    });
    input.value = value;

    const colorInput = createElement('input', {
      className: 'entity-color',
      attrs: {
        type: 'color',
        'aria-label': 'Couleur du département',
        title: 'Choisir la couleur du département'
      }
    });
    const initialColor = normalizeHexColor(
      options.color || this.departmentPalette?.next() || this.departmentColorFallback,
      this.departmentColorFallback
    );
    colorInput.value = initialColor;
    row.dataset.entityColor = initialColor;

    const addRoleButton = createElement('button', {
      className: 'add-role-button',
      attrs: { type: 'button' },
      text: 'Ajouter un rôle'
    });

    const { button: removeButton } = createIconButton('Supprimer le département', '\u00D7', (event) => {
      event.stopPropagation();
      const roleIds = Array.from(
        node.querySelectorAll(".entity-row[data-entity-type='role']")
      ).map((roleRow) => roleRow.dataset.entityId);
      const affectedIds = new Set([id, ...roleIds]);
      if (this.selection && affectedIds.has(this.selection.id)) {
        this.clearSelection();
      }
      node.remove();
      this.emitRemove({ type: 'department', id, roles: roleIds });
      this.notifyChange();
    });

    const rolesContainer = createElement('div', {
      className: 'role-list',
      attrs: { role: 'group' }
    });
    rolesContainer.dataset.emptyText =
      'Ajoutez des rôles pour préciser qui soutient ce département.';
    const rolesId = `${id}-roles`;
    rolesContainer.id = rolesId;
    collapseButton.setAttribute('aria-controls', rolesId);

    const getDepartmentLabel = () => sanitizeString(input.value) || 'ce département';
    const updateRoleButtonLabel = () => {
      const label = getDepartmentLabel();
      addRoleButton.setAttribute('aria-label', `Ajouter un rôle à ${label}`);
      addRoleButton.title = `Ajouter un rôle à ${label}`;
    };

    const updateCollapseLabel = () => {
      const collapsed = node.dataset.collapsed === 'true';
      collapseButton.setAttribute(
        'aria-label',
        `${collapsed ? 'Développer' : 'Réduire'} les rôles de ${getDepartmentLabel()}`
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

    const getSelection = () => ({
      type: 'department',
      id,
      node,
      row,
      input,
      colorInput,
      rolesContainer,
      getRoleCount: () =>
        rolesContainer
          ? rolesContainer.querySelectorAll(".entity-row[data-entity-type='role']").length
          : 0
    });

    collapseIcon?.classList.add('department-collapse-icon');

    collapseButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const collapsed = node.dataset.collapsed === 'true';
      setCollapsed(!collapsed);
      this.selectEntity(getSelection());
    });

    input.addEventListener('input', () => {
      updateRoleButtonLabel();
      updateCollapseLabel();
      this.notifyChange();
      if (this.selection?.id === id) {
        this.selectEntity(getSelection());
      }
    });

    input.addEventListener('focus', () => {
      this.selectEntity(getSelection());
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const newNode = this.addDepartment();
        newNode?.querySelector('.entity-input')?.focus();
      }
    });

    colorInput.addEventListener('input', () => {
      const normalized = normalizeHexColor(colorInput.value, this.departmentColorFallback);
      row.dataset.entityColor = normalized;
      if (colorInput.value !== normalized) {
        colorInput.value = normalized;
      }
      this.notifyChange();
      if (this.selection?.id === id) {
        this.selectEntity(getSelection());
      }
    });

    colorInput.addEventListener('focus', () => {
      this.selectEntity(getSelection());
    });

    addRoleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const roleRow = this.addRole(node);
      roleRow?.querySelector('.entity-input')?.focus();
    });

    addRoleButton.addEventListener('focus', () => {
      this.selectEntity(getSelection());
    });

    removeButton.addEventListener('focus', () => {
      this.selectEntity(getSelection());
    });

    row.append(collapseButton, input, colorInput, addRoleButton, removeButton);
    row.addEventListener('click', () => {
      this.selectEntity(getSelection());
    });

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

    this.selectEntity(getSelection());
    this.notifyChange();
    return node;
  }

  addRole(departmentNode, value = '', options = {}) {
    if (!departmentNode) {
      return null;
    }
    const rolesContainer = departmentNode.querySelector('.role-list');
    if (!rolesContainer) {
      return null;
    }
    this.roleCounter += 1;
    const id = options.id || `role-${this.roleCounter}`;
    const departmentId = departmentNode.dataset.entityId;
    const row = createElement('div', {
      className: 'entity-row',
      dataset: { entityType: 'role', entityId: id, parentDepartment: departmentId },
      attrs: { role: 'listitem' }
    });

    const input = createElement('input', {
      className: 'entity-input',
      attrs: { type: 'text', placeholder: 'Nommer le rôle', 'aria-label': 'Nom du rôle' }
    });
    input.value = value;

    const colorInput = createElement('input', {
      className: 'entity-color',
      attrs: {
        type: 'color',
        'aria-label': 'Couleur du rôle',
        title: 'Choisir la couleur du rôle'
      }
    });
    const initialColor = normalizeHexColor(
      options.color || this.rolePalette?.next() || this.roleColorFallback,
      this.roleColorFallback
    );
    colorInput.value = initialColor;
    row.dataset.entityColor = initialColor;

    const { button: removeButton } = createIconButton('Supprimer le rôle', '\u00D7', (event) => {
      event.stopPropagation();
      row.remove();
      this.emitRemove({ type: 'role', id });
      if (this.selection?.id === id) {
        this.clearSelection();
      }
      this.notifyChange();
    });

    const parentRow = departmentNode.querySelector(".entity-row[data-entity-type='department']");
    const getSelection = () => ({
      type: 'role',
      id,
      row,
      input,
      colorInput,
      node: departmentNode,
      parentDepartmentId: departmentId,
      parentDepartmentInput: parentRow?.querySelector('.entity-input') || null
    });

    input.addEventListener('input', () => {
      this.notifyChange();
      if (this.selection?.id === id) {
        this.selectEntity(getSelection());
      }
    });

    input.addEventListener('focus', () => {
      this.selectEntity(getSelection());
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const newRole = this.addRole(departmentNode);
        newRole?.querySelector('.entity-input')?.focus();
      }
    });

    colorInput.addEventListener('input', () => {
      const normalized = normalizeHexColor(colorInput.value, this.roleColorFallback);
      row.dataset.entityColor = normalized;
      if (colorInput.value !== normalized) {
        colorInput.value = normalized;
      }
      this.notifyChange();
      if (this.selection?.id === id) {
        this.selectEntity(getSelection());
      }
    });

    colorInput.addEventListener('focus', () => {
      this.selectEntity(getSelection());
    });

    removeButton.addEventListener('focus', () => {
      this.selectEntity(getSelection());
    });

    row.append(input, colorInput, removeButton);
    row.addEventListener('click', () => {
      this.selectEntity(getSelection());
    });

    rolesContainer.appendChild(row);
    this.selectEntity(getSelection());
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
    ).filter((input) => sanitizeString(input.value).length > 0).length;
  }

  countRolesFilled() {
    if (!this.container) {
      return 0;
    }
    return Array.from(
      this.container.querySelectorAll(
        ".department-node .entity-row[data-entity-type='role'] .entity-input"
      )
    ).filter((input) => sanitizeString(input.value).length > 0).length;
  }

  getDepartments() {
    if (!this.container) {
      return [];
    }
    const nodes = Array.from(this.container.querySelectorAll('.department-node'));
    return nodes
      .map((node, index) => {
        const row = node.querySelector(".entity-row[data-entity-type='department']");
        const input = row?.querySelector('.entity-input');
        if (!row || !input) {
          return null;
        }
        const fallback = `Département ${index + 1}`;
        const label = sanitizeString(input.value) || fallback;
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
      const departmentLabel = departmentEntry?.label || `Département ${deptIndex + 1}`;
      const rolesContainer = node.querySelector('.role-list');
      if (!rolesContainer) {
        return;
      }
      const rows = Array.from(rolesContainer.querySelectorAll(".entity-row[data-entity-type='role']"));
      rows.forEach((row, roleIndex) => {
        const input = row.querySelector('.entity-input');
        const fallback = `Rôle ${roleIndex + 1}`;
        const roleName = sanitizeString(input?.value) || fallback;
        const colorInput = row.querySelector('.entity-color');
        const color = normalizeHexColor(
          colorInput?.value || row.dataset.entityColor || this.roleColorFallback,
          this.roleColorFallback
        );
        row.dataset.entityColor = color;
        if (colorInput && colorInput.value !== color) {
          colorInput.value = color;
        }
        roles.push({
          id: row.dataset.entityId,
          label: roleName,
          color,
          departmentId,
          departmentLabel
        });
      });
    });
    return roles;
  }
}

const ensureMetadata = (type, id) => {
  const existing = metadataStore.get(id);
  if (existing && existing.type === type) {
    return existing;
  }
  const templateFactory = defaultMetadata[type];
  const template = templateFactory ? templateFactory() : { id, type };
  template.id = id;
  template.type = type;
  metadataStore.set(id, template);
  return template;
};

const removeMetadata = (idOrIds) => {
  if (Array.isArray(idOrIds)) {
    idOrIds.forEach((id) => metadataStore.delete(id));
    return;
  }
  metadataStore.delete(idOrIds);
};

const countEnrichedEntries = () => {
  let count = 0;
  metadataStore.forEach((entry) => {
    const keys = metadataKeys[entry.type] || [];
    if (keys.some((key) => sanitizeString(entry[key]).length > 0)) {
      count += 1;
    }
  });
  return count;
};

const tree = new DepartmentTree({
  container: dom.departmentList,
  addButton: dom.addDepartmentButton,
  onChange: () => {
    updateSummary();
    updateMetrics();
    refreshDetailPanel();
  },
  onSelect: (selection) => {
    currentSelection = selection;
    refreshDetailPanel();
  },
  onRemove: ({ type, id, roles }) => {
    if (type === 'department') {
      removeMetadata(id);
      if (Array.isArray(roles)) {
        removeMetadata(roles);
      }
    } else if (type === 'role') {
      removeMetadata(id);
    }
    updateMetrics();
    if (currentSelection && currentSelection.id === id) {
      currentSelection = null;
      refreshDetailPanel();
    }
  },
  departmentPalette: new ColorPalette(defaultDepartmentColors),
  rolePalette: new ColorPalette(defaultRoleColors),
  departmentColorFallback: '#082f49',
  roleColorFallback: '#2563eb'
});

const updateSummary = () => {
  if (!dom.orgSummary) {
    return;
  }
  const departmentCount = tree.countDepartmentsFilled();
  const roleCount = tree.countRolesFilled();
  if (departmentCount === 0 && roleCount === 0) {
    dom.orgSummary.textContent =
      'Ajoutez vos départements et imbriquez les rôles pour cartographier votre structure.';
    return;
  }
  const parts = [];
  if (departmentCount > 0) {
    parts.push(
      `${departmentCount} ${departmentCount === 1 ? 'département' : 'départements'}`
    );
  }
  if (roleCount > 0) {
    parts.push(`${roleCount} ${roleCount === 1 ? 'rôle' : 'rôles'}`);
  }
  dom.orgSummary.textContent = `Suivi de ${parts.join(' et ')} dans votre organisation.`;
};

const updateMetrics = () => {
  const departmentTotal = tree.getDepartments().length;
  const roleTotal = tree.getRoles().length;
  const detailTotal = countEnrichedEntries();

  if (dom.metricDepartments) {
    dom.metricDepartments.textContent = String(departmentTotal);
  }
  if (dom.metricRoles) {
    dom.metricRoles.textContent = String(roleTotal);
  }
  if (dom.metricDetails) {
    dom.metricDetails.textContent = String(detailTotal);
  }

  workspaceSnapshot.write({
    departmentCount: departmentTotal,
    roleCount: roleTotal,
    detailCount: detailTotal,
    lastOrganigramUpdate: new Date().toISOString()
  });
};

const buildBadge = (label, value) => {
  const badge = createElement('span', { className: 'detail-badge' });
  badge.textContent = `${label} : ${value}`;
  return badge;
};

const refreshDetailPanel = () => {
  if (!dom.detailForm || !dom.detailEmpty) {
    return;
  }
  if (!currentSelection) {
    dom.detailForm.hidden = true;
    dom.detailEmpty.hidden = false;
    dom.detailSelectionSummary.hidden = true;
    if (dom.detailDescription) {
      dom.detailDescription.textContent =
        'Sélectionnez un élément de l\'arborescence pour compléter les informations facultatives et suivre les contacts clés.';
    }
    if (dom.detailBadges) {
      dom.detailBadges.hidden = true;
      dom.detailBadges.innerHTML = '';
    }
    return;
  }

  dom.detailEmpty.hidden = true;
  dom.detailForm.hidden = false;

  const { type, id, input, colorInput, parentDepartmentInput, getRoleCount } = currentSelection;
  const nameValue = sanitizeString(input?.value) || (type === 'department' ? 'Département' : 'Rôle');
  const colorValue = normalizeHexColor(colorInput?.value || '#0ea5e9', '#0ea5e9');
  if (dom.detailName && document.activeElement !== dom.detailName) {
    dom.detailName.value = nameValue;
  }
  if (dom.detailColor && document.activeElement !== dom.detailColor) {
    dom.detailColor.value = colorValue;
  }

  const metadata = ensureMetadata(type, id);

  const fields = dom.detailForm.querySelectorAll('.detail-field[data-entity]');
  fields.forEach((field) => {
    const entity = field.dataset.entity;
    if (!entity) {
      return;
    }
    const show = entity === type;
    field.hidden = !show;
    const target = field.querySelector('input, textarea');
    if (target) {
      const key = target.dataset.metaKey;
      if (show && key) {
        if (document.activeElement !== target) {
          target.value = metadata[key] || '';
        }
      } else if (!show && document.activeElement === target) {
        target.blur();
      }
    }
  });

  if (dom.detailDescription) {
    dom.detailDescription.textContent =
      type === 'department'
        ? 'Complétez les informations du département pour décrire sa mission et ses responsables.'
        : 'Ajoutez des précisions sur le rôle sélectionné afin de clarifier ses responsabilités.';
  }

  if (dom.detailSelectionSummary) {
    if (type === 'department') {
      const count = typeof getRoleCount === 'function' ? getRoleCount() : 0;
      const roleText = `${count} ${count === 1 ? 'rôle' : 'rôles'} liés`;
      dom.detailSelectionSummary.textContent = `Département « ${nameValue} » — ${roleText}.`;
    } else if (type === 'role') {
      const parentLabel = sanitizeString(parentDepartmentInput?.value) || 'Département non nommé';
      dom.detailSelectionSummary.textContent = `Rôle « ${nameValue} » — Département : ${parentLabel}.`;
    }
    dom.detailSelectionSummary.hidden = false;
  }

  if (dom.detailBadges) {
    dom.detailBadges.innerHTML = '';
    const badges = [];
    badges.push(buildBadge('Type', type === 'department' ? 'Département' : 'Rôle'));
    if (type === 'department') {
      const count = typeof getRoleCount === 'function' ? getRoleCount() : 0;
      badges.push(buildBadge('Rôles', count));
      if (sanitizeString(metadata.lead)) {
        badges.push(buildBadge('Responsable', metadata.lead));
      }
    } else if (type === 'role') {
      const parentLabel = sanitizeString(parentDepartmentInput?.value) || 'Non défini';
      badges.push(buildBadge('Département', parentLabel));
      if (sanitizeString(metadata.owner)) {
        badges.push(buildBadge('Titulaire', metadata.owner));
      }
    }
    const filledKeys = metadataKeys[type] || [];
    const filledCount = filledKeys.filter((key) => sanitizeString(metadata[key]).length > 0).length;
    if (filledCount > 0) {
      badges.push(buildBadge('Champs remplis', filledCount));
    }
    badges.forEach((badge) => dom.detailBadges.appendChild(badge));
    dom.detailBadges.hidden = badges.length === 0;
  }
};

if (dom.detailName) {
  dom.detailName.addEventListener('input', () => {
    if (!currentSelection) {
      return;
    }
    const { input } = currentSelection;
    if (input) {
      input.value = dom.detailName.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    refreshDetailPanel();
  });
}

if (dom.detailColor) {
  dom.detailColor.addEventListener('input', () => {
    if (!currentSelection) {
      return;
    }
    const { colorInput } = currentSelection;
    if (colorInput) {
      colorInput.value = dom.detailColor.value;
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    refreshDetailPanel();
  });
}

if (dom.detailForm) {
  dom.detailForm.addEventListener('input', (event) => {
    const target = event.target;
    if (!currentSelection || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    const metaKey = target.dataset.metaKey;
    const entity = target.dataset.entity;
    if (!metaKey || entity !== currentSelection.type) {
      return;
    }
    const metadata = ensureMetadata(currentSelection.type, currentSelection.id);
    metadata[metaKey] = target.value;
    metadataStore.set(currentSelection.id, metadata);
    updateMetrics();
    refreshDetailPanel();
  });
}

updateSummary();
updateMetrics();
refreshDetailPanel();
