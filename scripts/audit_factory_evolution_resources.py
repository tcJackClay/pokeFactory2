#!/usr/bin/env python3
"""Check every fixed Rogue evolution target against the game's Go content proxy."""

import argparse
import concurrent.futures
import json
import re
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RELATIONS = ROOT / "src/features/game/config/factoryEvolutionRelations.generated.ts"


def check(slug: str, base_url: str) -> dict[str, object]:
    url = f"{base_url.rstrip('/')}/api/pokeapi/pokemon/{slug}"
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.load(response)
        return {"slug": slug, "status": 200, "kind": "pokemon", "actualName": payload.get("name"), "speciesUrl": payload.get("species", {}).get("url")}
    except urllib.error.HTTPError as error:
        if error.code == 404:
            form_url = f"{base_url.rstrip('/')}/api/pokeapi/pokemon-form/{slug}"
            try:
                with urllib.request.urlopen(form_url, timeout=30) as response:
                    form = json.load(response)
                base_name = form.get("pokemon", {}).get("name")
                if not base_name:
                    return {"slug": slug, "status": "invalid-form-resource"}
                with urllib.request.urlopen(f"{base_url.rstrip('/')}/api/pokeapi/pokemon/{base_name}", timeout=30) as response:
                    base = json.load(response)
                return {
                    "slug": slug,
                    "status": 200,
                    "kind": "pokemon-form",
                    "actualName": form.get("name"),
                    "baseName": base_name,
                    "baseResourceName": base.get("name"),
                    "speciesUrl": base.get("species", {}).get("url"),
                }
            except urllib.error.HTTPError as form_error:
                return {"slug": slug, "status": form_error.code, "kind": "pokemon-form"}
        return {"slug": slug, "status": error.code}
    except Exception as error:  # report the exact unavailable resource without inventing a relation
        return {"slug": slug, "status": "unavailable", "reason": str(error)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3001")
    args = parser.parse_args()
    relations = RELATIONS.read_text(encoding="utf-8")
    sources = re.findall(r"fromSlug: '([^']+)'", relations)
    targets = re.findall(r"toSlug: '([^']+)'", relations)
    if len(sources) != 94 or len(targets) != 94:
        raise SystemExit(f"Expected 94 relations, got {len(sources)} sources and {len(targets)} targets")
    slugs = sorted(set(sources + targets))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda slug: check(slug, args.base_url), slugs))
    failed = [result for result in results if result["status"] != 200
              or result.get("actualName") != result["slug"]
              or not result.get("speciesUrl")
              or (result.get("kind") == "pokemon-form" and result.get("baseName") != result.get("baseResourceName"))]
    passing = {str(result["slug"]) for result in results if result not in failed}
    print(json.dumps({"relations": len(targets),
                      "usableRelations": sum(source in passing and target in passing for source, target in zip(sources, targets)),
                      "resources": len(results), "passedResources": len(results) - len(failed),
                      "formOnly": [result["slug"] for result in results if result.get("kind") == "pokemon-form"],
                      "failed": failed}, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
