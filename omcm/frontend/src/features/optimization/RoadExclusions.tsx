import { useState } from "react";
import { ArrowLeftRight, Route, Search, X } from "lucide-react";
import type { Road } from "../../types";
import { DisclosureCard } from "../../components/ui/DisclosureCard";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
function connectionLabel(name: string) {
  const endpoints = name
    .replace(/^Model link:\s*/, "")
    .split(" / ")
    .map((place) => {
      const separator = place.lastIndexOf(", ");
      return separator < 0
        ? { name: place, town: "" }
        : { name: place.slice(0, separator), town: place.slice(separator + 2) };
    });
  return {
    endpoints,
    towns: [
      ...new Set(endpoints.map((place) => place.town).filter(Boolean)),
    ].join(" · "),
  };
}

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
  const [onlyExcluded, setOnlyExcluded] = useState(false);
  const selectedIds = new Set(selected);
  const matches = roads.filter(
    (road) =>
      normalize(road.name).includes(normalize(query)) &&
      (!onlyExcluded || selectedIds.has(road.id)),
  );
  const chosen = matches.filter((road) => selectedIds.has(road.id));
  const unselected = matches.filter((road) => !selectedIds.has(road.id));
  const shown = [...chosen, ...unselected.slice(0, limit)];
  return (
    <DisclosureCard
      title="Access restrictions"
      description="Choose connections to leave out of your plan"
      icon={<Route size={18} />}
      badge={selected.length ? `${selected.length} excluded` : "Optional"}
    >
      <p className="access-explanation">
        Check a connection to exclude it. These are modeled barangay links, not
        verified road segments.
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
      <div
        className="access-filter-row"
        role="group"
        aria-label="Connection filter"
      >
        <button
          type="button"
          aria-pressed={!onlyExcluded}
          onClick={() => setOnlyExcluded(false)}
        >
          All connections
        </button>
        <button
          type="button"
          aria-pressed={onlyExcluded}
          onClick={() => setOnlyExcluded(true)}
        >
          Excluded <span>{selected.length}</span>
        </button>
      </div>
      <div className="access-results-heading">
        <span role="status">
          {shown.length} of {matches.length} connections
        </span>
        {selected.length > 0 && (
          <button
            className="workspace-text-button"
            type="button"
            onClick={() => {
              onChange([]);
              setOnlyExcluded(false);
            }}
          >
            <X size={13} aria-hidden="true" />
            Clear exclusions
          </button>
        )}
      </div>
      <div className="access-link-list">
        {shown.map((road) => {
          const label = connectionLabel(road.name);
          const excluded = selectedIds.has(road.id);
          return (
            <label
              className={`access-link-row${excluded ? " is-excluded" : ""}`}
              key={road.id}
            >
              <input
                type="checkbox"
                aria-label={`Exclude ${road.name.replace(/^Model link:\s*/, "")}`}
                checked={excluded}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, road.id]
                      : selected.filter((id) => id !== road.id),
                  )
                }
              />
              <span className="access-connection-copy">
                <strong>
                  {label.endpoints.map((place, index) => (
                    <span key={index}>
                      {index > 0 && (
                        <ArrowLeftRight size={12} aria-hidden="true" />
                      )}
                      {place.name}
                    </span>
                  ))}
                </strong>
                <small>
                  {excluded
                    ? "Excluded from this plan"
                    : label.towns || "Modeled connection"}
                </small>
              </span>
            </label>
          );
        })}
        {!shown.length && (
          <p className="map-empty-state">
            {onlyExcluded
              ? "No excluded connections match. Choose All connections to browse the network."
              : roads.length
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
