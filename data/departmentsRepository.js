import { isSupabaseConfigured, withSupabaseClient } from './database/index.js';
import {
  collectValidStrings,
  ensureArray,
  isPlainObject,
  normalizeString,
  sanitizeMetadata
} from './utils.js';

const TABLE_NAME = 'departements';

const createDefaultRole = (index) => ({
  id: `role-${index + 1}`,
  name: '',
  color: '',
  metadata: {}
});

const prepareRoleFromRow = (role, fallbackIndex) => {
  if (!isPlainObject(role)) {
    return createDefaultRole(fallbackIndex);
  }
  const id = normalizeString(role.id) || `role-${fallbackIndex + 1}`;
  return {
    id,
    name: normalizeString(role.name || role.label),
    color: normalizeString(role.color),
    metadata: sanitizeMetadata(role.metadata)
  };
};

const prepareDepartmentFromRow = (row, index) => {
  if (!isPlainObject(row)) {
    return null;
  }
  const id = normalizeString(row.id) || `department-${index + 1}`;
  const roles = ensureArray(row.roles);
  return {
    id,
    name: normalizeString(row.name || row.label),
    color: normalizeString(row.color),
    metadata: sanitizeMetadata(row.metadata),
    roles: roles.map((role, roleIndex) => prepareRoleFromRow(role, roleIndex))
  };
};

const prepareRoleForStorage = (role, index) => {
  if (!isPlainObject(role)) {
    return null;
  }
  const id = normalizeString(role.id) || `role-${index + 1}`;
  return {
    id,
    name: normalizeString(role.name || role.label),
    color: normalizeString(role.color),
    metadata: sanitizeMetadata(role.metadata)
  };
};

const prepareDepartmentForStorage = (department) => {
  if (!isPlainObject(department)) {
    return null;
  }
  const id = normalizeString(department.id);
  if (!id) {
    return null;
  }
  const roles = ensureArray(department.roles)
    .map((role, index) => prepareRoleForStorage(role, index))
    .filter(Boolean);
  return {
    id,
    name: normalizeString(department.name),
    color: normalizeString(department.color),
    metadata: sanitizeMetadata(department.metadata),
    roles
  };
};

export const canUseDepartmentsApi = () => isSupabaseConfigured();

export const fetchDepartments = async () =>
  withSupabaseClient(
    async (client) => {
      const { data, error } = await client
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        console.warn('Lecture de la table departements échouée :', error);
        return [];
      }
      return ensureArray(data)
        .map((row, index) => prepareDepartmentFromRow(row, index))
        .filter(Boolean);
    },
    {
      fallback: [],
      onError: (error) => {
        console.warn('Erreur inattendue lors du chargement des departements :', error);
      }
    }
  );

export const upsertDepartments = async (departments) => {
  const payload = ensureArray(departments)
    .map((department) => prepareDepartmentForStorage(department))
    .filter(Boolean);
  if (payload.length === 0) {
    return true;
  }
  return withSupabaseClient(
    async (client) => {
      const { error } = await client.from(TABLE_NAME).upsert(payload, {
        onConflict: 'id'
      });
      if (error) {
        console.warn('Synchronisation des departements échouée :', error);
        return false;
      }
      return true;
    },
    {
      fallback: false,
      onError: (error) => {
        console.warn('Erreur inattendue lors de la synchronisation des departements :', error);
      }
    }
  );
};

export const deleteDepartments = async (ids) => {
  const targetIds = collectValidStrings(ids);
  if (targetIds.length === 0) {
    return true;
  }
  return withSupabaseClient(
    async (client) => {
      const { error } = await client
        .from(TABLE_NAME)
        .delete()
        .in('id', targetIds);
      if (error) {
        console.warn('Suppression de departements échouée :', error);
        return false;
      }
      return true;
    },
    {
      fallback: false,
      onError: (error) => {
        console.warn('Erreur inattendue lors de la suppression de departements :', error);
      }
    }
  );
};
