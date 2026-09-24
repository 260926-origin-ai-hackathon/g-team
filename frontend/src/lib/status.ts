import type { Status } from './types';
export function relativeTime(value: string | null, now = Date.now()): string {
  if (!value) return 'まだ記録がありません';
  const ms = now - Date.parse(value); if (!Number.isFinite(ms) || ms < 0) return '時刻を確認できません';
  const mins = Math.floor(ms / 60000); if (mins < 1) return 'たった今'; if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60); return hours < 24 ? `${hours}時間前` : `${Math.floor(hours / 24)}日前`;
}
export function getActivity(s: Status | null, lastMotion: string | null, now = Date.now()) {
  const motion = s?.last_detected_at ?? lastMotion;
  const known = motion !== null && Number.isFinite(Date.parse(motion)) && Date.parse(motion) <= now;
  const offline = !!s?.last_seen_at && now - Date.parse(s.last_seen_at) >= 30 * 60000;
  const silent = known && s !== null && now - Date.parse(motion) >= (s.test_mode ? 1000 : s.reset_hours * 3600000);
  if (offline) return { tone: 'warning', title: '機器の通信を確認してください', detail: silent ? '長時間、動きも確認できていません。' : '現在の動きの有無は確認できません。' };
  if (silent) return { tone: 'alert', title: 'しばらく反応がありません', detail: 'ご家族に連絡して、様子を確認してください。' };
  if (!known) return { tone: 'unknown', title: '生活の反応を待っています', detail: '最初の検知が届くと、ここにお知らせします。' };
  if (s === null || !s.last_seen_at || !Number.isFinite(Date.parse(s.last_seen_at)) || Date.parse(s.last_seen_at) > now) return { tone: 'unknown', title: '最後の反応を記録しています', detail: '機器の通信状態はまだ取得できていません。' };
  return { tone: 'normal', title: '生活の反応が届いています', detail: 'センサーで動きを検知した記録です。' };
}
export function reorderPhotos<T extends { image_id: string }>(items: T[], id: string, after: string | null): T[] {
  const target = items.find(x => x.image_id === id); if (!target || id === after) return items;
  const rest = items.filter(x => x.image_id !== id); const index = after === null ? -1 : rest.findIndex(x => x.image_id === after);
  if (after !== null && index < 0) return items; rest.splice(index + 1, 0, target); return rest;
}
export function fitSize(w: number, h: number, max = 1600) { const scale = Math.min(1, max / Math.max(w, h)); return { width: Math.round(w * scale), height: Math.round(h * scale) }; }
export function validateCrop(c: { x: number; y: number; w: number; h: number }, width: number, height: number) { return Object.values(c).every(Number.isFinite) && c.x >= 0 && c.y >= 0 && c.w > 0 && c.h > 0 && c.x + c.w <= width + 1 && c.y + c.h <= height + 1; }
