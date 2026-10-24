import { useState } from "react";
import { LAGUNA_BASE_DATA } from "../../services/lagunaData";
import { FloodControls } from "./FloodControls";
import { MorbidityControls } from "./MorbidityControls";
import { RoadBlockageTool } from "./RoadBlockageTool";
export function ScenarioBuilder() {
  const [psgc, setPsgc] = useState(LAGUNA_BASE_DATA[0].psgc);
  return (
    <>
      <label className="workspace-field">
        Choose the municipality to change
        <select
          aria-label="Scenario municipality"
          value={psgc}
          onChange={(e) => setPsgc(e.target.value)}
        >
          {LAGUNA_BASE_DATA.map((m) => (
            <option value={m.psgc} key={m.psgc}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <p className="workspace-note">
        Try sample flooding or illness increases. Changing conditions restarts
        all three 30-day runs. These are practice conditions, not live alerts.
      </p>
      <FloodControls psgc={psgc} />
      <MorbidityControls psgc={psgc} />
      <RoadBlockageTool />
    </>
  );
}
