import { useState } from "react";
import type { Road } from "../../types";

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
  const matches = roads.filter((road) =>
    road.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const shown = matches.filter((road) => selected.includes(road.id));
  shown.push(...matches.filter((road) => !selected.includes(road.id)).slice(0, 20));
  return (
    <details className="place-disclosure">
      <summary>Model link exclusions ({selected.length} selected)</summary>
      <p className="workspace-note">
        These are estimated connections between neighboring barangays, not
        verified road segments. Search by barangay or municipality.
      </p>
      <label className="workspace-field">
        Find a model link
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <small>Showing {shown.length} of {matches.length} matching links</small>
      {shown.map((road) => (
        <label className="approval-checkbox" key={road.id}>
          <input
            type="checkbox"
            checked={selected.includes(road.id)}
            onChange={(event) =>
              onChange(event.target.checked
                ? [...selected, road.id]
                : selected.filter((id) => id !== road.id))
            }
          />
          Exclude {road.name}
        </label>
      ))}
    </details>
  );
}
