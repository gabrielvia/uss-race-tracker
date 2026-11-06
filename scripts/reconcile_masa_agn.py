"""Inspect or apply the explicitly reviewed MASA/AGN identity pairs; never infer new pairs."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, build_opener
from .check_site import SameOriginRedirectHandler, credentials, validate_origin


def reconcile(origin, secret, review, apply=False, save=None):
    pairs = review["pairs"]
    if len(pairs) != 32 or len({p["participantKey"] for p in pairs}) != 32 or len({p["targetParticipantKey"] for p in pairs}) != 32:
        raise ValueError("Use the complete reviewed set of 32 unique source/target pairs.")
    def request(path, body=None, operator=False):
        headers = {"Content-Type": "application/json"}
        if secret.get("service_token"):
            headers["OAI-Sites-Authorization"] = "Bearer " + secret["service_token"]
        if operator:
            headers["Authorization"] = "Bearer " + secret["seed_token"]
        req = Request(origin + path, headers=headers, data=json.dumps(body).encode() if body is not None else None)
        with build_opener(SameOriginRedirectHandler()).open(req, timeout=60) as response:
            return json.load(response)
    heads = {}
    for cid, expected_hash in [("st-masa-2026", review["sourceHash"]), ("st-agn-2026", review["targetHash"])]:
        detail = request("/api/competitions/" + cid)
        evidence = request("/api/sources/" + detail["competition"]["source_id"])
        if evidence["roster"]["sha256"] != expected_hash:
            raise ValueError("The active source revision differs from the reviewed identity evidence.")
        heads[cid] = request("/api/imports?" + urlencode({"competition": cid}), operator=True)
    def current(key):
        return request("/api/identity?" + urlencode({"participant": key}), operator=True)["link"]
    keys = [key for p in pairs for key in [p["targetParticipantKey"], p["participantKey"]]]
    with ThreadPoolExecutor(max_workers=6) as pool:
        links = dict(zip(keys, pool.map(current, keys), strict=True))
    decisions = []
    for pair in pairs:
        source_key, target_key = pair["participantKey"], pair["targetParticipantKey"]
        target_id = sha256(("competition-skater|" + target_key).encode()).hexdigest()[:20]
        if links[target_key]["skater_id"] != target_id:
            raise ValueError("An anchor already has another reviewed identity; inspect it before changing this pair.")
        for key, name, club in [(target_key, pair["displayName"], pair["targetAffiliation"]), (source_key, pair["sourceName"], pair["sourceAffiliation"])]:
            link = links[key]
            allowed = {target_id, sha256(("competition-skater|" + key).encode()).hexdigest()[:20]}
            if link["current_name"] != name or link["current_affiliation"] != club or link["status"] not in {"reviewed", "competition-local"} or link["skater_id"] not in allowed:
                raise ValueError("A reviewed participant's name, affiliation or identity has changed.")
            if link["batch_id"] != heads[key.split(":")[0]]["baseBatchId"]:
                raise ValueError("The publication changed during identity review.")
            if link["status"] == "reviewed" and link["skater_id"] == target_id:
                continue
            decisions.append({"participantKey": key, "expectedRevision": link["revision"], "expectedBatchId": link["batch_id"],
                              "skaterId": target_id, "reviewer": "Codex source review, user correction November 4, 2026",
                              "reason": review["basis"] + " " + pair["displayName"] + ": " + pair["gender"] + "; " + pair["sourceAffiliation"] + " / " + pair["targetAffiliation"] + ".",
                              "evidence": [review["sourceUrl"] + "#page=" + str(pair["sourcePages"][0]), review["targetUrl"] + "#page=" + str(pair["targetPages"][0])]})
    result = {"version": review["version"], "reviewedPairs": len(pairs), "plannedDecisions": len(decisions), "applied": [], "readOnly": not apply, "publicationHeads": heads}
    if save:
        save(result)
    if apply:
        for decision in decisions:
            recorded = request("/api/identity", decision, operator=True)
            if not recorded.get("recorded"):
                raise ValueError("The identity decision was not recorded.")
            result["applied"].append({"participantKey": decision["participantKey"], "decisionId": recorded["id"]})
            if save:
                save(result)
        with ThreadPoolExecutor(max_workers=6) as pool:
            after = dict(zip(keys, pool.map(current, keys), strict=True))
        for pair in pairs:
            a, b = after[pair["participantKey"]], after[pair["targetParticipantKey"]]
            if a["skater_id"] != b["skater_id"] or a["status"] != "reviewed" or b["status"] != "reviewed":
                raise ValueError("The published identity pair did not read back as reviewed.")
        for cid, before in heads.items():
            if request("/api/imports?" + urlencode({"competition": cid}), operator=True) != before:
                raise ValueError("A publication head changed during identity reconciliation.")
        result["verified"] = True
        if save:
            save(result)
    return result


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", required=True)
    cli.add_argument("--review", type=Path, default=Path("data/sources/masa-agn-identity-review.json"))
    cli.add_argument("--apply", action="store_true", help="Record the explicit reviewed decisions through the protected API.")
    cli.add_argument("--report", type=Path, required=True)
    args = cli.parse_args()
    def save(result):
        args.report.write_text(json.dumps(result, indent=2) + "\n")
    result = reconcile(validate_origin(args.url), credentials(), json.loads(args.review.read_text()), args.apply, save)
    print(json.dumps({k: v for k, v in result.items() if k not in {"applied", "publicationHeads"}}))


if __name__ == "__main__":
    main()
