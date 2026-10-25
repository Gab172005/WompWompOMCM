import { useState } from "react";
import { Route, Search, X } from "lucide-react";
import type { Road } from "../../types";
import { DisclosureCard } from "../../components/ui/DisclosureCard";

export function RoadExclusions({
  roads,
  selected,
  onChange,
}: {
  roads: Road[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const matches = roads.filter((road) =>
    road.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const chosen = matches.filter((road) => selected.includes(road.id));
  const unselected = matches.filter((road) => !selected.includes(road.id));
  const shown = [...chosen, ...unselected.slice(0, limit)];
  return (
    <DisclosureCard
      title="Access restrictions"
      description="Keep selected connections out of your plan"
      icon={<Route size={18} />}
      badge={selected.length ? `${selected.length} excluded` : "Optional"}
    >
      <p className="map-evidence-note">
        These are estimated links between neighboring barangays, not verified
        road segments. Checked links are excluded from the plan.
      </p>
      <label className="workspace-field">
        Search connections
        <span className="map-inline-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Barangay or municipality"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(20);
            }}
          />
        </span>
      </label>
      <div className="access-results-heading">
        <span role="status">
          {shown.length} of {matches.length} connections
        </span>
        {selected.length > 0 && (
          <button
            className="workspace-text-button"
            type="button"
            onClick={() => onChange([])}
          >
            <X size={13} aria-hidden="true" /> Clear exclusions
          </button>
        )}
      </div>
      <div className="access-link-list">
        {shown.map((road) => (
          <label
            className={`access-link-row${selected.includes(road.id) ? " is-excluded" : ""}`}
            key={road.id}
          >
            <input
              type="checkbox"
              checked={selected.includes(road.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, road.id]
                    : selected.filter((id) => id !== road.id),
                )
              }
            />
            <span>
              <strong>{road.name.replace(/^Model link:\s*/, "")}</strong>
              <small>
                {selected.includes(road.id)
                  ? "Excluded from this plan"
                  : "Include in planning network"}
              </small>
            </span>
          </label>
        ))}
        {!shown.length && (
          <p className="map-empty-state">
            {roads.length
              ? "No connections found. Try another place name."
              : "Connections will appear when the planning service is available."}
          </p>
        )}
      </div>
      {unselected.length > limit && (
        <button
          className="workspace-text-button access-show-more"
          type="button"
          onClick={() => setLimit((value) => value + 20)}
        >
          Show 20 more connections
        </button>
      )}
    </DisclosureCard>
  );
}
