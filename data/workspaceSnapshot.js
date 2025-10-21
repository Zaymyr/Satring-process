import {
  discoverSupabaseConfig,
  getSupabaseClient,
  initSupabaseClient,
  isSupabaseConfigured,
  withSupabaseClient
} from './database/index.js';
import { cloneObject, isPlainObject, mergeDefinedProperties } from './utils.js';

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

const reverseColumnMap = Object.fromEntries(Object.entries(columnMap).map(([key, value]) => [value, key]));

let cachedSnapshot = null;
let channel = null;
let loadingPromise = null;

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

const mergeSnapshots = (base, partial) => mergeDefinedProperties(base, partial);

const normalizeRemoteRow = (row) => {
  if (!isPlainObject(row)) {
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
  const cloned = cloneObject(mergeSnapshots(cachedSnapshot, snapshot));
  listeners.forEach((listener) => {
    try {
      listener(cloned);
    } catch (error) {
      console.error('Erreur dans un écouteur de workspaceSnapshot :', error);
    }
  });
};

export const configureWorkspaceSnapshot = (config, options) => {
  const targetConfig =
    config && typeof config === 'object' ? config : discoverSupabaseConfig();
  if (!targetConfig || typeof targetConfig !== 'object') {
    return isSupabaseConfigured();
  }
  initSupabaseClient(targetConfig, options);
  return isSupabaseConfigured();
};

const loadFromSupabase = async () => {
  return withSupabaseClient(
    async (client) => {
      const { data, error } = await client
        .from(TABLE_NAME)
        .select('*')
        .eq('id', ROW_ID)
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        ensureChannel();
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
    },
    {
      fallback: null,
      onError: (error) => {
        console.warn('Lecture Supabase échouée :', error);
      }
    }
  );
};

export const readWorkspaceSnapshot = async () => {
  if (cachedSnapshot) {
    if (!loadingPromise && isSupabaseConfigured()) {
      loadingPromise = loadFromSupabase().finally(() => {
        loadingPromise = null;
      });
    }
    return cloneObject(cachedSnapshot);
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
  return cloneObject(cachedSnapshot);
};

export const getWorkspaceSnapshotSync = () => {
  if (!cachedSnapshot) {
    cachedSnapshot = readLocalSnapshot();
  }
  return cloneObject(cachedSnapshot);
};

const preparePayload = (snapshot) => {
  const payload = { id: ROW_ID };
  const source = isPlainObject(snapshot) ? snapshot : {};
  Object.entries(columnMap).forEach(([key, column]) => {
    if (source[key] !== undefined) {
      payload[column] = source[key];
    }
  });
  payload.updated_at = new Date().toISOString();
  return payload;
};

export const writeWorkspaceSnapshot = async (partial) => {
  if (!isPlainObject(partial)) {
    return cloneObject(cachedSnapshot);
  }
  cachedSnapshot = mergeSnapshots(cachedSnapshot || readLocalSnapshot(), partial);
  writeLocalSnapshot(cachedSnapshot);
  dispatchEvent(partial);
  if (!isSupabaseConfigured()) {
    return cloneObject(cachedSnapshot);
  }
  await withSupabaseClient(
    async (client) => {
      const payload = preparePayload(cachedSnapshot);
      const { error } = await client.from(TABLE_NAME).upsert(payload, { onConflict: 'id' });
      if (error) {
        throw error;
      }
      return true;
    },
    {
      fallback: false,
      onError: (error) => {
        console.warn('Synchronisation Supabase échouée :', error);
      }
    }
  );
  ensureChannel();
  return cloneObject(cachedSnapshot);
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

