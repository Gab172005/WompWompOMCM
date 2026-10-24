import { FilterControls } from "../../features/filters/FilterControls";
import { useEffect, useId, useRef, useState } from "react";
import { Layers, X } from "lucide-react";
export function FloatingControls() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="map-layers" ref={container}>
      {open && (
        <section
          className="workspace-filters card"
          id={id}
          aria-label="Map filters"
        >
          <div className="map-layers-heading">
            <strong>Map details</strong>
            <button
              className="map-icon-button"
              aria-label="Close map filters"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <FilterControls />
        </section>
      )}
      <button
        ref={toggle}
        className="map-layers-button"
        aria-label="Map layers"
        title="Choose map colors and show hospitals or clinics"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <Layers size={24} aria-hidden="true" />
        <span>Map details</span>
      </button>
    </div>
  );
}
