"""Assemble a roster and complete selected-event files into one competition item."""
import argparse
import json
from pathlib import Path

if __package__:
    from .prepare_web_sample import prepare_item
else:
    from prepare_web_sample import prepare_item


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--metadata", type=Path, required=True, help="Reviewed competition metadata JSON.")
    cli.add_argument("--roster", type=Path, required=True)
    cli.add_argument("--events", type=Path, nargs="+", required=True, help="Each file must contain one complete selected event.")
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    try:
        item = prepare_item(json.loads(args.metadata.read_text()), json.loads(args.roster.read_text()),
                            [json.loads(path.read_text()) for path in args.events])
    except (ValueError, KeyError, OSError) as error:
        cli.error(str(error))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(item, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"assembled": True, "events": len(item["evidence"]["events"]), "results": len(item["results"]), "published": False}))


if __name__ == "__main__":
    main()
