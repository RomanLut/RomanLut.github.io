from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import zipfile
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent.parent / "public" / "filesystem"
OUTPUT_FILE = ROOT / "filesystem.json"

# Track reference errors to report at the end
reference_errors: List[str] = []
highlight_errors: List[str] = []


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
    for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        candidate = folder / f"folder_image{ext}"
        if candidate.is_file():
            return candidate.name
    return None


def read_url_target(file_path: Path) -> Optional[str]:
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    for line in content.splitlines():
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("["):
            continue
        if cleaned.lower().startswith("url="):
            target = cleaned.split("=", 1)[1].strip()
            if target:
                return target
            continue
        if cleaned.lower().startswith("http://") or cleaned.lower().startswith("https://"):
            return cleaned
    return None


def classify_external_url(target: str) -> str:
    parsed = urlparse(target)
    hostname = (parsed.netloc or "").lower()
    hostname = hostname.split(":", 1)[0]
    if hostname.startswith("www."):
        hostname = hostname[4:]
    if "github.com" in hostname:
        return "github"
    if hostname.endswith("youtube.com") or hostname.endswith("youtu.be"):
        return "youtube"
    return "html"


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


def read_highlights(folder: Path) -> Set[str]:
    highlight_file = folder / "highlight.txt"
    if not highlight_file.is_file():
        return set()
    try:
        content = highlight_file.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError:
        content = highlight_file.read_text(encoding="utf-8", errors="replace").strip()

    highlighted: Set[str] = set()
    for line in content.splitlines():
        name = line.strip()
        if not name:
            continue
        normalized = name.rstrip("/")
        if not normalized:
            continue
        target = folder / normalized
        if not target.exists():
            highlight_errors.append(
                f"Highlight error in {folder.relative_to(ROOT)}: '{name}' does not exist"
            )
            continue
        highlighted.add(normalized)
    return highlighted


def read_ignore(folder: Path) -> Set[str]:
    ignore_file = folder / "ignore.txt"
    if not ignore_file.is_file():
        return set()
    try:
        content = ignore_file.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = ignore_file.read_text(encoding="utf-8", errors="replace")
    ignored: Set[str] = set()
    for line in content.splitlines():
        name = line.strip()
        if name:
            ignored.add(name)
    return ignored


def apply_star_if_needed(item: Dict[str, Any], entry_name: str, highlight_lower: Set[str]) -> None:
    if entry_name.lower() in highlight_lower:
        item["star"] = True


def build_reference_item(
    ref_path: str,
    containing_folder: Path,
    highlight_lower: Set[str],
) -> Optional[Dict[str, Any]]:
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

    base_name = Path(clean_path).name
    parent_highlights = {name.lower() for name in read_highlights(target.parent)} if target.parent else set()
    highlight_sources = highlight_lower | parent_highlights
    if target.is_dir():
        # Build a folder reference - recursively get its contents
        rel_path = Path(clean_path)
        nested = build_folder(target, rel_path)
        if nested:
            nested["reference"] = "Yes"
            apply_star_if_needed(nested, base_name, highlight_sources)
            return nested
        return None
    else:
        # Build a file reference
        result = build_file_item(target, Path(clean_path), is_reference=True)
        if result:
            apply_star_if_needed(result, base_name, highlight_sources)
        return result


def build_file_item(entry: Path, rel_path: Path, is_reference: bool = False) -> Optional[Dict[str, Any]]:
    """Build an item dict for a file."""
    archive_exts = {".zip", ".rar", ".7z"}
    html_exts = {".html", ".htm"}
    sound_exts = {".mp3", ".ogg", ".wav", ".flac", ".m4a", ".wmv"}
    image_exts = {".jpg", ".jpeg", ".png", ".gif"}

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
    elif suffix == ".url":
        link = read_url_target(entry)
        if not link:
            return None
        item["type"] = classify_external_url(link)
        item["url"] = link
    elif suffix in sound_exts:
        item["type"] = "sound"
    elif suffix in image_exts:
        item["type"] = "image"
    else:
        return None

    return item


def build_items(folder: Path, relative: Path) -> List[Dict[str, Any]]:
    children: List[Dict[str, Any]] = []
    highlight_names = read_highlights(folder)
    highlight_lower = {name.lower() for name in highlight_names}
    ignore_names = read_ignore(folder)
    ignore_lower = {name.lower() for name in ignore_names}

    # Process references from reference.txt
    ref_paths = read_references(folder)
    for ref_path in ref_paths:
        ref_item = build_reference_item(ref_path, folder, highlight_lower)
        if ref_item:
            children.append(ref_item)

    # Split into folders/files, then sort each group alphabetically by display name.
    entries = list(folder.iterdir())
    folders = sorted([p for p in entries if p.is_dir()], key=lambda p: display_name(p.name).lower())
    files = sorted([p for p in entries if p.is_file()], key=lambda p: display_name(p.name).lower())
    ordered = folders + files
    archive_exts = {".zip", ".rar", ".7z"}
    html_exts = {".html", ".htm"}
    sound_exts = {".mp3", ".ogg", ".wav", ".flac", ".m4a", ".wmv"}
    image_exts = {".jpg", ".jpeg", ".png", ".gif"}
    for entry in ordered:
        if entry.name == "filesystem.json":
            continue
        if entry.name.startswith("."):
            continue
        # Skip references.txt - it's metadata, not content
        if entry.name == "references.txt":
            continue
        if entry.name == "highlight.txt":
            continue
        if entry.name == "ignore.txt":
            continue
        if entry.name.lower() in ignore_lower:
            continue
        # Skip folder_image files - they are folder metadata
        if entry.is_file() and entry.stem == "folder_image":
            continue
        rel_path = relative / entry.name
        if entry.is_dir():
            if entry.name == "images":
                continue
            nested = build_folder(entry, rel_path)
            if nested:
                apply_star_if_needed(nested, entry.name, highlight_lower)
                children.append(nested)
        elif entry.suffix.lower() == ".md" and entry.name != "folder.md":
            size = entry.stat().st_size
            item = {
                "type": "wordpad",
                "name": display_name(entry.name),
                "path": rel_path.as_posix(),
                "size": size,
            }
            apply_star_if_needed(item, entry.name, highlight_lower)
            children.append(item)
        elif entry.suffix.lower() in {".txt", ".js"}:
            size = entry.stat().st_size
            item = {
                "type": "notepad",
                "name": display_name(entry.name),
                "path": rel_path.as_posix(),
                "size": size,
            }
            apply_star_if_needed(item, entry.name, highlight_lower)
            children.append(item)
        elif entry.suffix.lower() in archive_exts:
            size = entry.stat().st_size
            archive_item = {
                "type": "archive",
                "name": display_name(entry.name),
                "path": rel_path.as_posix(),
                "size": size,
            }
            apply_star_if_needed(archive_item, entry.name, highlight_lower)
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
                    apply_star_if_needed(exec_item, entry.name, highlight_lower)
                    # Executable should appear before the plain archive entry.
                    children.append(exec_item)
                    children.append(archive_item)
                    continue
            children.append(archive_item)
        elif entry.suffix.lower() in html_exts:
            size = entry.stat().st_size
            item = {
                "type": "html",
                "name": display_name(entry.name),
                "path": rel_path.as_posix(),
                "size": size,
            }
            apply_star_if_needed(item, entry.name, highlight_lower)
            children.append(item)
        elif entry.suffix.lower() == ".url":
            link = read_url_target(entry)
            if not link:
                continue
            size = entry.stat().st_size
            item = {
                "type": classify_external_url(link),
                "name": display_name(entry.name),
                "path": rel_path.as_posix(),
                "size": size,
                "url": link,
            }
            apply_star_if_needed(item, entry.name, highlight_lower)
            children.append(item)
        elif entry.suffix.lower() in sound_exts:
            size = entry.stat().st_size
            item = {
                "type": "sound",
                "name": display_name(entry.name),
                "path": rel_path.as_posix(),
                "size": size,
            }
            apply_star_if_needed(item, entry.name, highlight_lower)
            children.append(item)
        elif entry.suffix.lower() in image_exts:
            size = entry.stat().st_size
            item = {
                "type": "image",
                "name": display_name(entry.name),
                "path": rel_path.as_posix(),
                "size": size,
            }
            apply_star_if_needed(item, entry.name, highlight_lower)
            children.append(item)
    # Sort all children: folders first, then alphabetically by name
    children.sort(key=lambda item: (0 if item['type'] == 'folder' else 1, item['name'].lower()))
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
    if highlight_errors:
        print("\nHighlight errors found:", file=sys.stderr)
        for error in highlight_errors:
            print(f"  - {error}", file=sys.stderr)
    if reference_errors or highlight_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
