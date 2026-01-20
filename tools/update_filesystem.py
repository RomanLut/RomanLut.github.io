from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parent.parent / "public" / "filesystem"
OUTPUT_FILE = ROOT / "filesystem.json"


def display_name(raw: str) -> str:
    """Generate display name from a file or folder name."""
    name = raw.rsplit(".", 1)[0] if "." in raw else raw
    return name.replace("_", " ")


def read_desc(folder: Path) -> Optional[str]:
    desc_file = folder / "folder.md"
    if not desc_file.is_file():
        return None
    return desc_file.read_text(encoding="utf-8").strip()


def find_folder_image(folder: Path) -> Optional[str]:
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        candidate = folder / f"folder_image{ext}"
        if candidate.is_file():
            return candidate.name
    return None


def build_items(folder: Path, relative: Path) -> List[Dict[str, Any]]:
    children: List[Dict[str, Any]] = []
    # Sort to keep deterministic output (folders first, then files).
    entries = sorted(folder.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    for entry in entries:
        if entry.name == "filesystem.json":
            continue
        if entry.name.startswith("."):
            continue
        rel_path = relative / entry.name
        if entry.is_dir():
            nested = build_folder(entry, rel_path)
            if nested:
                children.append(nested)
        elif entry.suffix.lower() == ".md" and entry.name != "folder.md":
            children.append(
                {
                    "type": "wordpad",
                    "name": display_name(entry.name),
                    "path": rel_path.as_posix(),
                }
            )
    return children


def build_folder(folder: Path, relative: Path) -> Optional[Dict[str, Any]]:
    items = build_items(folder, relative)
    if not items:
        return None

    node: Dict[str, Any] = {
        "type": "folder",
        "name": display_name(folder.name),
        "path": relative.as_posix(),
        "items": items,
    }

    image = find_folder_image(folder)
    if image:
        node["image"] = image

    desc = read_desc(folder)
    if desc:
        node["desc"] = desc

    return node


def build_filesystem(root: Path) -> Dict[str, Any]:
    items = build_items(root, Path())
    return {"items": items}


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate filesystem.json from public/filesystem contents.")
    parser.add_argument(
        "--output",
        default=str(OUTPUT_FILE),
        help="Path to write filesystem.json (default: public/filesystem/filesystem.json)",
    )
    args = parser.parse_args()

    data = build_filesystem(ROOT)
    output_path = Path(args.output)
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote filesystem structure to {output_path}")


if __name__ == "__main__":
    main()
