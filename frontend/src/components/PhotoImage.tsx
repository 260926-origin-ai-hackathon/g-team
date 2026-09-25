import { useState } from 'react';
import { ImageOff } from 'lucide-react';

// Supplied reference photos are displayed through a crop window. The original
// approved images stay intact; this mapping is used only by the local demo.
const crops: Record<string, [string, number, number, number, number]> = {
  family: ['home', 43, 910, 769, 554],
  hat: ['gallery', 63, 439, 231, 251],
  park: ['gallery', 314, 439, 228, 251],
  sleep: ['gallery', 562, 439, 229, 251],
  drawing: ['gallery', 309, 977, 235, 247],
  flowers: ['gallery', 568, 977, 244, 247],
  grandma: ['gallery', 42, 1287, 244, 247],
  birthday: ['gallery', 309, 1287, 235, 247],
  beach: ['gallery', 568, 1287, 244, 247],
};

export function PhotoImage({ src, alt, className = '', lazy = false }: { src: string; alt: string; className?: string; lazy?: boolean }) {
  const [failed, setFailed] = useState(false);
  const crop = src === '/demo-photo/family' && className === 'history-thumb' ? ['gallery', 42, 977, 244, 247] as [string, number, number, number, number] : crops[src.replace('/demo-photo/', '')];
  if (failed) return <span className={`photo-image image-unavailable ${className}`} role="img" aria-label={`${alt}：読み込めませんでした`}><ImageOff /><span>写真を読み込めません</span></span>;
  if (crop) {
    const [sheet, x, y, w, h] = crop;
    return <span className={`photo-image reference-photo ${className}`} style={{ aspectRatio: `${w}/${h}` }}>
      <img src={`/reference/${sheet}.png`} alt={alt} loading={lazy ? 'lazy' : 'eager'} onError={() => setFailed(true)} style={{ width: `${853 / w * 100}%`, left: 0, top: 0, transform: `translate(${-x / 853 * 100}%, ${-y / 1844 * 100}%)` }} />
    </span>;
  }
  return <img className={`photo-image ${className}`} src={src} alt={alt} loading={lazy ? 'lazy' : 'eager'} onError={() => setFailed(true)} />;
}
