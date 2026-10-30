"""Copy unignored web source and its verified build to the isolated Sites checkout.

Open the Sites source repository at outputs/site-source before running this tool.
This preserves its Git history separately from the GitHub development repository.
"""
from pathlib import Path
import json
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def prepare():
    source = ROOT / "web"
    target = ROOT / "outputs/site-source"
    if not (target / ".git").exists():
        raise ValueError("Open the Sites source checkout before copying publication files.")
    manifest = json.loads((source / ".openai/hosting.json").read_text())
    existing_manifest = target / ".openai/hosting.json"
    if existing_manifest.exists() and json.loads(existing_manifest.read_text()).get("project_id") != manifest.get("project_id"):
        raise ValueError("The publication checkout belongs to a different Site.")
    names = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "web"], cwd=ROOT).decode().split("\0")
    files = sorted({str(Path(name).relative_to("web")) for name in names if name})
    previous_file = ROOT / "outputs/site-source-files.json"
    previous = json.loads(previous_file.read_text()) if previous_file.exists() else []
    for name in set(previous) - set(files):
        stale = target / name
        if stale.is_file(): stale.unlink()
    for name in files:
        original = source / name
        if original.is_symlink() or not original.is_file():
            raise ValueError(f"Publication source must be a regular file: {name}")
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, destination)
    if not (source / "dist/server/index.js").exists():
        raise ValueError("Build web/ before preparing the publication checkout.")
    shutil.copytree(source / "dist", target / "dist", dirs_exist_ok=True)
    previous_file.write_text(json.dumps(files, indent=2) + "\n")
    print(f"Prepared {len(files)} source files and the verified build in outputs/site-source.")


if __name__ == "__main__":
    prepare()
