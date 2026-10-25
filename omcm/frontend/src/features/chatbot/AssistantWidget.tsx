import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { Bot, GripVertical, MessageCircle, RotateCcw, X } from "lucide-react";
import { useAssistantStore } from "../../store/useAssistantStore";
import { ChatbotPanel } from "./ChatbotPanel";
import "../../styles/assistant.css";

const STORAGE_KEY = "omcm_assistant_launcher_pos";

export function AssistantWidget() {
  const { open, busy, setOpen, clear } = useAssistantStore();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          return {
            x: Math.max(8, Math.min(window.innerWidth - 80, parsed.x)),
            y: Math.max(8, Math.min(window.innerHeight - 40, parsed.y)),
          };
        }
      } catch {
        // ignore storage errors
      }
      return null;
    },
  );
  const [isDragging, setIsDragging] = useState(false);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
    hasMoved: boolean;
  } | null>(null);
  const wasDraggingRef = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (
      open &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
    )
      returnFocus.current = document.activeElement;
  }, [open]);
  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (returnFocus.current?.isConnected && returnFocus.current.offsetWidth)
        returnFocus.current.focus();
      else launcherRef.current?.focus();
    });
  }, []);
  const closeAssistant = useCallback(() => {
    setOpen(false);
    restoreFocus();
  }, [setOpen, restoreFocus]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector("dialog[open]")
      )
        return;
      closeAssistant();
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open, closeAssistant]);

  // Keep launcher within viewport when window is resized
  useEffect(() => {
    if (!position) return;
    const handleResize = () => {
      const el = launcherRef.current;
      if (!el) return;
      const width = el.offsetWidth || 150;
      const height = el.offsetHeight || 44;
      const maxX = Math.max(8, window.innerWidth - width - 8);
      const maxY = Math.max(8, window.innerHeight - height - 8);
      setPosition((prev) => {
        if (!prev) return null;
        const clampedX = Math.max(8, Math.min(maxX, prev.x));
        const clampedY = Math.max(8, Math.min(maxY, prev.y));
        if (clampedX === prev.x && clampedY === prev.y) return prev;
        return { x: clampedX, y: clampedY };
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const el = launcherRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      hasMoved: false,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.startX;
      const dy = ev.clientY - dragStartRef.current.startY;

      if (!dragStartRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
        dragStartRef.current.hasMoved = true;
        wasDraggingRef.current = true;
        setIsDragging(true);
      }

      if (dragStartRef.current.hasMoved) {
        const currentEl = launcherRef.current;
        const width = currentEl?.offsetWidth ?? 150;
        const height = currentEl?.offsetHeight ?? 44;

        const rawX = dragStartRef.current.initialLeft + dx;
        const rawY = dragStartRef.current.initialTop + dy;

        const minX = 8;
        const maxX = Math.max(minX, window.innerWidth - width - 8);
        const minY = 8;
        const maxY = Math.max(minY, window.innerHeight - height - 8);

        const clampedX = Math.round(Math.max(minX, Math.min(maxX, rawX)));
        const clampedY = Math.round(Math.max(minY, Math.min(maxY, rawY)));

        setPosition({ x: clampedX, y: clampedY });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      if (dragStartRef.current?.hasMoved) {
        setPosition((pos) => {
          if (pos) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
            } catch {
              // ignore storage errors
            }
          }
          return pos;
        });
      }

      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setOpen(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPosition(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return open ? (
    <section className="assistant-widget" aria-label="OMCM assistant">
      <header className="assistant-widget-heading">
        <div>
          <Bot size={22} aria-hidden="true" />
          <div>
            <h2>OMCM assistant</h2>
            <span>Places, care and planning</span>
          </div>
        </div>
        <div>
          <button
            type="button"
            className="icon-button"
            aria-label="New assistant conversation"
            title="New conversation"
            disabled={busy}
            onClick={clear}
          >
            <RotateCcw size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close assistant"
            onClick={closeAssistant}
          >
            <X size={20} />
          </button>
        </div>
      </header>
      <ChatbotPanel />
    </section>
  ) : (
    <button
      ref={launcherRef}
      type="button"
      className={`assistant-launcher ${isDragging ? "is-dragging" : ""} ${position ? "is-positioned" : ""}`}
      aria-label="Open OMCM assistant (Drag to reposition)"
      title={
        position
          ? "Ask OMCM · Drag to reposition (double-click to reset)"
          : "Ask OMCM · Drag to reposition in free space"
      }
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
            }
          : undefined
      }
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <span
        className="assistant-launcher-drag-indicator"
        aria-hidden="true"
        title="Drag to reposition"
      >
        <GripVertical size={14} />
      </span>
      <MessageCircle size={18} aria-hidden="true" />
      <span>Ask OMCM{busy ? " · Working…" : ""}</span>
    </button>
  );
}
