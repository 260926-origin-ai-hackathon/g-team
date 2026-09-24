import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runCron } from './lib/cron';
import { switchDisplay } from './lib/display';
import { sendPush } from './lib/push';
import { computeSortOrder } from './lib/sort';
import { OFFLINE_MS, pollSec, resetMs } from './lib/time';
import type { Bindings, Device, ImageRow } from './lib/types';

type Vars = { db: SupabaseClient };
const app = new Hono<{ Bindings: Bindings; Variables: Vars }>();

const BUCKET = 'images';
const SIGN_SEC = 3600;

const makeDb = (env: Bindings) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

app.use('*', cors());

app.use('*', async (c, next) => {
  c.set('db', makeDb(c.env));
  try {
    await next();
  } catch (e) {
    // supabase-js は Error でないオブジェクトを投げるため、onError に渡るよう変換する
    if (e instanceof Error) throw e;
    const m = (e as { message?: string })?.message;
    throw new Error(m ?? JSON.stringify(e));
  }
});

app.onError((e, c) => {
  console.error(e);
  const detail = e instanceof Error ? e.message : JSON.stringify(e);
  return c.json({ error: 'internal_error', detail }, 500);
});

/** MVP: 未登録の device_id は固定 user_id で自動作成する */
async function getDevice(c: { env: Bindings; var: Vars }, deviceId: string): Promise<Device> {
  const db = c.var.db;
  const { data } = await db.from('devices').select('*').eq('device_id', deviceId).maybeSingle();
  if (data) return data as Device;
  const { data: created, error } = await db
    .from('devices')
    .upsert({ device_id: deviceId, user_id: c.env.DEFAULT_USER_ID }, { onConflict: 'device_id', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (created) return created as Device;
  const { data: again } = await db.from('devices').select('*').eq('device_id', deviceId).single();
  return again as Device;
}

async function sign(db: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, SIGN_SEC);
  if (error) throw error;
  return data.signedUrl;
}

const statusOf = (d: Device) => ({
  last_seen_at: d.last_seen_at,
  last_detected_at: d.last_detected_at,
  warned_at: d.warned_at,
  warning_reason: d.warning_reason,
  is_offline: !!d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() >= OFFLINE_MS,
});

const cropOf = (i: ImageRow) => ({ x: i.crop_x, y: i.crop_y, w: i.crop_w, h: i.crop_h });

// ① 画像投稿
app.post('/devices/:deviceId/images', async (c) => {
  const db = c.var.db;
  const dev = await getDevice(c, c.req.param('deviceId'));
  const form = await c.req.formData();
  const original = form.get('original');
  const display = form.get('display');
  const cropRaw = form.get('crop');
  if (!(original instanceof File) || !(display instanceof File) || typeof cropRaw !== 'string') {
    return c.json({ error: 'original, display, crop are required' }, 400);
  }
  let crop: { x: number; y: number; w: number; h: number };
  try {
    crop = JSON.parse(cropRaw);
  } catch {
    return c.json({ error: 'invalid crop' }, 400);
  }
  if (![crop?.x, crop?.y, crop?.w, crop?.h].every((n) => Number.isInteger(n))) {
    return c.json({ error: 'invalid crop' }, 400);
  }

  const imageId = crypto.randomUUID();
  const originalPath = `${dev.device_id}/${imageId}_original.jpg`;
  const displayPath = `${dev.device_id}/${imageId}_display.jpg`;
  const up = async (path: string, f: File) => {
    const { error } = await db.storage.from(BUCKET).upload(path, await f.arrayBuffer(), { contentType: 'image/jpeg' });
    if (error) throw error;
  };
  await up(originalPath, original);
  await up(displayPath, display);

  const { data: max } = await db
    .from('images')
    .select('sort_order')
    .eq('device_id', dev.device_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (max?.sort_order ?? 0) + 1.0;

  const { error } = await db.from('images').insert({
    image_id: imageId,
    device_id: dev.device_id,
    original_path: originalPath,
    display_path: displayPath,
    crop_x: crop.x,
    crop_y: crop.y,
    crop_w: crop.w,
    crop_h: crop.h,
    sort_order: sortOrder,
    status: 'queued',
  });
  if (error) throw error;
  const { count } = await db
    .from('images')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', dev.device_id)
    .eq('status', 'queued');
  return c.json({ image_id: imageId, sort_order: sortOrder, queued_count: count ?? 0 }, 201);
});

// ② 画像リスト取得
app.get('/devices/:deviceId/images', async (c) => {
  const db = c.var.db;
  const dev = await getDevice(c, c.req.param('deviceId'));
  const status = c.req.query('status') ?? 'all';
  let q = db.from('images').select('*').eq('device_id', dev.device_id).order('sort_order', { ascending: true });
  q = status === 'all' ? q.neq('status', 'deleted') : q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as ImageRow[];
  const images = await Promise.all(
    rows.map(async (i) => ({
      image_id: i.image_id,
      original_url: await sign(db, i.original_path),
      display_url: await sign(db, i.display_path),
      crop: cropOf(i),
      status: i.status,
      displayed_at: i.displayed_at,
      sort_order: i.sort_order,
      like_count: likeStat.get(i.image_id)?.n ?? 0,
      last_liked_at: likeStat.get(i.image_id)?.last ?? null,
    })),
  );
  const { count } = await db
    .from('images')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', dev.device_id)
    .eq('status', 'queued');
  const { data: likes } = await db.from('likes').select('image_id, liked_at').eq('device_id', dev.device_id);
  const likeStat = new Map<string, { n: number; last: string }>();
  for (const l of likes ?? []) {
    if (!l.image_id) continue;
    const cur = likeStat.get(l.image_id);
    likeStat.set(l.image_id, { n: (cur?.n ?? 0) + 1, last: cur && cur.last > l.liked_at ? cur.last : l.liked_at });
  }
  return c.json({
    ...statusOf(dev),
    current_image_id: dev.current_image_id,
    display_seq: dev.display_seq,
    queued_count: count ?? 0,
    last_detected_at: dev.last_detected_at,
    images,
  });
});

// ③ 並べ替え
app.patch('/devices/:deviceId/images/:imageId', async (c) => {
  const db = c.var.db;
  const dev = await getDevice(c, c.req.param('deviceId'));
  const imageId = c.req.param('imageId');
  const body = await c.req.json().catch(() => null);
  if (!body || !('after_image_id' in body)) return c.json({ error: 'after_image_id is required' }, 400);
  const afterId: string | null = body.after_image_id;

  const { data: target } = await db.from('images').select('*').eq('image_id', imageId).eq('device_id', dev.device_id).maybeSingle();
  if (!target || target.status === 'deleted') return c.json({ error: 'not found' }, 404);
  if (target.status === 'displayed') return c.json({ error: 'displayed image cannot be moved' }, 400);
  if (afterId === imageId) return c.json({ error: 'invalid after_image_id' }, 400);

  const { data: queued } = await db
    .from('images')
    .select('image_id, sort_order')
    .eq('device_id', dev.device_id)
    .eq('status', 'queued')
    .order('sort_order', { ascending: true });
  const items = queued ?? [];
  if (afterId !== null && !items.some((i) => i.image_id === afterId)) {
    return c.json({ error: 'after image must be a queued image' }, 400);
  }
  const res = computeSortOrder(items, imageId, afterId);
  if (res.rebalanced) {
    await Promise.all(res.rebalanced.map((r) => db.from('images').update({ sort_order: r.sort_order }).eq('image_id', r.image_id)));
    const me = res.rebalanced.find((r) => r.image_id === imageId)!;
    return c.json({ sort_order: me.sort_order });
  }
  const { error } = await db.from('images').update({ sort_order: res.value }).eq('image_id', imageId);
  if (error) throw error;
  return c.json({ sort_order: res.value });
});

// 画像の削除(論理削除)
app.delete('/devices/:deviceId/images/:imageId', async (c) => {
  const db = c.var.db;
  const dev = await getDevice(c, c.req.param('deviceId'));
  const { data: target } = await db.from('images').select('status').eq('image_id', c.req.param('imageId')).eq('device_id', dev.device_id).maybeSingle();
  if (!target || target.status === 'deleted') return c.json({ error: 'not found' }, 404);
  if (target.status === 'displayed') return c.json({ error: 'displayed image cannot be deleted' }, 400);
  await db.from('images').update({ status: 'deleted' }).eq('image_id', c.req.param('imageId'));
  return c.json({ ok: true });
});

const settingsOf = (d: Device) => ({
  test_mode: d.test_mode,
  switch_time: d.switch_time,
  reset_hours: d.reset_hours,
  poll_sec: pollSec(d.test_mode),
});

// ④ 設定変更
app.patch('/devices/:deviceId/settings', async (c) => {
  const db = c.var.db;
  const dev = await getDevice(c, c.req.param('deviceId'));
  const body = await c.req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if ('test_mode' in body) {
    if (typeof body.test_mode !== 'boolean') return c.json({ error: 'invalid test_mode' }, 400);
    patch.test_mode = body.test_mode;
  }
  if ('switch_time' in body) {
    if (typeof body.switch_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(body.switch_time)) {
      return c.json({ error: 'invalid switch_time' }, 400);
    }
    patch.switch_time = body.switch_time;
  }
  if (!Object.keys(patch).length) return c.json(settingsOf(dev));
  const { data, error } = await db.from('devices').update(patch).eq('device_id', dev.device_id).select().single();
  if (error) throw error;
  return c.json(settingsOf(data as Device));
});

// 子アプリのポーリング用: 死活・検知・警告の状態
app.get('/devices/:deviceId/status', async (c) => {
  const dev = await getDevice(c, c.req.param('deviceId'));
  return c.json({ ...statusOf(dev), ...settingsOf(dev), current_image_id: dev.current_image_id });
});

// 警告のデモ用発火(テストモードのボタン用)。次の検知(リセット後の初回)で自動解除される
app.post('/devices/:deviceId/warnings', async (c) => {
  const dev = await getDevice(c, c.req.param('deviceId'));
  const body = await c.req.json().catch(() => ({}));
  const reason = body?.reason ?? 'demo';
  if (!['demo', 'no_detection', 'device_offline'].includes(reason)) return c.json({ error: 'invalid reason' }, 400);
  const now = new Date().toISOString();
  await c.var.db.from('devices').update({ warned_at: now, warning_reason: reason }).eq('device_id', dev.device_id);
  return c.json({ ok: true, warned_at: now, warning_reason: reason });
});

// 警告の手動解除
app.delete('/devices/:deviceId/warnings', async (c) => {
  const dev = await getDevice(c, c.req.param('deviceId'));
  await c.var.db.from('devices').update({ warned_at: null, warning_reason: null }).eq('device_id', dev.device_id);
  return c.json({ ok: true });
});

// テスト用の即時切替(日次切替と同一関数)
app.post('/devices/:deviceId/display/advance', async (c) => {
  const dev = await getDevice(c, c.req.param('deviceId'));
  const r = await switchDisplay(c.var.db, c.env, dev, new Date());
  return c.json(r);
});

// Push購読の登録
app.post('/users/:userId/push-subscriptions', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.endpoint || !body?.keys) return c.json({ error: 'endpoint and keys are required' }, 400);
  const { error } = await c.var.db
    .from('push_subscriptions')
    .upsert({ user_id: c.req.param('userId'), endpoint: body.endpoint, keys: body.keys }, { onConflict: 'user_id,endpoint' });
  if (error) throw error;
  return c.json({ ok: true }, 201);
});

// ⑥ 通過検知
app.post('/devices/:deviceId/detections', async (c) => {
  const db = c.var.db;
  const dev = await getDevice(c, c.req.param('deviceId'));
  const body = await c.req.json().catch(() => ({}));
  // ハードは {} を送るため、未指定ならサーバー受信時刻を使う
  const at = body?.detected_at ? new Date(body.detected_at) : new Date();
  if (Number.isNaN(at.getTime())) return c.json({ error: 'invalid detected_at' }, 400);

  const first = !dev.last_detected_at || new Date(dev.last_detected_at).getTime() + resetMs(dev) <= at.getTime();
  await db.from('detections').insert({ device_id: dev.device_id, detected_at: at.toISOString(), notified: first });
  const patch: Record<string, unknown> = { last_detected_at: at.toISOString() };
  if (first) {
    patch.warned_at = null;
    patch.warning_reason = null;
  }
  await db.from('devices').update(patch).eq('device_id', dev.device_id);
  if (first) await sendPush(db, c.env, dev.user_id, { type: 'detection' });
  return c.json({ ok: true });
});

// ⑦ いいね
app.post('/devices/:deviceId/likes', async (c) => {
  const dev = await getDevice(c, c.req.param('deviceId'));
  const body = await c.req.json().catch(() => ({}));
  const { error } = await c.var.db
    .from('likes')
    .insert({ device_id: dev.device_id, image_id: body?.image_id ?? null, liked_at: new Date().toISOString() });
  if (error) throw error;
  return c.json({ ok: true });
});

// ⑧ ポーリング(ハートビート兼用)
app.get('/devices/:deviceId/display', async (c) => {
  const db = c.var.db;
  const dev = await getDevice(c, c.req.param('deviceId'));
  await db.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('device_id', dev.device_id);
  const next = pollSec(dev.test_mode);
  const current = c.req.query('current');
  if (!dev.current_image_id || dev.current_image_id === current) {
    return c.json({ changed: false, next_poll_sec: next });
  }
  const { data: img } = await db.from('images').select('display_path').eq('image_id', dev.current_image_id).single();
  return c.json({
    changed: true,
    image_id: dev.current_image_id,
    url: await sign(db, img!.display_path),
    next_poll_sec: next,
  });
});

export default {
  fetch: app.fetch,
  scheduled: (_e: ScheduledController, env: Bindings, ctx: ExecutionContext) => {
    ctx.waitUntil(runCron(makeDb(env), env));
  },
};
export { app };
