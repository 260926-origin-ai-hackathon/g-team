import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      clearTimeout(timer.current);
      dialog?.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  function close() {
    if (busy || closing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    setClosing(true);
    timer.current = setTimeout(onClose, 140);
  }
  return <dialog ref={ref} className={`dialog ${closing ? 'closing' : ''}`} onCancel={e => { e.preventDefault(); close() }} aria-labelledby="dialog-title" aria-busy={busy}>
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="閉じる" disabled={busy || closing} onClick={close}><X size={22} /></button></div>
    {children}
  </dialog>;
}
