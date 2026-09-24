import { api, isDemo, vapidKey } from './api';
export function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) }
export function standalone() { return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true }
export function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window }
export async function subscribePush() {
  if (isDemo) throw Error('画面デモでは通知を送信しません。');
  if (isIOS() && !standalone()) throw Error('先にSafariの共有メニューからホーム画面に追加してください。');
  if (!pushSupported()) throw Error('このブラウザでは通知を利用できません。');
  if (!vapidKey) throw Error('通知の公開鍵が未設定です。');
  const permission = await Notification.requestPermission(); if (permission !== 'granted') throw Error(permission === 'denied' ? '通知がブロックされています。端末の設定で許可してください。' : '通知の許可は保留されました。');
  const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(Error('通知の準備ができていません。公開版で再度お試しください。')), 10000))]);
  const raw = atob(vapidKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(vapidKey.length / 4) * 4, '='));
  const key = Uint8Array.from(raw, c => c.charCodeAt(0));
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.subscribe(subscription.toJSON());
}
