# Clinic-weight sensitivity report

Generated offline from the bundled browser dataset; model **barangay-healthcare-need-v4-balanced**.
OSM snapshot retrieved **2026-10-23T17:32:47.575509+00:00**, OSM database base **2026-10-23T17:31:38Z**.
These are policy assumptions, not fitted clinical coefficients. The alternative is a diagnostic only; it does not change production weights or the active planners.

| Factor | Production | Alternative |
| --- | --- | --- |
| Illness rate (sample data) | 35% | 30% |
| Distance to a hospital | 30% | 40% |
| People per square kilometre | 15% | 10% |
| Municipal resources (income class) | 10% | 10% |
| Distance to a mapped clinic | 5% | 5% |
| Fewer mapped clinics per resident | 5% | 5% |

## Rank stability across 681 barangays

- Top-25 overlap: **21/25 (84%)**.
- Median absolute competition-rank movement: **36** places.
- Maximum absolute competition-rank movement: **196** places.
- Provisional records: production **0**, alternative **0**.

Top 25 means exactly 25 records ordered by one-decimal score descending, municipality/name/PSGC tie-break. Shared displayed scores use competition ranks (1,2,2,4). Movement uses those ranks across all barangays, not just top-25 records. Null factors are excluded with available-weight rescaling under each weight set.

### Largest movement

- Mataling-ting, Santa Maria (403427015): #459 → #263.

### Production top 25 compared with the alternative

| PSGC | Barangay | Municipality | Production score | Rank | Alternative score | Rank | Absolute movement |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 403420008 | Kabulusan | Pakil | 82.3 | 1 | 84.4 | 1 | 0 |
| 403430001 | Banca-banca | Victoria | 78.7 | 2 | 81.0 | 2 | 0 |
| 403422001 | Aplaya | Pila | 77.7 | 3 | 78.8 | 6 | 3 |
| 403430003 | Masapang | Victoria | 77.7 | 3 | 79.8 | 4 | 1 |
| 403415003 | Munting Ambling | Magdalena | 76.7 | 5 | 77.7 | 8 | 3 |
| 403420002 | Banilan | Pakil | 76.0 | 6 | 77.7 | 8 | 2 |
| 403413011 | Primera Pulo | Lumban | 75.4 | 7 | 72.4 | 28 | 21 |
| 403414007 | Paagahan | Mabitac | 75.3 | 8 | 77.3 | 10 | 2 |
| 403420004 | Casa Real | Pakil | 74.8 | 9 | 79.2 | 5 | 4 |
| 403408017 | Mayatba | Famy | 74.6 | 10 | 75.8 | 15 | 5 |
| 403408002 | Bacong-Sigsigan | Famy | 74.3 | 11 | 79.9 | 3 | 8 |
| 403415018 | Maravilla | Magdalena | 74.3 | 11 | 76.7 | 12 | 1 |
| 403427020 | Barangay II | Santa Maria | 74.1 | 13 | 72.8 | 25 | 12 |
| 403427023 | Jose Rizal | Santa Maria | 74.1 | 13 | 72.2 | 29 | 16 |
| 403430009 | San Francisco | Victoria | 74.0 | 15 | 76.7 | 12 | 3 |
| 403407017 | Silangan Talaongan | Cavinti | 73.9 | 16 | 78.2 | 7 | 9 |
| 403413012 | Salac | Lumban | 73.3 | 17 | 69.7 | 46 | 29 |
| 403422010 | Mojon | Pila | 73.3 | 17 | 74.9 | 18 | 1 |
| 403427026 | Tungkod | Santa Maria | 73.3 | 17 | 77.1 | 11 | 6 |
| 403406013 | Kanluran | Calauan | 73.2 | 20 | 73.0 | 24 | 4 |
| 403407015 | Poblacion | Cavinti | 72.1 | 21 | 73.3 | 22 | 1 |
| 403415005 | Balanac | Magdalena | 72.1 | 21 | 74.5 | 19 | 2 |
| 403430005 | Pagalangan | Victoria | 72.1 | 21 | 75.8 | 15 | 6 |
| 403423010 | Talaga | Rizal | 71.8 | 24 | 70.9 | 36 | 12 |
| 403407018 | Sumucab | Cavinti | 71.6 | 25 | 76.1 | 14 | 11 |

## Interpretation

Hospital distance and clinic measures both proxy access and can overlap; changing their relative emphasis can change priorities even with identical source inputs. Clinic counts are OSM mapping observations, not verified absence or capacity. Straight-line distances are not travel times. Laguna-only scope can overstate access gaps at the provincial edge. Morbidity is synthetic, disaster risk is separate map context, and no result should be presented as a clinical or operational fact.

Reproduce from `omcm/frontend`: `node --experimental-strip-types scripts/clinic-sensitivity.mjs`; verify without writes using `--check`.
