export type ApiError = { code: string; message: string; details?: Record<string, unknown>; status: number };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** JSON fetch for the browser: never throws; failures come back as `{ ok: false, error }`. */
export async function api<T>(url: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: init.signal,
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    const e = json?.error;
    return { ok: false, error: { code: e?.code ?? 'INVALID', message: e?.message ?? 'Something went wrong.', details: e?.details, status: res.status } };
  } catch {
    if (init.signal?.aborted) return { ok: false, error: { code: 'ABORTED', message: 'Cancelled.', status: 0 } };
    return { ok: false, error: { code: 'NETWORK', message: 'Network connection was interrupted.', status: 0 } };
  }
}
