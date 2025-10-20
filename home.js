const STORAGE_KEY = 'mermaidWorkspaceSnapshot';

const dom = {
  departments: document.getElementById('metric-home-departments'),
  roles: document.getElementById('metric-home-roles'),
  diagrams: document.getElementById('metric-home-diagrams')
};

const parseSnapshot = () => {
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
  } catch (error) {
    console.warn('Impossible de lire les statistiques enregistrées :', error);
    return {};
  }
};

const formatCount = (value, fallback = 0) => {
  const number = Number(value);
  if (Number.isFinite(number) && number >= 0) {
    return Math.round(number);
  }
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) && fallbackNumber >= 0
    ? Math.round(fallbackNumber)
    : 0;
};

const setMetricValue = (element, value) => {
  if (!element) {
    return;
  }
  const displayValue = formatCount(value, element.dataset.default);
  element.textContent = String(displayValue);
  const card = element.closest('.metric-card');
  if (card) {
    if (displayValue === 0) {
      card.setAttribute('data-state', 'empty');
    } else {
      card.removeAttribute('data-state');
    }
  }
};

const refreshMetrics = () => {
  const snapshot = parseSnapshot();
  setMetricValue(dom.departments, snapshot.departmentCount);
  setMetricValue(dom.roles, snapshot.roleCount);
  setMetricValue(dom.diagrams, snapshot.diagramProcessCount);
};

refreshMetrics();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      refreshMetrics();
    }
  });
}
