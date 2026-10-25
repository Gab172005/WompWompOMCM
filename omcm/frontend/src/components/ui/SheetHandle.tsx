import { useRef } from "react";

/** An explicit tap target and swipe surface; body scrolling stays native. */
export function SheetHandle({
  expanded,
  onExpand,
  onReduce,
}: {
  expanded: boolean;
  onExpand: () => void;
  onReduce: () => void;
}) {
  const start = useRef<number | null>(null);
  const moved = useRef(false);
  return (
    <button
      className="sheet-handle"
      type="button"
      aria-label="Resize map panel"
      aria-expanded={expanded}
      title="Tap to resize, or swipe up and down"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        start.current = event.clientY;
        moved.current = false;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (start.current === null) return;
        const distance = event.clientY - start.current;
        moved.current = Math.abs(distance) > 10;
        start.current = null;
        if (distance < -24) onExpand();
        else if (distance > 24) onReduce();
      }}
      onPointerCancel={() => {
        start.current = null;
        moved.current = true;
      }}
      onClick={() => {
        if (moved.current) {
          moved.current = false;
          return;
        }
        if (expanded) onReduce();
        else onExpand();
      }}
    >
      <span aria-hidden="true" />
    </button>
  );
}
