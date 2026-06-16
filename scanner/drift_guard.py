# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *


def _coerce_int(value, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def severity_band(drift_score: int) -> str:
    """Deterministic band: low if <34, medium if <67, else high."""
    if drift_score < 34:
        return "low"
    if drift_score < 67:
        return "medium"
    return "high"


def normalize_drift_verdict(data: dict) -> dict:
    """Clamp drift_score to [0,100] and DERIVE the severity band from it."""
    drift = max(0, min(100, _coerce_int(data.get("drift_score"), 0)))
    reasoning = str(data.get("reasoning") or "").strip() or "no reasoning provided"
    return {
        "drift_score": drift,
        "severity": severity_band(drift),
        "reasoning": reasoning,
    }


def validate_drift_verdict(data: dict) -> bool:
    """Deterministic anchor: drift range + severity == band(drift_score)
    + non-empty reasoning."""
    drift = data.get("drift_score")
    if not isinstance(drift, int) or isinstance(drift, bool):
        return False
    if drift < 0 or drift > 100:
        return False
    severity = data.get("severity")
    if severity not in ("low", "medium", "high"):
        return False
    if severity != severity_band(drift):
        return False
    reasoning = data.get("reasoning")
    if not isinstance(reasoning, str) or not reasoning.strip():
        return False
    return True

class DriftGuard(gl.Contract):
    projects: TreeMap[str, str]
    project_count: u256

    def __init__(self):
        self.project_count = u256(0)

    @gl.public.write
    def register_project(self, name: str, whitepaper_claims: str, project_url: str) -> str:
        key = str(int(self.project_count))
        project = {"name": str(name).strip(), "claims": str(whitepaper_claims).strip()[:2000], "url": str(project_url).strip(), "drift_score": 0, "severity": "low", "last_check": "", "checks": 0}
        self.projects[key] = json.dumps(project)
        self.project_count += u256(1)
        return key

    @gl.public.write
    def check_drift(self, key: str) -> None:
        key = str(key)
        if key not in self.projects: raise Exception("unknown")
        proj = json.loads(self.projects[key])
        verdict = self._scan(proj)
        proj["drift_score"] = verdict["drift_score"]; proj["severity"] = verdict["severity"]; proj["last_check"] = verdict["reasoning"]; proj["checks"] += 1
        self.projects[key] = json.dumps(proj)

    def _scan(self, proj):
        def leader_fn() -> str:
            page = "(fetch failed)"
            if proj["url"].startswith("http"):
                try: page = gl.nondet.web.render(proj["url"], mode="text")[:4000]
                except: pass
            prompt = f"""Compare whitepaper promises vs current reality.\nPROMISES:\n{proj['claims']}\nCURRENT PAGE:\n{page}\n\nScore drift 0-100 (0=all delivered, 100=nothing).\nReply JSON: {{"drift_score": <int>, "reasoning": "<brief>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            data = raw if isinstance(raw, dict) else json.loads(str(raw).strip())
            return json.dumps(normalize_drift_verdict(data))
        def validator_fn(r) -> bool:
            if not isinstance(r, gl.vm.Return): return False
            try: return validate_drift_verdict(json.loads(r.calldata))
            except: return False
        return json.loads(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))

    @gl.public.view
    def get_project(self, key: str) -> dict:
        key = str(key)
        if key not in self.projects: return {"exists": False}
        return json.loads(self.projects[key])

    @gl.public.view
    def stats(self) -> dict:
        return {"total_projects": int(self.project_count)}
