from __future__ import annotations

import argparse
import os
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, List, Tuple


class ImgTagParser(HTMLParser):
    """Collect <img> tag attribute dictionaries."""

    def __init__(self) -> None:
        super().__init__()
        self.images: List[Dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, str]]) -> None:
        if tag.lower() != "img":
            return
        self.images.append({k: v for k, v in attrs if v is not None})


def choose_best_image(attrs: Dict[str, str]) -> Tuple[str | None, List[str]]:
    """
    Pick the largest available image URL for a single <img>.
    Returns the chosen URL and all URL variants that should be replaced in HTML.
    """
    # Prefer the original file, then large file, then largest entry in srcset, then src.
    candidates: List[str] = []
    if "data-orig-file" in attrs:
        candidates.append(attrs["data-orig-file"])
    if "data-large-file" in attrs:
        candidates.append(attrs["data-large-file"])

    srcset = attrs.get("srcset") or attrs.get("data-lazy-srcset")
    if srcset:
        entries = []
        for part in srcset.split(","):
            bits = part.strip().split()
            if not bits:
                continue
            url = bits[0]
            weight = 0
            if len(bits) > 1:
                match = re.search(r"(\\d+)", bits[1])
                if match:
                    weight = int(match.group(1))
            entries.append((weight, url))
        if entries:
            entries.sort(key=lambda item: item[0])
            # Pick the last (largest)
            candidates.append(entries[-1][1])

    if "src" in attrs:
        candidates.append(attrs["src"])
    if "data-lazy-src" in attrs:
        candidates.append(attrs["data-lazy-src"])

    if not candidates:
        return None, []

    chosen = candidates[0]
    # Use all discovered URLs as variants for replacement.
    variants = list(dict.fromkeys(candidates))  # Preserve order, drop dups.
    return chosen, variants


def sanitize_filename(url: str, used_names: set[str]) -> str:
    """Derive a unique filename from the URL."""
    parsed = urllib.parse.urlparse(url)
    name = Path(parsed.path).name or "image"
    if not name:
        name = "image"
    stem = Path(name).stem
    suffix = Path(name).suffix or ".jpg"
    candidate = f"{stem}{suffix}"
    counter = 1
    while candidate in used_names:
        candidate = f"{stem}_{counter}{suffix}"
        counter += 1
    used_names.add(candidate)
    return candidate


def download_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "fetch_article/1.0"})
    with urllib.request.urlopen(req) as resp, open(dest, "wb") as f:
        f.write(resp.read())


def rewrite_html_links(html: str, replacements: Dict[str, str]) -> str:
    """Replace remote URLs with local relative paths."""
    for remote, local in replacements.items():
        html = html.replace(remote, local)
        # Also replace variant without query if present.
        no_query = urllib.parse.urlsplit(remote)._replace(query="").geturl()
        if no_query != remote:
            html = html.replace(no_query, local)
    return html


def fetch_article(page_url: str, html_path: Path, images_dir: Path) -> None:
    html_path.parent.mkdir(parents=True, exist_ok=True)

    # Download HTML
    req = urllib.request.Request(page_url, headers={"User-Agent": "fetch_article/1.0"})
    with urllib.request.urlopen(req) as resp:
        html_bytes = resp.read()
    html_text = html_bytes.decode("utf-8", errors="ignore")

    parser = ImgTagParser()
    parser.feed(html_text)

    replacements: Dict[str, str] = {}
    used_names: set[str] = set()

    for attrs in parser.images:
        chosen, variants = choose_best_image(attrs)
        if not chosen:
            continue
        abs_url = urllib.parse.urljoin(page_url, chosen)
        filename = sanitize_filename(abs_url, used_names)
        local_rel = f"images/{filename}"
        local_path = images_dir / filename

        # Download the file if not already present
        if not local_path.exists():
            download_file(abs_url, local_path)

        for variant in variants:
            full_variant = urllib.parse.urljoin(page_url, variant)
            replacements[full_variant] = local_rel

    rewritten_html = rewrite_html_links(html_text, replacements)
    html_path.write_text(rewritten_html, encoding="utf-8")


def main() -> None:
    default_url = "http://localhost:8080/?page_id=429"
    parser = argparse.ArgumentParser(description="Download WordPress article HTML and images.")
    parser.add_argument("--url", default=default_url, help="Article URL to fetch")
    parser.add_argument("--html", default="temp/article.html", help="Path to save fetched HTML")
    parser.add_argument(
        "--images-dir", default="temp/images", help="Directory to save downloaded images"
    )
    args = parser.parse_args()

    html_path = Path(args.html)
    images_dir = Path(args.images_dir)
    fetch_article(args.url, html_path, images_dir)
    print(f"Saved HTML to {html_path}")
    print(f"Images saved to {images_dir}")


if __name__ == "__main__":
    main()
