import type { Crop } from './types';
import { fitSize, validateCrop } from './status';
function jpeg(canvas: HTMLCanvasElement, quality: number) { return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('画像を変換できませんでした。別の写真でお試しください。')), 'image/jpeg', quality)); }
export async function loadImage(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try { const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' }); return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() } } catch {
    const url = URL.createObjectURL(blob); const img = new Image(); img.src = url; try { await img.decode(); return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) } } catch { URL.revokeObjectURL(url); throw Error('この画像形式を読み込めません。JPEGまたはPNGでお試しください。'); }
}
}
export async function prepareOriginal(file: Blob) {
  if (file.size > 30 * 1024 * 1024) throw Error('30MB以下の写真を選んでください。');
  const image = await loadImage(file); try { const size = fitSize(image.width, image.height); const canvas = document.createElement('canvas'); Object.assign(canvas, size); const ctx = canvas.getContext('2d'); if (!ctx) throw Error('画像処理を開始できません'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size.width, size.height); ctx.drawImage(image.source, 0, 0, size.width, size.height); return await jpeg(canvas, .85) } finally { image.close() }
}
export async function cropDisplay(original: Blob, crop: Crop) { const image = await loadImage(original); try { if (!validateCrop(crop, image.width, image.height)) throw Error('切り取り範囲を確認してください。'); const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240; const ctx = canvas.getContext('2d'); if (!ctx) throw Error('画像処理を開始できません'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 320, 240); ctx.drawImage(image.source, crop.x, crop.y, crop.w, crop.h, 0, 0, 320, 240); return await jpeg(canvas, .8) } finally { image.close() } }
