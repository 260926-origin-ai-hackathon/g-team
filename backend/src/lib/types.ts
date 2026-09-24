export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  DEFAULT_DEVICE_ID: string;
  DEFAULT_USER_ID: string;
};

export type Device = {
  device_id: string;
  user_id: string;
  current_image_id: string | null;
  display_seq: number;
  last_detected_at: string | null;
  last_seen_at: string | null;
  reset_hours: number;
  switch_time: string;
  last_switched_on: string | null;
  test_mode: boolean;
  warned_at: string | null;
  warning_reason: 'no_detection' | 'device_offline' | 'demo' | null;
};

export type ImageRow = {
  image_id: string;
  device_id: string;
  original_path: string;
  display_path: string;
  crop_x: number;
  crop_y: number;
  crop_w: number;
  crop_h: number;
  sort_order: number;
  status: 'queued' | 'displayed' | 'deleted';
  displayed_at: string | null;
  created_at: string;
};
