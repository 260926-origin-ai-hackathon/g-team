import type { SupabaseClient } from '@supabase/supabase-js';
import { switchDisplay } from './display';
import { sendPush } from './push';
import { isSwitchDue, OFFLINE_MS, resetMs } from './time';
import type { Bindings, Device } from './types';

export async function runCron(db: SupabaseClient, env: Bindings, now = new Date()): Promise<void> {
  const { data: devices } = await db.from('devices').select('*');
  for (const dev of (devices ?? []) as Device[]) {
    let cur = dev;
    // 表示切替
    if (isSwitchDue(now, cur.switch_time, cur.last_switched_on)) {
      await switchDisplay(db, env, cur, now);
      const { data } = await db.from('devices').select('*').eq('device_id', cur.device_id).single();
      cur = data as Device;
    }
    // 警告判定(warned_at で重複防止)
    if (cur.warned_at) continue;
    const t = now.getTime();
    let reason: 'no_detection' | 'device_offline' | null = null;
    if (cur.last_detected_at && t - new Date(cur.last_detected_at).getTime() >= resetMs(cur)) {
      reason = 'no_detection';
    } else if (cur.last_seen_at && t - new Date(cur.last_seen_at).getTime() >= OFFLINE_MS) {
      reason = 'device_offline';
    }
    if (reason) {
      await sendPush(db, env, cur.user_id, { type: 'warning', reason });
      await db.from('devices').update({ warned_at: now.toISOString(), warning_reason: reason }).eq('device_id', cur.device_id);
    }
  }
}
