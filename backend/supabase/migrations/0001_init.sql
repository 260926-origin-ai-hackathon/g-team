create table devices (
  device_id text primary key,
  user_id text not null,
  current_image_id uuid null,
  display_seq int not null default 0,
  last_detected_at timestamptz null,
  last_seen_at timestamptz null,
  reset_hours int not null default 12,
  switch_time time not null default '00:00',
  last_switched_on date null,
  test_mode boolean not null default false,
  warned_at timestamptz null
);

create table images (
  image_id uuid primary key default gen_random_uuid(),
  device_id text not null references devices,
  original_path text not null,
  display_path text not null,
  crop_x int not null,
  crop_y int not null,
  crop_w int not null,
  crop_h int not null,
  sort_order double precision not null,
  status text not null default 'queued' check (status in ('queued','displayed','deleted')),
  displayed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table detections (
  detection_id uuid primary key default gen_random_uuid(),
  device_id text not null references devices,
  detected_at timestamptz not null,
  notified boolean not null
);

create table likes (
  like_id uuid primary key default gen_random_uuid(),
  device_id text not null references devices,
  image_id uuid null references images,
  liked_at timestamptz not null default now()
);

create table push_subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index on images (device_id, status, sort_order);
create index on detections (device_id, detected_at desc);

-- 非公開バケット(署名付きURLで配布)
insert into storage.buckets (id, name, public) values ('images', 'images', false)
on conflict (id) do nothing;

-- Data API の「Automatically expose new tables」を OFF にしている場合でも
-- サーバー(service_role)から使えるようにする
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
