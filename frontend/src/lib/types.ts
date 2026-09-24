export interface Crop { x: number; y: number; w: number; h: number }
export interface Photo { image_id: string; original_url: string; display_url: string; crop: Crop; status: 'queued' | 'displayed' | 'deleted'; displayed_at: string | null; sort_order: number; liked_at?: string | null }
export interface ImageList { current_image_id: string | null; display_seq: number; queued_count: number; last_detected_at: string | null; images: Photo[] }
export interface Status { last_detected_at: string | null; last_seen_at: string | null; reset_hours: number; test_mode: boolean }
export interface Settings { switch_time: string; test_mode: boolean }
export interface Upload { original: Blob; display: Blob; crop: Crop }
export interface Api { images(): Promise<ImageList>; status(): Promise<Status | null>; settings(): Promise<Settings | null>; upload(data: Upload): Promise<unknown>; reorder(id: string, after: string | null): Promise<unknown>; remove(id: string): Promise<unknown>; recrop(id: string, display: Blob, crop: Crop): Promise<unknown>; updateSettings(data: Partial<Settings>): Promise<Settings>; advance(): Promise<unknown>; subscribe(data: PushSubscriptionJSON): Promise<unknown> }
