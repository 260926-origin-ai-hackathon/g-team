import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_API_MODE', 'live'); vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test'); vi.stubEnv('VITE_DEVICE_ID', 'device-001'); vi.stubEnv('VITE_USER_ID', 'user-001'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('確定したAPI契約', () => {
  it('状態と設定はstatusから取得し、親のheartbeatを更新しない', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ test_mode: false, switch_time: '00:00', warned_at: null })))); vi.stubGlobal('fetch', fetch);
    const { api } = await import('../src/lib/api'); await api.status(); await api.settings();
    expect(fetch.mock.calls.map(call => call[0])).toEqual(Array(2).fill('https://api.example.test/devices/device-001/status'));
  });
  it('署名付きURLといいね情報をキャッシュせず取得する', async () => {
    const payload = { images: [{ image_id: 'a', like_count: 2, last_liked_at: '2026-09-25T00:00:00Z' }] };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))); vi.stubGlobal('fetch', fetch);
    const { api } = await import('../src/lib/api'); expect(await api.images()).toEqual(payload);
    expect(fetch.mock.calls[0][1].cache).toBe('no-store');
  });
  it('サーバー500をデモや空リストで隠さない', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'internal_error', detail: 'server detail' }), { status: 500 })));
    const { api } = await import('../src/lib/api'); await expect(api.images()).rejects.toThrow('500 / internal_error');
  });
  it('デモ警告の発火・解除を正しいAPIへ送る', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{"ok":true}'))); vi.stubGlobal('fetch', fetch);
    const { api } = await import('../src/lib/api'); await api.setWarning(); await api.clearWarning();
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/devices/device-001/warnings');
    expect(fetch.mock.calls[0][1].method).toBe('POST'); expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ reason: 'demo' });
    expect(fetch.mock.calls[1][0]).toBe(fetch.mock.calls[0][0]); expect(fetch.mock.calls[1][1].method).toBe('DELETE');
  });
  it('写真をoriginal/display/cropのmultipartで投稿する', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 201 })); vi.stubGlobal('fetch', fetch);
    const { api } = await import('../src/lib/api'); const crop = { x: 0, y: 0, w: 400, h: 300 };
    await api.upload({ original: new Blob(['original']), display: new Blob(['display']), crop });
    const request = fetch.mock.calls[0][1]; expect(request.method).toBe('POST'); expect(request.body.get('crop')).toBe(JSON.stringify(crop)); expect(request.body.get('original')).toBeInstanceOf(Blob); expect(request.body.get('display')).toBeInstanceOf(Blob); expect(request.headers.has('Content-Type')).toBe(false);
  });
});
