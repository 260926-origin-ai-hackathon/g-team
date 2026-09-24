import { describe, expect, it } from 'vitest';
import { computeSortOrder } from '../src/lib/sort';
import { isSwitchDue, jstParts } from '../src/lib/time';

const items = (...o: number[]) => o.map((s, i) => ({ image_id: `i${i}`, sort_order: s }));

describe('computeSortOrder', () => {
  it('先頭', () => expect(computeSortOrder(items(1, 2, 3), 'i2', null).value).toBe(0));
  it('末尾', () => expect(computeSortOrder(items(1, 2, 3), 'i0', 'i2').value).toBe(4));
  it('中間', () => expect(computeSortOrder(items(1, 2, 3), 'i2', 'i0').value).toBe(1.5));
  it('間隔が狭いと振り直し', () => {
    const r = computeSortOrder(items(1, 1.00001, 5), 'i2', 'i0');
    expect(r.rebalanced?.map((x) => x.image_id)).toEqual(['i0', 'i2', 'i1']);
    expect(r.rebalanced?.map((x) => x.sort_order)).toEqual([1, 2, 3]);
  });
});

describe('time', () => {
  it('JST変換', () => expect(jstParts(new Date('2026-09-24T16:00:00Z'))).toEqual({ date: '2026-09-25', time: '01:00:00' }));
  it('切替判定', () => {
    const now = new Date('2026-09-24T22:30:00Z'); // JST 07:30 9/25
    expect(isSwitchDue(now, '07:00:00', '2026-09-24')).toBe(true);
    expect(isSwitchDue(now, '07:00:00', '2026-09-25')).toBe(false);
    expect(isSwitchDue(now, '08:00', null)).toBe(false);
  });
});
