export function jsonSafe(value) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, data: jsonSafe(data), error: null });
}

export function fail(status, code, message, details = null) {
  return { status, code, message, details };
}
