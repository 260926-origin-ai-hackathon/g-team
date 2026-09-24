import { describe, it, expect } from 'vitest';
import { getActivity, relativeTime, reorderPhotos, fitSize, validateCrop } from '../src/lib/status';
const now = Date.parse('2026-09-25T12:00:00Z');
const status = { last_detected_at: '2026-09-25T11:55:00Z', last_seen_at: '2026-09-25T11:59:00Z', reset_hours: 12, test_mode: false, warned_at: null as string | null, warning_reason: null as string | null, is_offline: false };
describe('観測と通信の表示', () => {
  it('通信情報がなければ正常としない', () => expect(getActivity(null, status.last_detected_at, now).tone).toBe('unknown'));
  it('最近の反応と通信があれば観測済み', () => expect(getActivity(status, null, now).tone).toBe('normal'));
  it('サーバーの無反応警告を表示する', () => expect(getActivity({ ...status, warned_at: new Date(now).toISOString(), warning_reason: 'no_detection' }, null, now).tone).toBe('alert'));
  it('機器の通信断を異常と分ける', () => expect(getActivity({ ...status, is_offline: true }, null, now).tone).toBe('warning'));
  it('テスト中も経過時間だけで警告しない', () => expect(getActivity({ ...status, test_mode: true }, null, now).tone).toBe('normal'));
  it('デモ警告を実際の異常と誤認させない', () => expect(getActivity({ ...status, warned_at: new Date(now).toISOString(), warning_reason: 'demo' }, null, now).title).toContain('デモ'));
  it('通信断警告があれば接続復帰だけで消さない', () => expect(getActivity({ ...status, warned_at: new Date(now).toISOString(), warning_reason: 'device_offline' }, null, now).tone).toBe('warning'));
  it('未検知でも警告は優先する', () => expect(getActivity({ ...status, last_detected_at: null, warned_at: new Date(now).toISOString(), warning_reason: 'no_detection' }, null, now).tone).toBe('alert'));
  it('未来の時刻を現在の安心にしない', () => expect(getActivity({ ...status, last_detected_at: '2026-10-01T00:00:00Z' }, null, now).tone).toBe('unknown'));
  it('未検知は待機表示', () => expect(relativeTime(null, now)).toContain('記録がありません'));
});
describe('キューの操作', () => { const items = ['a', 'b', 'c'].map(image_id => ({ image_id })); it('先頭へ移動', () => expect(reorderPhotos(items, 'c', null).map(x => x.image_id)).toEqual(['c', 'a', 'b'])); it('末尾へ移動', () => expect(reorderPhotos(items, 'a', 'c').map(x => x.image_id)).toEqual(['b', 'c', 'a'])); it('不正な移動で写真を消さない', () => expect(reorderPhotos(items, 'a', 'missing')).toEqual(items)); it('入力配列を変更しない', () => { reorderPhotos(items, 'b', null); expect(items[0].image_id).toBe('a') }) });
describe('画像の寸法と範囲', () => { it('縦長を1600pxに制限', () => expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })); it('小さい画像を拡大しない', () => expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 })); it('範囲外・非数値は拒否', () => { expect(validateCrop({ x: 0, y: 0, w: 1600, h: 1200 }, 1600, 1200)).toBe(true); expect(validateCrop({ x: 1599, y: 0, w: 100, h: 75 }, 1600, 1200)).toBe(false); expect(validateCrop({ x: NaN, y: 0, w: 100, h: 75 }, 1600, 1200)).toBe(false) }) });
