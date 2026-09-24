-- 警告の理由を保持する(Push を使わないため、子アプリは状態を取得して警告を表示する)
alter table devices add column if not exists warning_reason text null
  check (warning_reason in ('no_detection', 'device_offline', 'demo'));
