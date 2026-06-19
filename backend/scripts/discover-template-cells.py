#!/usr/bin/env python3
"""Discover XLSX merged-cell regions and emit suggested template_def field mappings."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

# Qu(Rock) entry field offsets from block start row (col, offset)
QU_ROCK_ENTRY_FIELDS: list[tuple[str, str, int]] = [
    ("boringNumber", "E", 0),
    ("depth", "K", 0),
    ("sampleNumber", "S", 0),
    ("sampleDate", "Y", 0),
    ("materialDescription", "H", 1),
    ("failureType", "X", 2),
    ("heightH1", "E", 3),
    ("heightH2", "E", 4),
    ("heightH3", "E", 5),
    ("heightAvg", "E", 6),
    ("diameterD1", "M", 3),
    ("diameterD2", "M", 4),
    ("diameterD3", "M", 5),
    ("diameterAvg", "M", 6),
    ("trueLoad", "Y", 3),
    ("peakStress", "W", 4),
    ("failureStrain", "W", 5),
    ("weightOfSample", "H", 7),
    ("wetWeightTare", "H", 8),
    ("dryWeightTare", "H", 9),
    ("tareWeight", "H", 10),
    ("tarePanNumber", "H", 11),
    ("comments", "U", 7),
    ("dataFile", "U", 11),
]

QU_ROCK_HEADER_FIELDS: dict[str, str] = {
    "header_loadFrameNumber": "F11",
    "header_caliperNumber": "O11",
    "header_loadCellNumber": "F12",
    "header_scaleNumber": "O12",
    "header_lvdtNumber": "D13",
    "header_ovenNumber": "O13",
    "header_strainRate": "G14",
    "header_testedBy[name]": "G61",
    "header_testedBy[date]": "N61",
    "header_dryWeightsBy[name]": "G62",
    "header_dryWeightsBy[date]": "N62",
}

QU_ROCK_STANDARD_FIELDS: dict[str, str] = {
    "projectName": "D9",
    "projectNumber": "T9",
    "dateOfTest": "X9",
}


def parse_merges(xlsx_path: Path) -> list[tuple[int, int, str, str, str]]:
    with zipfile.ZipFile(xlsx_path) as z:
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    merges: list[tuple[int, int, str, str, str]] = []
    mc = sheet.find("m:mergeCells", NS)
    if mc is None:
        return merges
    for cell in mc.findall("m:mergeCell", NS):
        ref = cell.get("ref", "")
        start, end = ref.split(":")
        ra = int(re.search(r"\d+", start).group())
        rb = int(re.search(r"\d+", end).group())
        ca = re.match(r"([A-Z]+)", start).group(1)
        cb = re.match(r"([A-Z]+)", end).group(1)
        merges.append((ra, rb, ca, cb, ref))
    return merges


def entry_range(col: str, offset: int, entry_start_row: int, max_entries: int, rows_per_entry: int) -> str:
    start_row = entry_start_row + offset
    end_row = start_row + max_entries * rows_per_entry - 1
    return f"{col}{start_row}-{end_row}"


def build_qu_rock_mapping(
    entry_start_row: int,
    rows_per_entry: int,
    max_entries: int,
) -> dict[str, str]:
    mapping = dict(QU_ROCK_HEADER_FIELDS)
    for field_id, col, offset in QU_ROCK_ENTRY_FIELDS:
        key = f"entry_{field_id}_row"
        mapping[key] = entry_range(col, offset, entry_start_row, max_entries, rows_per_entry)
    return mapping


def print_merges_in_rows(merges: list[tuple[int, int, str, str, str]], min_row: int, max_row: int, label: str) -> None:
    print(f"\n=== {label} (rows {min_row}-{max_row}) ===")
    block = [m for m in merges if not (m[1] < min_row or m[0] > max_row)]
    for ra, rb, ca, cb, ref in sorted(block, key=lambda x: (x[0], ca_to_num(x[2]))):
        print(f"  {ref} (rows {ra}-{rb}, cols {ca}-{cb})")


def ca_to_num(col: str) -> int:
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - 64)
    return n


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover XLSX cell mappings for template_def JSON")
    parser.add_argument(
        "--file",
        type=Path,
        default=Path("data/templates/unconfined-compression-rock.xlsx"),
        help="Path to XLSX template (relative to backend/ or absolute)",
    )
    parser.add_argument("--entry-start-row", type=int, default=19)
    parser.add_argument("--rows-per-entry", type=int, default=14)
    parser.add_argument("--max-entries", type=int, default=3)
    parser.add_argument("--json", action="store_true", help="Emit full template_def JSON snippet")
    args = parser.parse_args()

    xlsx_path = args.file
    if not xlsx_path.is_absolute():
        backend_dir = Path(__file__).resolve().parent.parent
        xlsx_path = backend_dir / xlsx_path

    if not xlsx_path.exists():
        print(f"Error: file not found: {xlsx_path}", file=sys.stderr)
        return 1

    merges = parse_merges(xlsx_path)
    print(f"File: {xlsx_path}")
    print(f"Total merges: {len(merges)}")

    print_merges_in_rows(merges, 9, 14, "Header / equipment")
    print_merges_in_rows(merges, 61, 62, "Sign-off")

    for start in [args.entry_start_row, args.entry_start_row + args.rows_per_entry, args.entry_start_row + 2 * args.rows_per_entry]:
        print_merges_in_rows(merges, start, start + 11, f"Entry block starting row {start}")

    mapping = build_qu_rock_mapping(args.entry_start_row, args.rows_per_entry, args.max_entries)

    print("\n=== Suggested entry fieldMapping ===")
    for key, value in mapping.items():
        if key.startswith("entry_"):
            print(f'  "{key}": "{value}",')

    if args.json:
        template_def = {
            "templateId": "unconfined-compression-rock",
            "name": "unconfined_compression_rock",
            "displayName": "Unconfined Compression Test on Rock (ASTM D 7012)",
            "filePath": "unconfined-compression-rock.xlsx",
            "format": "xlsx",
            "maxEntries": args.max_entries,
            "rowsPerEntry": args.rows_per_entry,
            "standardFields": QU_ROCK_STANDARD_FIELDS,
            "fieldMapping": mapping,
        }
        print("\n=== Full template_def JSON ===")
        print(json.dumps(template_def, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
