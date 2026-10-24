import { useOMCM } from "../../store/LegacyProvider";
import {
  Card,
  NeedBadge,
  number,
  PageHeader,
} from "../../components/ui/LegacyUI";
import { MapView } from "../map/components/MapView";
export function Risk() {
  const { municipalities: barangays } = useOMCM();
  return (
    <>
      <PageHeader
        eyebrow="COMMUNITY HEALTHCARE PLANNING"
        title="Healthcare needs map"
        description="Select a city or municipality for average healthcare need based on population, contributing factors, and available services."
      />
      <Card className="full-map">
        <MapView showRoads />
      </Card>
      <Card>
        <div className="card-title">
          <h3>Compare cities and municipalities</h3>
          <span className="badge">DEMO DATA</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank / City or municipality</th>
                <th>Residents in this dataset</th>
                <th>Sample illness cases per 1,000</th>
                <th>Need for extra support / 100 (sample)</th>
                <th>Hospital travel</th>
                <th>Need</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {barangays.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="tiny">#{b.rank} </span>
                    {b.name}
                  </td>
                  <td>{number(b.population)}</td>
                  <td>{b.disease_per_1000}</td>
                  <td>{b.factors.vulnerability.toFixed(0)}/100</td>
                  <td>
                    {b.hospital_minutes === null
                      ? "No route available in this model"
                      : `${b.hospital_minutes} min`}
                  </td>
                  <td>
                    <strong>{b.score}</strong>
                  </td>
                  <td>
                    <NeedBadge level={b.level} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
