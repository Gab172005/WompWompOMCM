import type { Barangay, Weights } from "../types";
import {
  normalizeCode,
  normalizeName,
  type AreaMapping,
  type LagunaGeometry,
} from "./maps";

export interface Municipality extends Barangay {
  geography_level: "municipality";
  source_ids: string[];
  barangay_count: number;
  aggregated: boolean;
}

const round = (value: number) => Math.round(value * 100) / 100;
const levelOf = (score: number) =>
  score >= 70
    ? "Critical"
    : score >= 50
      ? "High"
      : score >= 30
        ? "Moderate"
        : "Low";

/** Totals describe available source records, never an inferred municipal census. */
export function aggregateMunicipalities(
  geometry: LagunaGeometry,
  records: Barangay[],
  aliases: AreaMapping = {},
): Municipality[] {
  const areas = new Map(
    geometry.features.map(({ properties }) => [properties.area_id, properties]),
  );
  const groups = new Map<string, Barangay[]>();
  const aliasesByRecord = new Map(
    Object.entries(aliases).map(([code, id]) => [id, normalizeCode(code)]),
  );
  for (const record of records) {
    const code = normalizeCode(
      record.psgc ?? aliasesByRecord.get(record.id) ?? record.id,
    );
    let areaId: string | undefined;
    if (/^\d+$/.test(code)) {
      if (/^4034\d{5}$/.test(code)) areaId = `${code.slice(0, 6)}000`;
    } else if (!/^demo\b/i.test(record.name)) {
      const name =
        record.geography_level === "municipality"
          ? record.name
          : record.municipality;
      if (name) {
        const matches = [...areas.values()].filter(
          (area) => normalizeName(area.name) === normalizeName(name),
        );
        if (matches.length === 1) areaId = matches[0].area_id;
      }
    }
    if (!areaId || !areas.has(areaId)) continue;
    groups.set(areaId, [...(groups.get(areaId) ?? []), record]);
  }
  const result: Municipality[] = [];
  for (const [areaId, group] of groups) {
    const area = areas.get(areaId)!;
    const direct = group.filter(
      (b) =>
        b.geography_level === "municipality" ||
        normalizeCode(b.psgc ?? aliasesByRecord.get(b.id) ?? b.id) === areaId,
    );
    // A supplied municipal total takes precedence; never add its children twice.
    if (direct.length > 1) continue;
    if (direct.length === 1) {
      result.push({
        ...direct[0],
        id: areaId,
        psgc: areaId,
        name: area.name,
        municipality: area.name,
        geography_level: "municipality",
        source_ids: [direct[0].id],
        barangay_count: 0,
        aggregated: false,
      });
      continue;
    }
    const identity = (b: Barangay) =>
      normalizeCode(b.psgc ?? aliasesByRecord.get(b.id) ?? b.id);
    const rows = group.filter(
      (row) => group.filter((b) => identity(b) === identity(row)).length === 1,
    );
    if (!rows.length) continue;
    const sum = (read: (b: Barangay) => number) =>
      rows.reduce((total, b) => total + read(b), 0);
    const mean = (read: (b: Barangay) => number | null | undefined) => {
      const valid = rows.filter(
        (b) => read(b) != null && Number.isFinite(read(b)),
      );
      const population = valid.reduce((total, b) => total + b.population, 0);
      if (!valid.length) return undefined;
      return round(
        valid.reduce(
          (total, b) => total + read(b)! * (population > 0 ? b.population : 1),
          0,
        ) / (population || valid.length),
      );
    };
    const factors = Object.fromEntries(
      Object.keys(rows[0].factors).map((key) => [
        key,
        mean((b) => b.factors[key as keyof Weights])!,
      ]),
    ) as Weights;
    const contributions = Object.fromEntries(
      Object.keys(rows[0].contributions).map((key) => [
        key,
        mean((b) => b.contributions[key as keyof Weights])!,
      ]),
    ) as Weights;
    const score = mean((b) => b.score)!;
    result.push({
      id: areaId,
      psgc: areaId,
      name: area.name,
      municipality: area.name,
      geography_level: "municipality",
      source_ids: rows.map((b) => b.id),
      barangay_count: rows.length,
      aggregated: true,
      population: sum((b) => b.population),
      demand: sum((b) => b.demand),
      vulnerable_residents: sum((b) => b.vulnerable_residents),
      lat: mean((b) => b.lat)!,
      lng: mean((b) => b.lng)!,
      children_pct: mean((b) => b.children_pct),
      elderly_pct: mean((b) => b.elderly_pct),
      disease_per_1000: mean((b) => b.disease_per_1000)!,
      factors,
      contributions,
      score,
      level: levelOf(score),
      high_priority: score >= 50,
      rank: 0,
      nearest_hospital:
        "Population-weighted hospital access across available records",
      hospital_minutes: rows.some((b) => b.hospital_minutes === null)
        ? null
        : (mean((b) => b.hospital_minutes) ?? null),
      explanation: `Population-weighted indicators from ${rows.length} available barangay records. Population and demand are summed over those records only; they may not cover the whole city or municipality.`,
      recommended_services: [
        ...new Set(rows.flatMap((b) => b.recommended_services)),
      ],
      warnings: [...new Set(rows.flatMap((b) => b.warnings))],
    });
  }
  return result
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((area, index) => ({ ...area, rank: index + 1 }));
}

export function coveredMunicipalities(
  records: Municipality[],
  sourceIds: string[],
) {
  const assigned = new Set(sourceIds.map(normalizeCode));
  return new Set(
    records
      .filter(
        (area) =>
          assigned.has(area.id) ||
          area.source_ids.some((id) => assigned.has(normalizeCode(id))),
      )
      .map((area) => area.id),
  );
}
