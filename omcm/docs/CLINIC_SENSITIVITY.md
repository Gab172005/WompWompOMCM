# Clinic-weight sensitivity report

Generated offline from the committed browser bundle; model **barangay-healthcare-need-v3**.
OSM snapshot retrieved **2026-10-23T17:32:47.575509+00:00**, OSM database base **2026-10-23T17:31:38Z**.
These are policy assumptions, not fitted clinical coefficients. The alternative is a diagnostic only; it does not change production weights or either separate planner.

| Factor | Production | Alternative |
| --- | --- | --- |
| Synthetic morbidity | 25% | 20% |
| Hospital distance | 30% | 40% |
| Disaster risk | 15% | 15% |
| Population density | 10% | 5% |
| Municipality income class | 10% | 10% |
| Clinic distance | 5% | 5% |
| Clinic provision deficit | 5% | 5% |

## Rank stability across 681 barangays

- Top-25 overlap: **21/25 (84%)**.
- Median absolute competition-rank movement: **33** places.
- Maximum absolute competition-rank movement: **190** places.
- Provisional records: production **4**, alternative **4**.

Top 25 means exactly 25 records ordered by one-decimal score descending, municipality/name/PSGC tie-break. Shared displayed scores use competition ranks (1,2,2,4). Movement uses those ranks across all barangays, not just top-25 records. Null factors are excluded with available-weight rescaling under each weight set.

### Largest movement

- Barangay 6, Calamba (403405043): #221 → #411.

### Production top 25 compared with the alternative

| PSGC | Barangay | Municipality | Production score | Rank | Alternative score | Rank | Absolute movement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 403420008 | Kabulusan | Pakil | 85.4 | 1 | 87.5 | 1 | 0 |
| 403414007 | Paagahan | Mabitac | 80.1 | 2 | 82.1 | 2 | 0 |
| 403420002 | Banilan | Pakil | 80.0 | 3 | 81.8 | 4 | 1 |
| 403408017 | Mayatba | Famy | 79.0 | 4 | 80.2 | 6 | 2 |
| 403427026 | Tungkod | Santa Maria | 78.2 | 5 | 82.0 | 3 | 2 |
| 403427020 | Barangay II | Santa Maria | 76.3 | 6 | 75.0 | 15 | 9 |
| 403427023 | Jose Rizal | Santa Maria | 75.9 | 7 | 73.9 | 20 | 13 |
| 403420006 | Dorado | Pakil | 75.5 | 8 | 81.2 | 5 | 3 |
| 403422001 | Aplaya | Pila | 74.7 | 9 | 75.9 | 13 | 4 |
| 403420005 | Casinsin | Pakil | 72.8 | 10 | 78.9 | 7 | 3 |
| 403408019 | Salangbato | Famy | 72.1 | 11 | 71.2 | 32 | 21 |
| 403415005 | Balanac | Magdalena | 71.9 | 12 | 74.3 | 18 | 6 |
| 403410008 | Calumpang | Liliw | 71.8 | 13 | 76.6 | 10 | 3 |
| 403410025 | Luquin | Liliw | 71.4 | 14 | 77.6 | 8 | 6 |
| 403408013 | Kataypuanan | Famy | 71.3 | 15 | 77.4 | 9 | 6 |
| 403414005 | Nanguma | Mabitac | 71.3 | 15 | 71.1 | 33 | 18 |
| 403429012 | Llavac | Siniloan | 71.2 | 17 | 76.2 | 11 | 6 |
| 403417024 | Kanluran Lazaan | Nagcarlan | 71.1 | 18 | 75.3 | 14 | 4 |
| 403430003 | Masapang | Victoria | 70.7 | 19 | 72.8 | 22 | 3 |
| 403414006 | Numero | Mabitac | 70.1 | 20 | 74.4 | 17 | 3 |
| 403429015 | Magsaysay | Siniloan | 70.1 | 20 | 75.0 | 15 | 5 |
| 403414001 | Amuyong | Mabitac | 70.0 | 22 | 76.1 | 12 | 10 |
| 403408018 | Minayutan | Famy | 69.7 | 23 | 73.2 | 21 | 2 |
| 403414012 | Pag-asa | Mabitac | 69.6 | 24 | 65.6 | 59 | 35 |
| 403427022 | Barangay IV | Santa Maria | 69.5 | 25 | 69.3 | 41 | 16 |

## Interpretation

Hospital distance and clinic measures both proxy access and can overlap; changing their relative emphasis can change priorities even with identical source inputs. Clinic counts are OSM mapping observations, not verified absence or capacity. Straight-line distances are not travel times. Laguna-only scope can overstate access gaps at the provincial edge. Morbidity is synthetic, disaster screening coverage is unverified, and no result should be presented as a clinical or operational fact.

Reproduce from `omcm/frontend`: `node --experimental-strip-types scripts/clinic-sensitivity.mjs`; verify without writes using `--check`.
