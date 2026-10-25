import {
  useEffect,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

/** Searchable location picker. The portal stays outside scrolling map sheets. */
export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Search barangay or municipality…",
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<CSSProperties>({
    position: "fixed",
    visibility: "hidden",
  });
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = normalize(query.trim());
  const filtered = normalizedQuery
    ? options.filter((option) =>
        normalize(
          `${option.label} ${option.description ?? ""} ${option.value}`,
        ).includes(normalizedQuery),
      )
    : options;
  const matches =
    !query && selected
      ? [
          selected,
          ...filtered.filter((option) => option.value !== value),
        ].slice(0, 50)
      : filtered.slice(0, 50);
  const expanded = open && !disabled;
  const enabled = matches.flatMap((option, index) =>
    option.disabled ? [] : [index],
  );
  const closePicker = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(-1);
  }, []);

  useLayoutEffect(() => {
    if (!expanded) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom =
        viewportTop + (viewport?.height ?? window.innerHeight);
      const anchorTop = Math.max(
        viewportTop + 12,
        Math.min(rect.top, viewportBottom - 12),
      );
      const anchorBottom = Math.max(
        viewportTop + 12,
        Math.min(rect.bottom, viewportBottom - 12),
      );
      const below = viewportBottom - anchorBottom - 12;
      const above = anchorTop - viewportTop - 12;
      const up = below < 220 && above > below;
      const height = Math.max(80, Math.min(340, up ? above : below));
      const width = Math.min(rect.width, window.innerWidth - 24);
      setPosition({
        position: "fixed",
        visibility: "visible",
        width,
        maxHeight: height,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        ...(up
          ? { bottom: window.innerHeight - anchorTop + 6 }
          : { top: anchorBottom + 6 }),
      });
    };
    place();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(place);
    if (anchor.current) observer?.observe(anchor.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (
        !anchor.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        closePicker();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded, closePicker]);

  useEffect(() => {
    if (expanded && active >= 0)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, expanded, id]);

  function choose(option: SelectOption) {
    if (option.disabled) return;
    if (option.value !== value) onChange(option.value);
    closePicker();
  }

  return (
    <div className="workspace-field searchable-select">
      <label htmlFor={id}>{label}</label>
      <div className="picker-anchor" ref={anchor}>
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            expanded && active >= 0 ? `${id}-option-${active}` : undefined
          }
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          title={
            selected
              ? `${selected.label}${selected.description ? ` · ${selected.description}` : ""}`
              : undefined
          }
          value={
            expanded
              ? query
              : selected
                ? `${selected.label}${selected.description ? ` · ${selected.description}` : ""}`
                : ""
          }
          onFocus={() => {
            setOpen(true);
            setActive(-1);
          }}
          onBlur={(event) => {
            if (!popup.current?.contains(event.relatedTarget)) closePicker();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closePicker();
              return;
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
              const current = enabled.indexOf(active);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? enabled.length - 1
                    : event.key === "ArrowDown"
                      ? (current + 1) % enabled.length
                      : (current <= 0 ? enabled.length : current) - 1;
              setActive(enabled[next] ?? -1);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (!expanded) {
                setOpen(true);
                setQuery("");
                return;
              }
              const option = matches[active >= 0 ? active : enabled[0]];
              if (option) choose(option);
            }
          }}
        />
        <ChevronDown
          className={expanded ? "is-open" : ""}
          size={16}
          aria-hidden="true"
        />
      </div>
      {expanded &&
        createPortal(
          <div ref={popup} className="workspace-picker" style={position}>
            <div className="picker-heading">
              <Search size={14} aria-hidden="true" />
              <span>Locations</span>
              <small role="status">{filtered.length} matches</small>
            </div>
            <div
              id={`${id}-list`}
              role="listbox"
              aria-label={`${label} options`}
              className="picker-options"
            >
              {matches.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  id={`${id}-option-${index}`}
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  data-active={active === index}
                  tabIndex={-1}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <MapPin size={17} aria-hidden="true" />
                  <span>
                    <strong>{option.label}</strong>
                    {option.description && <small>{option.description}</small>}
                    {option.disabled && (
                      <small>Unavailable for this clinic</small>
                    )}
                  </span>
                  {option.value === value && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </button>
              ))}
              {!matches.length && (
                <div className="picker-empty">
                  <MapPin size={22} aria-hidden="true" />
                  <strong>No matching locations</strong>
                  <span>Try a barangay or municipality name.</span>
                </div>
              )}
            </div>
            <div className="picker-footer">
              {filtered.length > 50 ? "Type to narrow the results · " : ""}↑ ↓
              to move · Enter to select · Esc to close
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
