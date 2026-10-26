import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Native keyboard interaction, with the same information hierarchy in every tool. */
export function DisclosureCard({
  title,
  description,
  icon,
  badge,
  compact = false,
  className = "",
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const descriptionId = useId();
  return (
    <details
      className={`map-disclosure${compact ? " is-compact" : ""} ${className}`}
    >
      <summary aria-label={title} aria-describedby={descriptionId}>
        <span className="map-disclosure-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="map-disclosure-copy">
          <strong>{title}</strong>
          <small id={descriptionId}>
            {description}
            {badge && <span className="sr-only"> · {badge}</span>}
          </small>
        </span>
        {badge && (
          <span className="map-disclosure-badge" aria-hidden="true">
            {badge}
          </span>
        )}
        <ChevronDown
          className="map-disclosure-chevron"
          size={17}
          aria-hidden="true"
        />
      </summary>
      <div className="map-disclosure-body">{children}</div>
    </details>
  );
}
