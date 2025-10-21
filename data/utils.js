export const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

export const cloneObject = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }
  return { ...value };
};

export const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const mergeDefinedProperties = (base, partial) => {
  const target = cloneObject(base);
  if (!isPlainObject(partial)) {
    return target;
  }
  Object.entries(partial).forEach(([key, value]) => {
    if (value !== undefined) {
      target[key] = value;
    }
  });
  return target;
};

export const collectValidStrings = (values) =>
  ensureArray(values)
    .map((value) => normalizeString(value))
    .filter((value) => value.length > 0);

export const sanitizeMetadata = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }
  return value;
};
