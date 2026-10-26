import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
};

export default function Sheet({ open, onClose, closeLabel, labelledBy, className, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={className ? `sheet ${className}` : "sheet"}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sheet-inner">
        {children}
        <button ref={closeRef} className="close" onClick={onClose}>{closeLabel}</button>
      </div>
    </div>
  );
}
