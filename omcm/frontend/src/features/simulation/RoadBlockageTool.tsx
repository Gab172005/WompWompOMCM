import { LAGUNA_DISRUPTIONS } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
export function RoadBlockageTool() {
  const { scenario, toggleRoad } = useAppStore();
  return (
    <fieldset className="workspace-subcard">
      <legend>Road disruptions</legend>
      {LAGUNA_DISRUPTIONS.map((d) => (
        <label className="workspace-checkbox" key={d.id}>
          <input
            type="checkbox"
            checked={scenario.closedRoadIds.includes(d.id)}
            onChange={() => toggleRoad(d.id)}
          />
          <span>
            {d.name}
            <small>{d.corridor}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
