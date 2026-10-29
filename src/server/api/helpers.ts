/** Общие помощники для REST-слоя. */

export function z_bool(value: unknown): boolean {
  return value === true || value === 'on' || value === 'true';
}

/** Единый формат ответа: { ok: true, data } | { ok: false, error, fieldErrors? }. */
export function ok<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function fail(error: string, status = 400, fieldErrors?: Record<string, string>) {
  return Response.json({ ok: false, error, fieldErrors }, { status });
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}