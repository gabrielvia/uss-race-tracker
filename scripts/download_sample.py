"""Download one inventoried public PDF and record its response metadata."""

import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from urllib.request import Request, urlopen


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--source-id", required=True)
    cli.add_argument("--inventory", type=Path, default=Path("data/sources/inventory.json"))
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    inventory = json.loads(args.inventory.read_text())
    source = next((item for item in inventory["entries"] if item["source_id"] == args.source_id), None)
    if not source or source["format_hint"] != "pdf":
        cli.error("Choose a PDF source ID from the inventory")
    request = Request(source["file_url"], headers={"User-Agent": "USSRaceTracker/0.1 (source validation)"})
    with urlopen(request, timeout=45) as response:
        limit = 50 * 1024 * 1024
        data = response.read(limit + 1)
        if len(data) > limit:
            cli.error("The PDF exceeds the 50 MiB sampling limit")
        if not data.startswith(b"%PDF-"):
            cli.error("The response is not a PDF; no sample was saved")
        metadata = {
            "source_id": args.source_id, "source_url": source["file_url"],
            "resolved_url": response.url, "http_status": response.status,
            "content_type": response.headers.get("Content-Type"),
            "last_modified": response.headers.get("Last-Modified"),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "sha256": sha256(data).hexdigest(), "size_bytes": len(data),
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(data)
    args.output.with_suffix(".metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(data)} bytes to {args.output}; SHA-256: {metadata['sha256']}")


if __name__ == "__main__":
    main()
