import { useId, useState, type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  hint: string;
  hintSide?: "below-start" | "below-end" | "left";
};

/** Icon hints support pointer and keyboard use without opening on touch. */
export function MapActionButton({
  hint,
  hintSide = "below-end",
  children,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
  onPointerEnter,
  onPointerLeave,
  className = "",
  ...props
}: Props) {
  const [showHint, setShowHint] = useState(false);
  const hintId = useId();
  return (
    <button
      type="button"
      {...props}
      className={`map-action-button ${className}`}
      aria-describedby={showHint ? hintId : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setShowHint(true);
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        setShowHint(false);
        onPointerLeave?.(event);
      }}
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) setShowHint(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setShowHint(false);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "Escape" && showHint && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          setShowHint(false);
        }
      }}
      onClick={(event) => {
        setShowHint(false);
        onClick?.(event);
      }}
    >
      {children}
      {showHint && (
        <span
          id={hintId}
          role="tooltip"
          className={`map-action-hint is-${hintSide}`}
        >
          {hint}
        </span>
      )}
    </button>
  );
}
