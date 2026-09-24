export function notificationContent(payload: Record<string, unknown>) {
  const type = payload.type;
  const body = type === 'warning' ? (payload.reason === 'device_offline' ? 'デバイスと通信できません。接続を確認してください。' : '長時間、反応がありません。ご家族の様子を確認してください。') : type === 'detection' ? '反応がありました。' : type === 'like' ? 'いいねが届きました。' : type === 'display_changed' ? '今日の写真が表示されました。' : '見守りの新しいお知らせがあります。';
  return { title: type === 'warning' ? '見守り · 確認が必要です' : '見守り', body, requireInteraction: type === 'warning', tag: typeof payload.id === 'string' ? payload.id : `${String(type ?? 'update')}-${String(payload.reason ?? '')}` };
}
