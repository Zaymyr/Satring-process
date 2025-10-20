import { getSupabaseClient, isSupabaseConfigured } from '../supabaseClient.js';

const TABLE_NAME = 'departements';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normaliseString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const prepareRoleFromRow = (role, fallbackIndex) => {
  if (!role || typeof role !== 'object') {
    return {
      id: `role-${fallbackIndex + 1}`,
      name: '',
      color: '',
      metadata: {}
    };
  }
  const id = normaliseString(role.id) || `role-${fallbackIndex + 1}`;
  return {
    id,
    name: normaliseString(role.name || role.label),
    color: normaliseString(role.color),
    metadata: isPlainObject(role.metadata) ? role.metadata : {}
  };
};

const prepareDepartmentFromRow = (row, index) => {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const id = normaliseString(row.id) || `department-${index + 1}`;
  const roles = Array.isArray(row.roles) ? row.roles : [];
  return {
    id,
    name: normaliseString(row.name || row.label),
    color: normaliseString(row.color),
    metadata: isPlainObject(row.metadata) ? row.metadata : {},
    roles: roles.map((role, roleIndex) => prepareRoleFromRow(role, roleIndex))
  };
};

const mapForStorage = (department) => {
  if (!department || typeof department !== 'object') {
    return null;
  }
  const id = normaliseString(department.id);
  if (!id) {
    return null;
  }
  const roles = Array.isArray(department.roles) ? department.roles : [];
  return {
    id,
    name: normaliseString(department.name),
    color: normaliseString(department.color),
    metadata: isPlainObject(department.metadata) ? department.metadata : {},
    roles: roles
      .map((role, index) => {
        if (!role || typeof role !== 'object') {
          return null;
        }
        const roleId = normaliseString(role.id) || `role-${index + 1}`;
        return {
          id: roleId,
          name: normaliseString(role.name || role.label),
          color: normaliseString(role.color),
          metadata: isPlainObject(role.metadata) ? role.metadata : {}
        };
      })
      .filter(Boolean)
  };
};

export const canUseDepartmentsApi = () => isSupabaseConfigured();

export const fetchDepartments = async () => {
  if (!isSupabaseConfigured()) {
    return [];
  }
  try {
    const { data, error } = await getSupabaseClient()
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('Lecture de la table departements échouée :', error);
      return [];
    }
    return (data || [])
      .map((row, index) => prepareDepartmentFromRow(row, index))
      .filter(Boolean);
  } catch (error) {
    console.warn('Erreur inattendue lors du chargement des departements :', error);
    return [];
  }
};

export const upsertDepartments = async (departments) => {
  if (!isSupabaseConfigured()) {
    return false;
  }
  const payload = (Array.isArray(departments) ? departments : [])
    .map((department) => mapForStorage(department))
    .filter(Boolean);
  if (payload.length === 0) {
    return true;
  }
  try {
    const { error } = await getSupabaseClient().from(TABLE_NAME).upsert(payload, {
      onConflict: 'id'
    });
    if (error) {
      console.warn('Synchronisation des departements échouée :', error);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Erreur inattendue lors de la synchronisation des departements :', error);
    return false;
  }
};

export const deleteDepartments = async (ids) => {
  if (!isSupabaseConfigured()) {
    return false;
  }
  const targetIds = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id.trim().length > 0) : [];
  if (targetIds.length === 0) {
    return true;
  }
  try {
    const { error } = await getSupabaseClient()
      .from(TABLE_NAME)
      .delete()
      .in('id', targetIds);
    if (error) {
      console.warn('Suppression de departements échouée :', error);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Erreur inattendue lors de la suppression de departements :', error);
    return false;
  }
};
