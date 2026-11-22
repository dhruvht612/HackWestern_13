"""Parse npm manifests. Uploaded files are data: never executed, never installed."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

EXACT_VERSION = re.compile(r"^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
SUPPORTED = ("package.json", "package-lock.json")
MAX_PACKAGES = 5000


class ManifestError(ValueError):
    """The upload isn't a supported, well-formed manifest."""


@dataclass(frozen=True)
class Package:
    name: str
    version: str  # exact version when resolved, otherwise the declared range
    direct: bool
    resolved: bool
    dev: bool = False


def _name_from_lock_path(path: str) -> str:
    # "node_modules/a/node_modules/@scope/b" -> "@scope/b"
    return path.rsplit("node_modules/", 1)[-1]


def _parse_lock(doc: dict) -> list[Package]:
    packages: dict[tuple[str, str], Package] = {}
    if isinstance(doc.get("packages"), dict):  # lockfile v2 / v3
        root = doc["packages"].get("", {})
        direct = set(root.get("dependencies", {})) | set(root.get("devDependencies", {})) | set(root.get("optionalDependencies", {}))
        for path, meta in doc["packages"].items():
            if not path or not isinstance(meta, dict) or "node_modules/" not in path or meta.get("link"):
                continue
            name, version = _name_from_lock_path(path), str(meta.get("version", ""))
            if version:
                top_level = path.count("node_modules/") == 1
                packages[(name, version)] = Package(name, version, top_level and name in direct, True, bool(meta.get("dev")))
    elif isinstance(doc.get("dependencies"), dict):  # lockfile v1
        def walk(deps: dict, depth: int) -> None:
            for name, meta in deps.items():
                if isinstance(meta, dict) and meta.get("version"):
                    version = str(meta["version"])
                    packages.setdefault((name, version), Package(name, version, depth == 0, True, bool(meta.get("dev"))))
                    walk(meta.get("dependencies") or {}, depth + 1)
        walk(doc["dependencies"], 0)
    else:
        raise ManifestError("package-lock.json has neither 'packages' nor 'dependencies'")
    return list(packages.values())


def _parse_package_json(doc: dict) -> list[Package]:
    out: list[Package] = []
    for section, dev in (("dependencies", False), ("devDependencies", True), ("optionalDependencies", False)):
        for name, spec in (doc.get(section) or {}).items():
            spec = str(spec).strip()
            exact = bool(EXACT_VERSION.match(spec))
            # A range ("^4.17.0") says what may be installed, not what is: keep it unresolved.
            out.append(Package(name, spec.lstrip("v") if exact else spec, True, exact, dev))
    return out


def parse_manifest(filename: str, content: bytes) -> list[Package]:
    base = filename.replace("\\", "/").rsplit("/", 1)[-1].lower()
    if base not in SUPPORTED:
        raise ManifestError("Upload package.json or package-lock.json")
    try:
        doc = json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ManifestError(f"{base} is not valid JSON") from exc
    if not isinstance(doc, dict):
        raise ManifestError(f"{base} must be a JSON object")
    packages = _parse_lock(doc) if base == "package-lock.json" else _parse_package_json(doc)
    if len(packages) > MAX_PACKAGES:
        raise ManifestError(f"Too many packages ({len(packages)}); the limit is {MAX_PACKAGES}")
    return sorted(packages, key=lambda p: (not p.direct, p.name))
