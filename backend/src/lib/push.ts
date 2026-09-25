import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Bindings } from './types';

export type PushMessage =
  | { type: 'detection' }
  | { type: 'display_changed'; image_id: string }
  | { type: 'warning'; reason: 'no_detection' | 'device_offline' };

/** user_id の全購読へ送る。失敗しても呼び出し元は止めない。無効な購読(404/410)は削除。 */
export async function sendPush(db: SupabaseClient, env: Bindings, userId: string, msg: PushMessage): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', userId);
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        const payload = await buildPushPayload(
          { data: JSON.stringify(msg) },
          { endpoint: s.endpoint, expirationTime: null, keys: s.keys },
          vapid,
        );
        const res = await fetch(s.endpoint, payload);
        if (res.status === 404 || res.status === 410) {
          await db.from('push_subscriptions').delete().eq('subscription_id', s.subscription_id);
        }
      } catch (e) {
        console.error('push failed', e);
      }
    }),
  );
}
