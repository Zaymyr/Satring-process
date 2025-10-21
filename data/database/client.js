import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { normalizeString } from '../utils.js';

const isBrowser = () => typeof window !== 'undefined';
const isDocumentAvailable = () => typeof document !== 'undefined';

const readMetaContent = (name) => {
  if (!isDocumentAvailable()) {
    return '';
  }
  const meta = document.querySelector(`meta[name="${name}"]`);
  return normalizeString(meta?.content || '');
};

const readDataAttribute = (attr) => {
  if (!isDocumentAvailable()) {
    return '';
  }
  const element = document.querySelector(`[data-${attr}]`);
  if (!element || !element.dataset) {
    return '';
  }
  return normalizeString(element.dataset[attr]);
};

const readScriptDataset = () => {
  if (!isDocumentAvailable()) {
    return { url: '', anonKey: '' };
  }
  const script = document.currentScript;
  if (!script || !script.dataset) {
    return { url: '', anonKey: '' };
  }
  return {
    url: normalizeString(script.dataset.supabaseUrl),
    anonKey: normalizeString(script.dataset.supabaseAnonKey)
  };
};

const readGlobalConfig = () => {
  if (!isBrowser()) {
    return { url: '', anonKey: '' };
  }
  const globalConfig = window.__SUPABASE_CONFIG__ || window.__SUPABASE__;
  if (!globalConfig || typeof globalConfig !== 'object') {
    return { url: '', anonKey: '' };
  }
  const url = normalizeString(globalConfig.url || globalConfig.supabaseUrl);
  const anonKey = normalizeString(globalConfig.anonKey || globalConfig.supabaseKey || globalConfig.anon_key);
  return { url, anonKey };
};

const detectInitialConfig = () => {
  const globalConfig = readGlobalConfig();
  if (globalConfig.url && globalConfig.anonKey) {
    return globalConfig;
  }

  const scriptConfig = readScriptDataset();
  if (scriptConfig.url && scriptConfig.anonKey) {
    return scriptConfig;
  }

  const metaUrl = readMetaContent('supabase-url');
  const metaAnonKey = readMetaContent('supabase-anon-key');
  if (metaUrl && metaAnonKey) {
    return { url: metaUrl, anonKey: metaAnonKey };
  }

  const dataUrl = readDataAttribute('supabaseUrl');
  const dataAnonKey = readDataAttribute('supabaseAnonKey');
  return { url: dataUrl, anonKey: dataAnonKey };
};

const normalizeConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return { url: '', anonKey: '' };
  }
  const url = normalizeString(config.url);
  const anonKey = normalizeString(config.anonKey);
  return { url, anonKey };
};

let client = null;
let clientConfig = { url: '', anonKey: '' };

const buildClient = ({ url, anonKey }) => {
  if (!url || !anonKey) {
    return null;
  }
  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: false
      }
    });
  } catch (error) {
    console.warn("Échec de l'initialisation de Supabase :", error);
    return null;
  }
};

const assignClient = (config) => {
  const normalized = normalizeConfig(config);
  clientConfig = normalized;
  if (!normalized.url || !normalized.anonKey) {
    return client;
  }
  const nextClient = buildClient(normalized);
  if (nextClient) {
    client = nextClient;
  }
  return client;
};

export const initSupabaseClient = (config, { force = false } = {}) => {
  const normalized = normalizeConfig(config);
  if (!normalized.url || !normalized.anonKey) {
    return client;
  }
  if (!force && client && normalized.url === clientConfig.url && normalized.anonKey === clientConfig.anonKey) {
    return client;
  }
  return assignClient(normalized);
};

export const discoverSupabaseConfig = () => normalizeConfig(detectInitialConfig());

const initialConfig = discoverSupabaseConfig();
assignClient(initialConfig);

export const getSupabaseClient = () => {
  if (!client) {
    throw new Error("Supabase n'est pas configuré. Appelez initSupabaseClient avec vos identifiants.");
  }
  return client;
};

export const isSupabaseConfigured = () => Boolean(client);

export const getSupabaseConfig = () => ({ ...clientConfig });

export const withSupabaseClient = async (callback, { fallback = null, onError } = {}) => {
  if (!isSupabaseConfigured()) {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
  try {
    return await callback(getSupabaseClient());
  } catch (error) {
    if (typeof onError === 'function') {
      try {
        onError(error);
      } catch (handlerError) {
        console.error('Erreur dans le gestionnaire withSupabaseClient :', handlerError);
      }
    }
    if (typeof fallback === 'function') {
      return fallback(error);
    }
    return fallback;
  }
};
