import { getSupabaseClient, initSupabaseClient, isSupabaseConfigured } from '../supabaseClient.js';

const STORAGE_KEY = 'mermaidWorkspaceSnapshot';
const TABLE_NAME = 'workspace_snapshots';
const ROW_ID = 'default';

const columnMap = {
  departmentCount: 'department_count',
  roleCount: 'role_count',
  detailCount: 'detail_count',
  diagramProcessCount: 'diagram_process_count',
  lastOrganigramUpdate: 'last_organigram_update',
  lastDiagramUpdate: 'last_diagram_update'
};

const reverseColumnMap = Object.fromEntries(
  Object.entries(columnMap).map(([key, value]) => [value, key])
);

let cachedSnapshot = null;
let channel = null;
let loadingPromise = null;

const clone = (value) => ({ ...(value || {}) });

const isBrowser = () => typeof window !== 'undefined';

const readLocalSnapshot = () => {
  if (!isBrowser() || !window.localStorage) {
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

const writeLocalSnapshot = (snapshot) => {
  if (!isBrowser() || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* Ignorer les erreurs de stockage */
  }
};

const mergeSnapshots = (base, partial) => {
  const next = { ...(base || {}) };
  Object.entries(partial || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    next[key] = value;
  });
  return next;
};

const normalizeRemoteRow = (row) => {
  if (!row || typeof row !== 'object') {
    return {};
  }
  return Object.entries(row).reduce((acc, [column, value]) => {
    const key = reverseColumnMap[column];
    if (key) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const ensureChannel = () => {
  if (!isSupabaseConfigured() || channel) {
    return channel;
  }
  try {
    const client = getSupabaseClient();
    channel = client
      .channel('workspace_snapshot_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE_NAME,
          filter: `id=eq.${ROW_ID}`
        },
        (payload) => {
          const remote = normalizeRemoteRow(payload.new || payload.old || {});
          cachedSnapshot = mergeSnapshots(cachedSnapshot, remote);
          writeLocalSnapshot(cachedSnapshot);
          dispatchEvent(remote);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          /* noop */
        }
      });
  } catch (error) {
    console.warn('Impossible de souscrire aux mises à jour Supabase :', error);
  }
  return channel;
};

const listeners = new Set();

const dispatchEvent = (snapshot) => {
  if (!snapshot) {
    return;
  }
  const cloned = clone(mergeSnapshots(cachedSnapshot, snapshot));
  listeners.forEach((listener) => {
    try {
      listener(cloned);
    } catch (error) {
      console.error('Erreur dans un écouteur de workspaceSnapshot :', error);
    }
  });
};

export const configureWorkspaceSnapshot = (config) => {
  if (config && typeof config === 'object') {
    initSupabaseClient(config);
  }
};

const loadFromSupabase = async () => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE_NAME)
      .select('*')
      .eq('id', ROW_ID)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    const remote = normalizeRemoteRow(data);
    if (Object.keys(remote).length > 0) {
      cachedSnapshot = mergeSnapshots(cachedSnapshot, remote);
      writeLocalSnapshot(cachedSnapshot);
      dispatchEvent(remote);
    }
    ensureChannel();
    return remote;
  } catch (error) {
    console.warn('Lecture Supabase échouée :', error);
    return null;
  }
};

export const readWorkspaceSnapshot = async () => {
  if (cachedSnapshot) {
    if (!loadingPromise && isSupabaseConfigured()) {
      loadingPromise = loadFromSupabase().finally(() => {
        loadingPromise = null;
      });
    }
    return clone(cachedSnapshot);
  }
  cachedSnapshot = readLocalSnapshot();
  if (isSupabaseConfigured() && !loadingPromise) {
    loadingPromise = loadFromSupabase().finally(() => {
      loadingPromise = null;
    });
  }
  if (loadingPromise) {
    try {
      await loadingPromise;
    } catch {
      /* Ignorer */
    }
  }
  return clone(cachedSnapshot);
};

export const getWorkspaceSnapshotSync = () => {
  if (!cachedSnapshot) {
    cachedSnapshot = readLocalSnapshot();
  }
  return clone(cachedSnapshot);
};

const preparePayload = (snapshot) => {
  const payload = { id: ROW_ID };
  Object.entries(columnMap).forEach(([key, column]) => {
    if (snapshot[key] !== undefined) {
      payload[column] = snapshot[key];
    }
  });
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const writeWorkspaceSnapshot = async (partial) => {
  if (!partial || typeof partial !== 'object') {
    return clone(cachedSnapshot);
  }
  cachedSnapshot = mergeSnapshots(cachedSnapshot || readLocalSnapshot(), partial);
  writeLocalSnapshot(cachedSnapshot);
  dispatchEvent(partial);
  if (!isSupabaseConfigured()) {
    return clone(cachedSnapshot);
  }
  try {
    const payload = preparePayload(cachedSnapshot);
    const { error } = await getSupabaseClient()
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('Synchronisation Supabase échouée :', error);
  }
  ensureChannel();
  return clone(cachedSnapshot);
};

export const subscribeWorkspaceSnapshot = (listener) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

if (isSupabaseConfigured()) {
  ensureChannel();
}

