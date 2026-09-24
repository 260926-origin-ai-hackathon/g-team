import type { Api, ImageList, Settings, Status } from './types';
import { reorderPhotos } from './status';
const picture = (n: number) => `/demo-${n}.svg`;
let list: ImageList = { current_image_id: 'demo-1', display_seq: 2, queued_count: 3, last_detected_at: new Date(Date.now() - 23 * 60000).toISOString(), images: [1, 2, 3, 4, 5].map((n) => ({ image_id: `demo-${n}`, original_url: picture(n), display_url: picture(n), crop: { x: 0, y: 0, w: 1200, h: 900 }, status: n < 3 ? 'displayed' : 'queued', displayed_at: n < 3 ? new Date(Date.now() - (n - 1) * 86400000).toISOString() : null, sort_order: n, like_count: n === 1 ? 1 : 0, last_liked_at: n === 1 ? new Date().toISOString() : null })) };
let settings: Settings = { test_mode: false, switch_time: '00:00' };
let status: Status = { last_detected_at: list.last_detected_at, last_seen_at: new Date().toISOString(), reset_hours: 12, test_mode: false, warned_at: null, warning_reason: null, is_offline: false };
const copy = <T,>(v: T): T => structuredClone(v);
const delay = () => new Promise(r => setTimeout(r, 180));
export function setDemoScenario(kind: string) { const now = Date.now(); status = { ...status, warned_at: kind === 'warning' ? new Date(now).toISOString() : null, warning_reason: kind === 'warning' ? 'no_detection' : null, is_offline: kind === 'offline', last_seen_at: new Date(now).toISOString(), last_detected_at: new Date(now - 23 * 60000).toISOString() }; if (kind === 'warning') status.last_detected_at = new Date(now - 13 * 3600000).toISOString(); if (kind === 'offline') status.last_seen_at = new Date(now - 40 * 60000).toISOString(); if (kind === 'empty') { list = { ...list, images: [], current_image_id: null, display_seq: 0, queued_count: 0 }; status.last_detected_at = null; } list.last_detected_at = status.last_detected_at; }
export const demoApi: Api = {
  async images() { await delay(); return copy(list) }, async status() { await delay(); return copy(status) }, async settings() { return copy(settings) },
  async upload(data) { await delay(); list.images.push({ image_id: crypto.randomUUID(), original_url: URL.createObjectURL(data.original), display_url: URL.createObjectURL(data.display), crop: data.crop, status: 'queued', displayed_at: null, sort_order: Math.max(0, ...list.images.map(x => x.sort_order)) + 1 }); list.queued_count++; },
  async reorder(id, after) { await delay(); const queue = reorderPhotos(list.images.filter(x => x.status === 'queued'), id, after); queue.forEach((p, i) => p.sort_order = i + 1); },
  async remove(id) { await delay(); const p = list.images.find(x => x.image_id === id); if (!p || p.status !== 'queued') throw Error('この写真は削除できません'); p.status = 'deleted'; list.queued_count--; },
  async updateSettings(data) { await delay(); settings = { ...settings, ...data }; status.test_mode = settings.test_mode; return copy(settings) },
  async setWarning() { status.warned_at = new Date().toISOString(); status.warning_reason = 'demo'; },
  async clearWarning() { status.warned_at = null; status.warning_reason = null; },
  async advance() { await delay(); const p = list.images.filter(x => x.status === 'queued').sort((a, b) => a.sort_order - b.sort_order)[0]; if (!p) throw Error('次に表示する写真がありません'); p.status = 'displayed'; p.displayed_at = new Date().toISOString(); list.current_image_id = p.image_id; list.display_seq++; list.queued_count--; },
};
