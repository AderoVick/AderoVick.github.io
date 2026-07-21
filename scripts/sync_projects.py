#!/usr/bin/env python3
"""Synchronize the public project catalogue from GitHub repositories.

The script reads repository metadata from GitHub, then merges optional
`project.json` files and local overrides. It writes data/projects.json.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
GITHUB_USER = os.getenv("GITHUB_USER", "AderoVick")
TOKEN = os.getenv("GITHUB_TOKEN", "")
API_VERSION = os.getenv("GITHUB_API_VERSION", "2022-11-28")


def request_json(url: str, *, optional: bool = False) -> Any:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "aderovick-project-sync/1.0",
        "X-GitHub-Api-Version": API_VERSION,
    }
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        if optional and exc.code == 404:
            return None
        raise RuntimeError(f"GitHub request failed ({exc.code}) for {url}") from exc
    except urllib.error.URLError as exc:
        if optional:
            return None
        raise RuntimeError(f"Could not reach GitHub for {url}: {exc.reason}") from exc


def list_repositories() -> list[dict[str, Any]]:
    repositories: list[dict[str, Any]] = []
    page = 1
    while True:
        url = f"https://api.github.com/users/{GITHUB_USER}/repos?per_page=100&page={page}&sort=updated"
        batch = request_json(url)
        if not batch:
            break
        repositories.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return repositories


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def project_metadata(repo: dict[str, Any]) -> dict[str, Any]:
    branch = repo.get("default_branch") or "main"
    raw_url = f"https://raw.githubusercontent.com/{GITHUB_USER}/{repo['name']}/{branch}/project.json"
    metadata = request_json(raw_url, optional=True)
    return metadata if isinstance(metadata, dict) else {}


def inferred_website(repo: dict[str, Any]) -> str:
    if repo.get("homepage"):
        return str(repo["homepage"]).strip()
    if repo.get("name", "").lower() == f"{GITHUB_USER}.github.io".lower():
        return f"https://{GITHUB_USER.lower()}.github.io/"
    if repo.get("has_pages"):
        return f"https://{GITHUB_USER.lower()}.github.io/{repo['name']}/"
    return ""


def normalise_topics(*values: Any) -> list[str]:
    topics: list[str] = []
    for value in values:
        if isinstance(value, str) and value.strip():
            topics.append(value.strip())
        elif isinstance(value, list):
            topics.extend(str(item).strip() for item in value if str(item).strip())
    result: list[str] = []
    for item in topics:
        if item not in result:
            result.append(item)
    return result[:6]


def build_catalogue() -> list[dict[str, Any]]:
    overrides = read_json(DATA_DIR / "project-overrides.json", {})
    existing = {item.get("repo"): item for item in read_json(DATA_DIR / "projects.json", [])}
    projects: list[dict[str, Any]] = []
    for repo in list_repositories():
        if repo.get("fork") or repo.get("archived"):
            continue
        name = repo["name"]
        metadata = project_metadata(repo)
        override = overrides.get(name, {})
        previous = existing.get(name, {})
        merged = {**previous, **metadata, **override}
        title = merged.get("title") or name.replace("-", " ").replace("_", " ").title()
        summary = merged.get("summary") or repo.get("description") or "Open-source project and technical documentation."
        website = merged.get("websiteUrl") if "websiteUrl" in merged else inferred_website(repo)
        app_url = merged.get("appUrl", "")
        topics = normalise_topics(merged.get("topics"), repo.get("topics"), repo.get("language"), merged.get("category"))
        projects.append({
            "repo": name,
            "title": title,
            "summary": summary,
            "category": merged.get("category") or "Open Source",
            "language": repo.get("language") or merged.get("language") or "",
            "topics": topics,
            "websiteUrl": website or "",
            "appUrl": app_url or "",
            "repoUrl": repo.get("html_url") or f"https://github.com/{GITHUB_USER}/{name}",
            "updatedAt": repo.get("pushed_at") or repo.get("updated_at"),
            "status": merged.get("status") or ("Live" if website or app_url else "Source available"),
            "featured": bool(merged.get("featured", False)),
            "stars": int(repo.get("stargazers_count") or 0),
        })
    projects.sort(key=lambda item: (not item["featured"], item.get("updatedAt") or ""), reverse=False)
    featured = sorted((item for item in projects if item["featured"]), key=lambda item: item.get("updatedAt") or "", reverse=True)
    other = sorted((item for item in projects if not item["featured"]), key=lambda item: item.get("updatedAt") or "", reverse=True)
    return featured + other


def main() -> int:
    try:
        projects = build_catalogue()
    except Exception as exc:  # noqa: BLE001
        print(f"Project sync failed: {exc}", file=sys.stderr)
        return 1
    output = DATA_DIR / "projects.json"
    rendered = json.dumps(projects, indent=2, ensure_ascii=False) + "\n"
    if output.exists() and output.read_text(encoding="utf-8") == rendered:
        print(f"Project catalogue is already current ({len(projects)} projects).")
        return 0
    output.write_text(rendered, encoding="utf-8")
    print(f"Updated {output.relative_to(ROOT)} with {len(projects)} projects.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
