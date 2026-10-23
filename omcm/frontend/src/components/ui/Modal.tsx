import { useEffect, useRef, type ReactNode } from "react";
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
      aria-labelledby="modal-title"
    >
      <div className="workspace-panel-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
      </div>
      <div className="workspace-panel-body">{children}</div>
    </dialog>
  );
}
