"""Reproducible synthetic inputs, never official barangay or health records."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).parent


def generate():
    rows = []
    labels = ["Lakeside", "Northfield", "Riverside", "Hillcrest", "Eastwood", "Westhaven", "Greenfield", "Brookside", "Sampaguita", "Mabuhay", "Maligaya", "Bagong Silang", "San Isidro", "Pag-asa", "Masaya", "Dapdap", "Maharlika", "Silangan", "Tahanan", "Pulong"]
    for i, name in enumerate(labels):
        row, col = divmod(i, 5)
        population = 3400 + (i * 1777) % 9700
        rows.append(dict(id=f"B{i+1:02}", name=f"Demo {name}", population=population,
                         children=round(population * (0.18 + (i % 4) * .055)),
                         elderly=round(population * (.06 + (i % 5) * .025)),
                         disease_cases=round(population * (.012 + ((i * 7) % 15) * .006)),
                         poverty_pct=15 + (i * 13) % 60, flood_exposure=(i * 19 + 20) % 101,
                         lat=14.27 - row * .035, lng=121.12 + col * .043,
                         demand_rate=.03 + (i % 4) * .005, estimated=True))
    with (ROOT / "barangays.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    roads = []
    for i in range(20):
        row, col = divmod(i, 5)
        for j in ([i+1] if col < 4 else []) + ([i+5] if row < 3 else []):
            # Two bridges connect the eastern sector; closing both isolates it.
            if j == i+1 and col == 2 and row in (1, 2):
                continue
            roads.append(dict(id=f"R{i+1:02}-{j+1:02}", source=f"B{i+1:02}", target=f"B{j+1:02}",
                              minutes=5 + (i+j) % 8, name=f"Demo road {i+1}–{j+1}"))
    sites = [dict(id=f"S{k+1:02}", barangay_id=f"B{i+1:02}", name=f"{labels[i]} community hub", capacity=180, eligible=True)
             for k, i in enumerate([0, 2, 4, 6, 9, 11, 15, 18])]
    hospitals = [dict(id=f"H{k+1}", barangay_id=f"B{i+1:02}", name=f"Demo {labels[i]} hospital", lat=rows[i]["lat"], lng=rows[i]["lng"], services=["Primary care", "Emergency assessment"])
                 for k, i in enumerate([0, 12, 19])]
    (ROOT / "network.json").write_text(json.dumps(dict(roads=roads, sites=sites, hospitals=hospitals), indent=2), encoding="utf-8")
    (ROOT / "metadata.json").write_text(json.dumps(dict(synthetic=True, region="Laguna pilot", generated_at="2026-10-14", source="Deterministic OMCM demonstration generator", travel_times="Synthetic network estimates; not live traffic", disease="Synthetic case counts; not clinical predictions"), indent=2), encoding="utf-8")


if __name__ == "__main__":
    generate()
