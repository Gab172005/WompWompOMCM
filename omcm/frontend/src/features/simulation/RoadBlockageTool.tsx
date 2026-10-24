import { LAGUNA_DISRUPTIONS } from "../../services/lagunaData";
import { useAppStore } from "../../store/useAppStore";
export function RoadBlockageTool() {
  const { scenario, toggleRoad } = useAppStore();
  return (
    <fieldset className="workspace-subcard">
      <legend>Road disruptions</legend>
      <p className="workspace-note">
        Mark roads for reference. In the 30-day simulation, these marks do not
        change clinic reach or calculate travel access.
      </p>
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
