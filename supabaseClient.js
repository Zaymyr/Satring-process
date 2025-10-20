import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const normalizeString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const readMetaContent = (name) => {
  if (typeof document === 'undefined') {
    return '';
  }
  const meta = document.querySelector(`meta[name="${name}"]`);
  return normalizeString(meta?.content || '');
};

const readDataAttribute = (attr) => {
  if (typeof document === 'undefined') {
    return '';
  }
  const el = document.querySelector(`[data-${attr}]`);
  return normalizeString(el?.dataset?.[attr] || '');
};

const detectInitialConfig = () => {
  if (typeof window === 'undefined') {
    return { url: '', anonKey: '' };
  }
  const globalConfig = window.__SUPABASE_CONFIG__ || window.__SUPABASE__;
  if (globalConfig && typeof globalConfig === 'object') {
    const url = normalizeString(globalConfig.url || globalConfig.supabaseUrl);
    const anonKey = normalizeString(globalConfig.anonKey || globalConfig.supabaseKey || globalConfig.anon_key);
    if (url && anonKey) {
      return { url, anonKey };
    }
  }
  const script = document.currentScript;
  if (script) {
    const url = normalizeString(script.dataset.supabaseUrl);
    const anonKey = normalizeString(script.dataset.supabaseAnonKey);
    if (url && anonKey) {
      return { url, anonKey };
    }
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

let client = null;

const buildClient = ({ url, anonKey }) => {
  const normalizedUrl = normalizeString(url);
  const normalizedAnonKey = normalizeString(anonKey);
  if (!normalizedUrl || !normalizedAnonKey) {
    return null;
  }
  try {
    return createClient(normalizedUrl, normalizedAnonKey, {
      auth: {
        persistSession: false
      }
    });
  } catch (error) {
    console.warn('Échec de l\'initialisation de Supabase :', error);
    return null;
  }
};

export const initSupabaseClient = (config) => {
  if (client) {
    return client;
  }
  if (!config || typeof config !== 'object') {
    return null;
  }
  client = buildClient(config);
  return client;
};

const initialConfig = detectInitialConfig();
if (initialConfig.url && initialConfig.anonKey) {
  client = buildClient(initialConfig);
}

export const getSupabaseClient = () => {
  if (!client) {
    throw new Error('Supabase n\'est pas configuré. Appelez initSupabaseClient avec vos identifiants.');
  }
  return client;
};

export const isSupabaseConfigured = () => Boolean(client);

export const getSupabaseConfig = () => ({
  url: client?.rest?.url || normalizeString(initialConfig.url),
  anonKey: normalizeString(initialConfig.anonKey)
});

