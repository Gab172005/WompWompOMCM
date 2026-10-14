import { useOMCM } from "../services/store";
import { Card, NeedBadge, number, PageHeader } from "../components/ui";
import { RiskMap } from "../components/RiskMap";
export function Risk() {
  const { barangays } = useOMCM();
  return (
    <>
      <PageHeader
        eyebrow="COMMUNITY INTELLIGENCE"
        title="Healthcare risk map"
        description="Select a location for its need score, contributing factors, hospital access, and preventive services."
      />
      <Card className="full-map">
        <RiskMap showRoads />
      </Card>
      <Card>
        <div className="card-title">
          <h3>Barangay intelligence register</h3>
          <span className="badge">DEMO DATA</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank / Barangay</th>
                <th>Population</th>
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
