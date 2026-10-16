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
        eyebrow="COMMUNITY INTELLIGENCE"
        title="Healthcare risk map"
        description="Select a city or municipality for population-weighted healthcare need, contributing factors, and available services."
      />
      <Card className="full-map">
        <MapView showRoads />
      </Card>
      <Card>
        <div className="card-title">
          <h3>City / municipality intelligence register</h3>
          <span className="badge">DEMO DATA</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank / City or municipality</th>
                <th>Represented population</th>
                <th>Disease / 1,000</th>
                <th>Vulnerability</th>
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
                      ? "Unreachable"
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
