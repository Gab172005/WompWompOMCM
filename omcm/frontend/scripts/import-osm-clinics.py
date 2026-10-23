"""Build and check the offline OSM clinic snapshot for the Laguna planning dataset.

The browser never queries Overpass. This script owns the persistent snapshot in
``frontend/public/assets/osm``:

``osm-clinics-raw.json``          exact Overpass response body (ODbL-1.0,
                                  © OpenStreetMap contributors)
``osm-clinics-provenance.json``   acquisition inputs, boundary checksums, counts
``osm-clinics-normalized.json``   typed clinic records + ``clinicSnapshot``

Modes (exactly one; the default is ``--check``):

``--check``       Offline. Verifies the stored raw/provenance/normalized triple
                  is byte-reproducible, internally consistent and that the
                  generated browser bundle embeds the same snapshot.
``--raw PATH``    Offline import of a previously acquired raw Overpass response.
``--provenance PATH``
                  Offline import: the raw file named by an acquisition
                  provenance document (used for the staged acquisition).
``--refresh``     The only mode that touches the network (Overpass). A
                  timeout, malformed payload, Overpass ``remark`` or empty
                  result leaves the current snapshot untouched.

Writing a new snapshot validates first, stages all three files, then replaces
all targets under an exclusive lock. Caught replacement exceptions trigger a
best-effort rollback; backups are retained if rollback itself fails. This does
not promise crash-atomic replacement of three separate files. If a process dies
while holding the lock, remove the stale lock only after confirming no importer
is running.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from contextlib import contextmanager, nullcontext
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import osm_clinics as oc  # noqa: E402

# Staged acquisition produced by the parent (frontend/test-results/).
STAGED_RAW = oc.ROOT / "frontend/test-results/osm-clinics-raw.json"
STAGED_ACQUISITION = oc.ROOT / "frontend/test-results/osm-clinics-acquisition.json"


class ImportFailure(SystemExit):
    pass


def fail(message: str) -> ImportFailure:
    return ImportFailure(f"import-osm-clinics: {message}")


# --------------------------------------------------------------------------- #
# Staging and atomic replacement


def _fsync_write(path: Path, data: bytes) -> None:
    with open(path, "wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())


@contextmanager
def snapshot_lock(asset_dir: Path = oc.ASSET_DIR):
    """Acquire an exclusive lock for this import; concurrent writers fail fast."""
    asset_dir.mkdir(parents=True, exist_ok=True)
    lock_path = asset_dir / ".osm-clinics-import.lock"
    try:
        descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise fail(f"another clinic snapshot import holds {lock_path.name}; retry after it finishes") from None
    try:
        with os.fdopen(descriptor, "w", encoding="ascii") as handle:
            handle.write(f"pid={os.getpid()}\n")
            handle.flush()
            os.fsync(handle.fileno())
        yield
    finally:
        lock_path.unlink(missing_ok=True)


def replace_atomically(files: dict[Path, bytes], *, lock: bool = True) -> None:
    """Stage files uniquely and roll back caught replacement errors best-effort.

    Unique same-directory staging avoids fixed ``.tmp``/``.bak`` collisions.
    Originals are kept under unique backup names until all replacement calls
    succeed. On a caught exception, restoration is attempted in reverse order;
    a failed restoration leaves the corresponding backup for manual recovery.
    The three path swaps are not crash-atomic as a group.
    """
    context = snapshot_lock(next(iter(files)).parent) if lock and files else nullcontext()
    with context:
        nonce = uuid.uuid4().hex
        staged: list[tuple[Path, Path]] = []
        touched: list[tuple[Path, Path | None]] = []
        committed = False
        rollback_failed = False
        try:
            for target, data in files.items():
                target.parent.mkdir(parents=True, exist_ok=True)
                temporary = target.with_name(f".{target.name}.{nonce}.tmp")
                staged.append((target, temporary))
                _fsync_write(temporary, data)
            for target, temporary in staged:
                backup = target.with_name(f".{target.name}.{nonce}.bak") if target.exists() else None
                # Track before the first rename so errors are rollback-visible.
                touched.append((target, backup))
                if backup is not None:
                    os.replace(target, backup)
                os.replace(temporary, target)
            committed = True
        except Exception:
            for target, backup in reversed(touched):
                try:
                    if backup is not None:
                        if backup.exists():
                            if target.exists():
                                target.unlink()
                            os.replace(backup, target)
                    elif target.exists():
                        target.unlink()
                except OSError:  # keep backup for manual recovery
                    rollback_failed = True
            raise
        finally:
            for _, temporary in staged:
                if temporary.exists():
                    temporary.unlink()
            if committed or not rollback_failed:
                for _, backup in touched:
                    if backup is not None and backup.exists():
                        backup.unlink()


def render_snapshot(snapshot: oc.Snapshot) -> dict[Path, bytes]:
    documents = snapshot.documents()
    return {
        oc.RAW_PATH: documents[oc.RAW_PATH.name],
        oc.PROVENANCE_PATH: documents[oc.PROVENANCE_PATH.name],
        oc.NORMALIZED_PATH: documents[oc.NORMALIZED_PATH.name],
    }


# --------------------------------------------------------------------------- #
# Acquisition provenance


def load_acquisition(path: Path, *, endpoint: str | None = None) -> tuple[bytes, dict]:
    """Read an acquisition document and resolve its raw response beside it.

    The document must describe the payload: a checksum that matches the raw
    file, plus the query text and retrieval timestamp. Without those the
    snapshot could not be reproduced offline, so the import is rejected before
    anything is staged or replaced.
    """
    document = oc.read_json(path)
    if not isinstance(document, dict):
        raise fail(f"{path.name} is not a JSON object")
    raw_name = document.get("rawFile") or oc.RAW_PATH.name
    raw_path = path.parent / raw_name
    if not raw_path.exists():
        raise fail(f"{path.name} points at a missing raw file {raw_name}")
    raw_bytes = raw_path.read_bytes()
    declared = document.get("sha256") or document.get("rawSha256")
    actual = oc.sha256_bytes(raw_bytes)
    if not declared:
        raise fail(f"{path.name} has no checksum for {raw_name}; cannot verify the payload")
    if declared != actual:
        raise fail(f"{raw_name} checksum {actual} does not match the acquisition document ({declared})")
    query = document.get("query")
    if not isinstance(query, str) or not query.strip():
        raise fail(f"{path.name} has no query text; provenance must preserve the actual query")
    retrieved_at = document.get("retrievedAt")
    if not isinstance(retrieved_at, str) or not retrieved_at.strip():
        raise fail(f"{path.name} has no retrievedAt; the snapshot could not be reproduced offline")
    inputs = {
        # A sidecar's own endpoint describes the acquisition; --endpoint only
        # fills the gap when the document does not record one.
        "endpoint": document.get("endpoint") or endpoint,
        "query": query,
        "retrievedAt": retrieved_at,
        "bbox": document.get("bbox"),
    }
    if not inputs["endpoint"]:
        raise fail(f"{path.name} has no endpoint and none was supplied with --endpoint")
    return raw_bytes, inputs


def acquisition_inputs_for_raw(path: Path, *, endpoint: str | None = None) -> dict:
    """Provenance inputs for a raw-only import; the sidecar is verified, never guessed."""
    explicit = path.with_name(path.name.replace("-raw", "-acquisition"))
    generic = path.with_name(STAGED_ACQUISITION.name)
    for candidate in (explicit, generic):
        if candidate.exists() and candidate != path:
            document = oc.read_json(candidate)
            if not isinstance(document, dict):
                continue
            declared = document.get("sha256") or document.get("rawSha256")
            referenced = document.get("rawFile") or candidate.name
            if declared and declared != oc.sha256_bytes(path.read_bytes()):
                raise fail(
                    f"{candidate.name} describes a different payload than {path.name}; "
                    "refusing to attach provenance to an unverified raw file"
                )
            if referenced != path.name and declared is None:
                continue
            if isinstance(document.get("query"), str):
                return load_acquisition(candidate, endpoint=endpoint)[1]
    raise fail(
        f"no acquisition document beside {path.name}. A raw import needs the query text and "
        "retrieval time (use --provenance PATH or place a matching *-acquisition.json beside the raw file)"
    )


# --------------------------------------------------------------------------- #
# Modes


def current_state():
    diagnosis = oc.diagnose_snapshot()
    counts = None
    raw_sha = None
    if diagnosis.provenance and isinstance(diagnosis.provenance.get("counts"), dict):
        counts = diagnosis.provenance["counts"]
    if diagnosis.raw_bytes is not None:
        raw_sha = oc.sha256_bytes(diagnosis.raw_bytes)
    elif diagnosis.provenance:
        raw_sha = diagnosis.provenance.get("rawSha256")
    return diagnosis, counts, raw_sha


def apply_snapshot(raw_bytes: bytes, inputs: dict, *, allow_empty: bool,
                   allow_large_drop: bool) -> oc.Snapshot:
    """Validate, guard and persist one candidate under the writer lock."""
    with snapshot_lock():
        try:
            snapshot = oc.build_snapshot(raw_bytes, inputs, allow_empty=allow_empty)
        except (oc.ResponseError, oc.SnapshotError) as error:
            raise fail(f"rejected response: {error}") from None
        diagnosis, counts, raw_sha = current_state()
        guard = oc.guard_replacement(
            counts,
            snapshot.clinic_snapshot["counts"],
            raw_sha,
            oc.sha256_bytes(raw_bytes),
            allow_empty=allow_empty,
            allow_large_drop=allow_large_drop,
        )
        for message in guard.messages:
            print(f"  {message}")
        if not guard.ok:
            raise fail("replacement rejected; the current snapshot is unchanged")
        if diagnosis.present and not diagnosis.consistent:
            print("  Existing snapshot was inconsistent and is being replaced:")
            for issue in diagnosis.issues:
                print(f"    - {issue}")
        replace_atomically(render_snapshot(snapshot), lock=False)
        return snapshot


def report_counts(snapshot: oc.Snapshot) -> None:
    counts = snapshot.clinic_snapshot["counts"]
    summary = [
        ("candidates", "raw candidates"),
        ("records", "retained clinic records"),
        ("active", "active"),
        ("inactive", "inactive (lifecycle)"),
        ("activeAssigned", "active assigned to a barangay"),
        ("activeLocatedInProvince", "active located in province"),
        ("activeAmbiguous", "active ambiguous"),
        ("activeOutside", "active outside province"),
        ("activeUnlocated", "active unlocated"),
        ("duplicates", "deduplicated by identity"),
        ("suspectedDuplicates", "suspected duplicate pairs"),
        ("activeOverpassCenters", "located by Overpass centre"),
    ]
    for key, label in summary:
        print(f"  {label:34s} {counts.get(key, 0)}")
    for warning in snapshot.clinic_snapshot["warnings"]:
        print(f"  note: {warning}")


def mode_check() -> int:
    diagnosis = oc.diagnose_snapshot()
    if not diagnosis.present:
        raise fail("no clinic snapshot is installed; run with --raw or --refresh")
    problems = list(diagnosis.issues)
    if not problems and diagnosis.raw_bytes is not None:
        provenance = diagnosis.provenance or {}
        inputs = {
            "endpoint": provenance.get("endpoint"),
            "query": provenance.get("query"),
            "retrievedAt": provenance.get("retrievedAt"),
            "bbox": provenance.get("bbox"),
        }
        try:
            stored_snapshot = (diagnosis.normalized or {}).get("clinicSnapshot") or {}
            rebuilt = oc.build_snapshot(
                diagnosis.raw_bytes, inputs,
                allow_empty=stored_snapshot.get("valid") is True
                and stored_snapshot.get("counts", {}).get("records") == 0,
            )
        except (oc.ResponseError, oc.SnapshotError) as error:
            problems.append(f"Stored raw response no longer validates: {error}")
        else:
            documents = rebuilt.documents()
            for name in (oc.NORMALIZED_PATH.name, oc.PROVENANCE_PATH.name):
                stored = (oc.ASSET_DIR / name).read_bytes()
                if stored != documents[name]:
                    problems.append(
                        f"{name} is not byte-reproducible from the stored raw response; regenerate it"
                    )
    if not problems:
        bundle_problem = check_bundle(diagnosis.normalized, diagnosis.provenance)
        if bundle_problem:
            problems.append(bundle_problem)
    if problems:
        for problem in problems:
            print(f"  - {problem}")
        raise fail("clinic snapshot check failed")
    counts = (diagnosis.provenance or {}).get("counts", {})
    print(
        "Clinic snapshot OK: "
        f"{counts.get('candidates', 0)} raw candidates, "
        f"{counts.get('active', 0)} active, "
        f"{counts.get('activeLocatedInProvince', 0)} active located in province, "
        f"{counts.get('inactive', 0)} inactive, "
        f"{counts.get('suspectedDuplicates', 0)} suspected duplicate pair(s)."
    )
    print("Retrieved " + str((diagnosis.provenance or {}).get("retrievedAt")) + "; " + oc.ATTRIBUTION)
    return 0


def check_bundle(normalized: dict | None, provenance: dict | None) -> str | None:
    """The generated browser bundle must embed exactly this snapshot."""
    bundle = oc.ROOT / "frontend/src/data/laguna-datasets.json"
    if not bundle.exists():
        return f"{bundle.relative_to(oc.ROOT).as_posix()} is missing; run import-laguna-datasets.py"
    data = json.loads(bundle.read_text(encoding="utf-8"))
    snapshot = data.get("clinicSnapshot")
    clinics = data.get("clinics")
    if not isinstance(snapshot, dict) or not isinstance(clinics, list):
        return "bundle has no clinicSnapshot/clinics; run import-laguna-datasets.py"
    expected = (normalized or {}).get("clinicSnapshot")
    if expected and snapshot != expected:
        return "bundle clinicSnapshot differs from the stored snapshot; run import-laguna-datasets.py"
    expected_clinics = (normalized or {}).get("clinics")
    if expected_clinics is not None and clinics != expected_clinics:
        return "bundle clinics differ from the stored snapshot; run import-laguna-datasets.py"
    return None


def mode_raw(path: Path, *, endpoint: str | None, allow_empty: bool, allow_large_drop: bool) -> int:
    if not path.exists():
        raise fail(f"raw response not found: {path}")
    raw_bytes = path.read_bytes()
    # Raises unless a verified acquisition document supplies query + retrievedAt.
    inputs = acquisition_inputs_for_raw(path, endpoint=endpoint)
    snapshot = apply_snapshot(raw_bytes, inputs, allow_empty=allow_empty,
                              allow_large_drop=allow_large_drop)
    print(f"Imported {path.name} -> {oc.ASSET_DIR.relative_to(oc.ROOT).as_posix()}")
    report_counts(snapshot)
    return 0


def mode_provenance(path: Path, *, allow_empty: bool, allow_large_drop: bool) -> int:
    raw_bytes, inputs = load_acquisition(path)
    snapshot = apply_snapshot(raw_bytes, inputs, allow_empty=allow_empty,
                              allow_large_drop=allow_large_drop)
    print(f"Imported {path.name} -> {oc.ASSET_DIR.relative_to(oc.ROOT).as_posix()}")
    report_counts(snapshot)
    return 0


def mode_refresh(*, endpoint: str, query: str, allow_empty: bool, allow_large_drop: bool) -> int:
    print(f"  endpoint {endpoint}")
    print("  this is the only mode that contacts the network")
    try:
        raw_bytes = oc.acquire(query, endpoint=endpoint)
    except oc.ResponseError as error:
        raise fail(f"refresh failed, existing snapshot unchanged: {error}") from None
    inputs = oc.new_provenance_inputs(endpoint=endpoint, query=query)
    snapshot = apply_snapshot(raw_bytes, inputs, allow_empty=allow_empty,
                              allow_large_drop=allow_large_drop)
    print(f"Refreshed {oc.ASSET_DIR.relative_to(oc.ROOT).as_posix()}")
    report_counts(snapshot)
    return 0


# --------------------------------------------------------------------------- #
# Entry point


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="offline reproducibility and bundle check (default)")
    modes.add_argument("--raw", type=Path, help="import a local raw Overpass response")
    modes.add_argument("--provenance", type=Path, help="import the raw file named by a local acquisition document")
    modes.add_argument("--refresh", action="store_true", help="query Overpass (network) and replace the snapshot")
    parser.add_argument("--endpoint", default=None,
                        help="Overpass interpreter URL (refresh default: the official interpreter)")
    parser.add_argument("--query", default=None, help="override the canonical Overpass query (refresh only)")
    parser.add_argument("--allow-empty", action="store_true", help="allow a replacement with no clinic candidates")
    parser.add_argument("--allow-large-drop", action="store_true",
                        help="allow a replacement whose raw candidate count drops by more than half")
    parser.add_argument("--print-query", action="store_true", help="print the canonical query and exit")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.print_query:
        query = args.query or oc.canonical_query(oc.province_bbox())
        print(query)
        return 0
    try:
        if args.refresh:
            query = args.query or oc.canonical_query(oc.province_bbox())
            return mode_refresh(endpoint=args.endpoint or oc.OVERPASS_ENDPOINT, query=query,
                                allow_empty=args.allow_empty, allow_large_drop=args.allow_large_drop)
        if args.raw:
            return mode_raw(args.raw.resolve(), endpoint=args.endpoint,
                            allow_empty=args.allow_empty, allow_large_drop=args.allow_large_drop)
        if args.provenance:
            return mode_provenance(args.provenance.resolve(), allow_empty=args.allow_empty,
                                   allow_large_drop=args.allow_large_drop)
        return mode_check()
    except ImportFailure as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
