export type SortItem = { image_id: string; sort_order: number };

export const MIN_GAP = 0.0001;

export type SortResult = {
  value: number;
  /** 振り直しが必要な場合、新しい並び順(1.0刻み)の全件 */
  rebalanced: SortItem[] | null;
};

/**
 * items: 移動対象を含む、並べ替え可能な画像(sort_order昇順)
 * afterId: この直後に置く画像。null なら先頭
 */
export function computeSortOrder(items: SortItem[], movingId: string, afterId: string | null): SortResult {
  const others = items.filter((i) => i.image_id !== movingId);
  let value: number;
  let insertIndex: number;

  if (afterId === null) {
    insertIndex = 0;
    value = others.length ? others[0].sort_order - 1.0 : 1.0;
  } else {
    const idx = others.findIndex((i) => i.image_id === afterId);
    if (idx < 0) throw new Error('after image not found');
    insertIndex = idx + 1;
    const after = others[idx];
    const next = others[idx + 1];
    value = next ? (after.sort_order + next.sort_order) / 2 : after.sort_order + 1.0;
    if (next && next.sort_order - after.sort_order < MIN_GAP) {
      return { value, rebalanced: rebalance(others, movingId, insertIndex) };
    }
  }
  return { value, rebalanced: null };
}

function rebalance(others: SortItem[], movingId: string, insertIndex: number): SortItem[] {
  const ids = others.map((i) => i.image_id);
  ids.splice(insertIndex, 0, movingId);
  return ids.map((image_id, i) => ({ image_id, sort_order: i + 1.0 }));
}
