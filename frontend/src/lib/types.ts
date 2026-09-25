export interface Crop { x: number; y: number; w: number; h: number }
export interface Photo { image_id: string; original_url: string; display_url: string; crop: Crop; status: 'queued' | 'displayed' | 'deleted'; displayed_at: string | null; sort_order: number; like_count?: number; last_liked_at?: string | null }
export interface ImageList { current_image_id: string | null; display_seq: number; queued_count: number; last_detected_at: string | null; images: Photo[] }
export interface Status { last_detected_at: string | null; last_seen_at: string | null; reset_hours: number; test_mode: boolean; warned_at: string | null; warning_reason: string | null; is_offline: boolean; poll_sec?: number }
export interface Settings { switch_time: string; test_mode: boolean }
export interface Upload { original: Blob; display: Blob; crop: Crop }
export interface Api { images(): Promise<ImageList>; status(): Promise<Status | null>; settings(): Promise<Settings | null>; upload(data: Upload): Promise<unknown>; reorder(id: string, after: string | null): Promise<unknown>; remove(id: string): Promise<unknown>; updateSettings(data: Partial<Settings>): Promise<Settings>; advance(): Promise<unknown>; setWarning(): Promise<unknown>; clearWarning(): Promise<unknown>; }
