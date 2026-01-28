from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import zipfile
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parent.parent / "public" / "filesystem"
OUTPUT_FILE = ROOT / "filesystem.json"

# Track reference errors to report at the end
reference_errors: List[str] = []


def display_name(raw: str) -> str:
    """Generate display name from a file or folder name."""
    name = raw.rsplit(".", 1)[0] if "." in raw else raw
    return name.replace("_", " ")


def read_desc(folder: Path) -> Optional[str]:
    desc_file = folder / "folder.md"
    if not desc_file.is_file():
        return None
    try:
        return desc_file.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError:
        # Fallback for legacy encodings; replace invalid bytes so the script never fails.
        return desc_file.read_text(encoding="utf-8", errors="replace").strip()


def find_folder_image(folder: Path) -> Optional[str]:
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        candidate = folder / f"folder_image{ext}"
        if candidate.is_file():
            return candidate.name
    return None


def read_references(folder: Path) -> List[str]:
    """Read references.txt and return list of referenced paths."""
    ref_file = folder / "references.txt"
    if not ref_file.is_file():
        return []
    try:
        content = ref_file.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError:
        content = ref_file.read_text(encoding="utf-8", errors="replace").strip()

    paths = []
    for line in content.splitlines():
        line = line.strip()
        if line:
            # Normalize path separators and remove leading slashes
            normalized = line.replace("\\", "/").strip("/")
            paths.append(normalized)
    return paths


def build_reference_item(ref_path: str, containing_folder: Path) -> Optional[Dict[str, Any]]:
    """Build an item for a referenced file or folder."""
    # Remove trailing slash to determine if it's meant to be a folder
    is_folder_ref = ref_path.endswith("/")
    clean_path = ref_path.rstrip("/")

    target = ROOT / clean_path

    if not target.exists():
        reference_errors.append(
            f"Reference error in {containing_folder.relative_to(ROOT)}: "
            f"'{ref_path}' does not exist"
        )
        return None

    if target.is_dir():
        # Build a folder reference - recursively get its contents
        rel_path = Path(clean_path)
        nested = build_folder(target, rel_path)
        if nested:
            nested["reference"] = "Yes"
            return nested
        return None
    else:
        # Build a file reference
        return build_file_item(target, Path(clean_path), is_reference=True)


def build_file_item(entry: Path, rel_path: Path, is_reference: bool = False) -> Optional[Dict[str, Any]]:
    """Build an item dict for a file."""
    archive_exts = {".zip", ".rar", ".7z"}
    html_exts = {".html", ".htm"}
    sound_exts = {".mp3", ".ogg", ".wav", ".flac", ".m4a"}

    size = entry.stat().st_size
    item: Dict[str, Any] = {
        "name": display_name(entry.name),
        "path": rel_path.as_posix(),
        "size": size,
    }

    if is_reference:
        item["reference"] = "Yes"

    suffix = entry.suffix.lower()

    if suffix == ".md":
        item["type"] = "wordpad"
    elif suffix in {".txt", ".js"}:
        item["type"] = "notepad"
    elif suffix in archive_exts:
        item["type"] = "archive"
    elif suffix in html_exts:
        item["type"] = "html"
    elif suffix in sound_exts:
        item["type"] = "sound"
    else:
        return None

    return item


def build_items(folder: Path, relative: Path) -> List[Dict[str, Any]]:
    children: List[Dict[str, Any]] = []

    # Process references from reference.txt
    ref_paths = read_references(folder)
    for ref_path in ref_paths:
        ref_item = build_reference_item(ref_path, folder)
        if ref_item:
            children.append(ref_item)

    # Split into folders/files, then sort each group alphabetically by display name.
    entries = list(folder.iterdir())
    folders = sorted([p for p in entries if p.is_dir()], key=lambda p: display_name(p.name).lower())
    files = sorted([p for p in entries if p.is_file()], key=lambda p: display_name(p.name).lower())
    ordered = folders + files
    archive_exts = {".zip", ".rar", ".7z"}
    html_exts = {".html", ".htm"}
    sound_exts = {".mp3", ".ogg", ".wav", ".flac", ".m4a"}
    for entry in ordered:
        if entry.name == "filesystem.json":
            continue
        if entry.name.startswith("."):
            continue
        # Skip references.txt - it's metadata, not content
        if entry.name == "references.txt":
            continue
        rel_path = relative / entry.name
        if entry.is_dir():
            nested = build_folder(entry, rel_path)
            if nested:
                children.append(nested)
        elif entry.suffix.lower() == ".md" and entry.name != "folder.md":
            size = entry.stat().st_size
            children.append(
                {
                    "type": "wordpad",
                    "name": display_name(entry.name),
                    "path": rel_path.as_posix(),
                    "size": size,
                }
            )
        elif entry.suffix.lower() in {".txt", ".js"}:
            size = entry.stat().st_size
            children.append(
                {
                    "type": "notepad",
                    "name": display_name(entry.name),
                    "path": rel_path.as_posix(),
                    "size": size,
                }
            )
        elif entry.suffix.lower() in archive_exts:
            size = entry.stat().st_size
            archive_item = {
                "type": "archive",
                "name": display_name(entry.name),
                "path": rel_path.as_posix(),
                "size": size,
            }
            # If a zip contains a .jsdos folder, also expose it as an executable item.
            if entry.suffix.lower() == ".zip":
                has_jsdos = False
                try:
                    with zipfile.ZipFile(entry) as zf:
                        has_jsdos = any(name.lower().startswith(".jsdos/") for name in zf.namelist())
                except zipfile.BadZipFile:
                    has_jsdos = False
                if has_jsdos:
                    exec_item = {
                        "type": "executable",
                        "name": display_name(entry.name),
                        "path": rel_path.as_posix(),
                        "size": size,
                    }
                    # Executable should appear before the plain archive entry.
                    children.append(exec_item)
                    children.append(archive_item)
                    continue
            children.append(archive_item)
        elif entry.suffix.lower() in html_exts:
            size = entry.stat().st_size
            children.append(
                {
                    "type": "html",
                    "name": display_name(entry.name),
                    "path": rel_path.as_posix(),
                    "size": size,
                }
            )
        elif entry.suffix.lower() in sound_exts:
            size = entry.stat().st_size
            children.append(
                {
                    "type": "sound",
                    "name": display_name(entry.name),
                    "path": rel_path.as_posix(),
                    "size": size,
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

    # Report any reference errors
    if reference_errors:
        print("\nReference errors found:", file=sys.stderr)
        for error in reference_errors:
            print(f"  - {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
