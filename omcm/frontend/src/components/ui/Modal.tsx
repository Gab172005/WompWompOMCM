import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (dialog) {
      if (typeof dialog.showModal === "function") {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      } else {
        dialog.setAttribute("open", "");
      }
    }
    return () => {
      if (dialog) {
        if (typeof dialog.close === "function") {
          try {
            dialog.close();
          } catch {
            dialog.removeAttribute("open");
          }
        } else {
          dialog.removeAttribute("open");
        }
      }
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="workspace-modal card"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
    >
      <div className="workspace-panel-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="workspace-panel-body">{children}</div>
    </dialog>
  );
}
