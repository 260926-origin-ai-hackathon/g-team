import type { Api, ImageList, Settings, Status } from './types';
import { demoApi } from './demo';
const env = import.meta.env;
export const isDemo = env.VITE_API_MODE === 'demo';
const base = (env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const device = encodeURIComponent(env.VITE_DEVICE_ID ?? '');
const path = `/devices/${device}`;
export const configured = isDemo || !!(base && device && env.VITE_USER_ID);
export async function request<T>(route: string, init: RequestInit = {}): Promise<T> {
  if (!configured) throw Error('API接続設定が未完了です。接続URLと固定IDを設定してください。');
  const headers = new Headers(init.headers); if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let res: Response; try { res = await fetch(`${base}${route}`, { ...init, headers, signal: AbortSignal.timeout(20000), cache: 'no-store' }); } catch { throw Error('サーバーに接続できませんでした。通信を確認して再試行してください。'); }
  if (!res.ok) { let code = ''; try { const error = await res.json(); code = typeof error?.error === 'string' ? error.error : ''; } catch {/* HTTP status remains available */ } throw Error(`処理できませんでした（${res.status}${code ? ` / ${code}` : ''}）。再試行してください。`); }
  if (res.status === 204) return undefined as T; const text = await res.text(); return text ? JSON.parse(text) as T : undefined as T;
}
const liveApi: Api = {
  images: () => request<ImageList>(`${path}/images?status=all`),
  status: () => request<Status>(`${path}/status`),
  settings: () => request<Settings>(`${path}/status`),
  upload: ({ original, display, crop }) => { const body = new FormData(); body.append('original', original, 'original.jpg'); body.append('display', display, 'display.jpg'); body.append('crop', JSON.stringify(crop)); return request(`${path}/images`, { method: 'POST', body }) },
  reorder: (id, after) => request(`${path}/images/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ after_image_id: after }) }),
  remove: id => request(`${path}/images/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  updateSettings: data => request<Settings>(`${path}/settings`, { method: 'PATCH', body: JSON.stringify(data) }),
  setWarning: () => request(`${path}/warnings`, { method: 'POST', body: JSON.stringify({ reason: 'demo' }) }),
  clearWarning: () => request(`${path}/warnings`, { method: 'DELETE' }),
  advance: () => request(`${path}/display/advance`, { method: 'POST' }),
};
export const api = isDemo ? demoApi : liveApi;
