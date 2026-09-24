import type { SupabaseClient } from '@supabase/supabase-js';
import { jstParts } from './time';
import { sendPush } from './push';
import type { Bindings, Device } from './types';

/**
 * 表示切替。日次Cronと /display/advance の両方がこの関数を呼ぶ。
 * queued の先頭を displayed にし、devices を更新する。
 */
export async function switchDisplay(db: SupabaseClient, env: Bindings, dev: Device, now: Date): Promise<{ switched: boolean; image_id: string | null }> {
  const today = jstParts(now).date;
  const { data: next } = await db
    .from('images')
    .select('image_id')
    .eq('device_id', dev.device_id)
    .eq('status', 'queued')
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!next) {
    await db.from('devices').update({ last_switched_on: today }).eq('device_id', dev.device_id);
    return { switched: false, image_id: null };
  }
  await db.from('images').update({ status: 'displayed', displayed_at: now.toISOString() }).eq('image_id', next.image_id);
  await db
    .from('devices')
    .update({ current_image_id: next.image_id, display_seq: dev.display_seq + 1, last_switched_on: today })
    .eq('device_id', dev.device_id);
  await sendPush(db, env, dev.user_id, { type: 'display_changed', image_id: next.image_id });
  return { switched: true, image_id: next.image_id };
}
