import type { Api, ImageList, Settings, Status } from './types';
import { reorderPhotos } from './status';
const demoPhotos = ['family', 'drawing', 'flowers', 'grandma', 'birthday', 'beach', 'hat', 'park', 'sleep'];
function initialList(): ImageList {
  return { current_image_id: 'demo-1', display_seq: 6, queued_count: 3,
    last_detected_at: new Date(Date.now() - 8 * 60000).toISOString(),
    images: demoPhotos.map((name, i) => ({ image_id: `demo-${i + 1}`,
      original_url: `/demo-photo/${name}`, display_url: `/demo-photo/${name}`,
      crop: { x: 0, y: 0, w: 1200, h: 900 }, status: i < 6 ? 'displayed' : 'queued',
      displayed_at: i < 6 ? new Date(Date.now() - (i + 1) * 86400000).toISOString() : null,
      sort_order: i, like_count: i === 0 ? 2 : 0, last_liked_at: i === 0 ? new Date().toISOString() : null })) };
}
let list = initialList();
let settings: Settings = { test_mode: false, switch_time: '09:00' };
let status: Status = { last_detected_at: list.last_detected_at, last_seen_at: new Date(Date.now() - 60000).toISOString(), reset_hours: 12, test_mode: false, warned_at: null, warning_reason: null, is_offline: false };
const copy = <T,>(v: T): T => structuredClone(v);
const delay = () => new Promise(r => setTimeout(r, 180));
export function setDemoScenario(kind: string) {
  const now = Date.now();
  if (kind !== 'empty' && !list.images.length) list = initialList();
  status = { ...status, warned_at: kind === 'warning' ? new Date(now).toISOString() : null,
    warning_reason: kind === 'warning' ? 'no_detection' : null, is_offline: kind === 'offline',
    last_seen_at: new Date(now - (kind === 'offline' ? 40 : 1) * 60000).toISOString(),
    last_detected_at: new Date(now - (kind === 'warning' ? 13 * 3600000 : 8 * 60000)).toISOString() };
  if (kind === 'empty') { list = { ...list, images: [], current_image_id: null, display_seq: 0, queued_count: 0 }; status.last_detected_at = null; }
  list.last_detected_at = status.last_detected_at;
}
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
