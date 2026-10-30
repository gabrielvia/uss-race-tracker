"""Build a reviewable inventory from the official results directory."""

import argparse
from collections import Counter
from datetime import date, datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

DIRECTORY_URL = "https://www.usspeedskating.org/results"
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class DirectoryParser(HTMLParser):
    """Read only links inside season accordion items, not navigation or scripts."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.entries = []
        self.seasons = []
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        season = self.stack[-1][1] if self.stack else None
        if attrs.get("data-part") == "item" and attrs.get("data-scope") == "accordion":
            match = re.search(r":item:(\d{8}|\d{4})$", attrs.get("id", ""))
            if match:
                raw = match[1]
                season = f"{raw[:4]}-{raw[4:]}" if len(raw) == 8 else raw
                if season not in self.seasons:
                    self.seasons.append(season)
        if tag == "a" and season and attrs.get("href"):
            self.anchor = {"season": season, "url": urljoin(DIRECTORY_URL, attrs["href"]), "text": []}
        if tag not in VOID_TAGS:
            self.stack.append((tag, season))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "a" and self.anchor:
            self.entries.append({"season": self.anchor["season"], "url": self.anchor["url"], "title": " ".join("".join(self.anchor["text"]).split())})
            self.anchor = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if self.anchor:
            self.anchor["text"].append(data)


def build_inventory(html, retrieved_at):
    parser = DirectoryParser()
    parser.feed(html)
    if not parser.seasons or not parser.entries:
        raise ValueError("No season links found; the directory layout may have changed.")
    entries = []
    seen = set()
    for item in parser.entries:
        key = (item["season"], item["url"], item["title"])
        if key in seen:
            continue
        seen.add(key)
        path = urlsplit(item["url"]).path.lower()
        suffix = Path(path).suffix
        kind = "pdf" if suffix == ".pdf" else "spreadsheet" if suffix in {".xlsx", ".xls", ".csv"} else "page"
        issues = []
        match = re.match(r"^(\d{4}-\d{2}-\d{2})(?:\s|$)", item["title"])
        title_date = None
        if match:
            try:
                title_date = date.fromisoformat(match[1])
                if title_date > datetime.fromisoformat(retrieved_at).date():
                    issues.append("future_title_date_requires_verification")
                if "-" in item["season"]:
                    start, end = map(int, item["season"].split("-"))
                    if not date(start, 7, 1) <= title_date < date(end, 7, 1):
                        issues.append("title_date_outside_season_requires_verification")
            except ValueError:
                issues.append("invalid_title_date")
        if kind == "page":
            issues.append("requires_file_discovery")
        if item["title"].lower() == "article":
            issues.append("ambiguous_directory_label")
        entries.append({
            "directory_entry_id": sha256(f"{item['season']}|{item['url']}|{item['title']}".encode()).hexdigest()[:16],
            "source_id": sha256(f"{item['season']}|{item['url']}".encode()).hexdigest()[:16],
            "season": item["season"], "title": item["title"],
            "directory_url": DIRECTORY_URL, "entry_url": item["url"],
            "file_url": item["url"] if kind != "page" else None,
            "format_hint": kind, "title_date": title_date.isoformat() if title_date else None,
            "event_date": None, "status": "discovered", "last_modified": None,
            "issues": issues,
        })
    return {
        "schema_version": 1, "directory_url": DIRECTORY_URL, "retrieved_at": retrieved_at,
        "directory_sha256": sha256(html.encode()).hexdigest(),
        "seasons": parser.seasons, "entry_count": len(entries),
        "counts_by_season": dict(Counter(e["season"] for e in entries)),
        "counts_by_format": dict(Counter(e["format_hint"] for e in entries)),
        "entries": entries,
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--html", type=Path, help="Use a saved directory HTML file instead of downloading it.")
    cli.add_argument("--output", type=Path, default=Path("data/sources/inventory.json"))
    args = cli.parse_args()
    if args.html:
        html = args.html.read_text(encoding="utf-8")
    else:
        request = Request(DIRECTORY_URL, headers={"User-Agent": "USSRaceTracker/0.1 (source inventory)"})
        with urlopen(request, timeout=30) as response:
            html = response.read().decode("utf-8")
    result = build_inventory(html, datetime.now(timezone.utc).isoformat())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("entry_count", "counts_by_season", "counts_by_format")}, indent=2))


if __name__ == "__main__":
    main()
