# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *

class DriftGuard(gl.Contract):
    projects: TreeMap[str, str]
    project_count: u256

    def __init__(self):
        self.project_count = u256(0)

    @gl.public.write
    def register_project(self, name: str, whitepaper_claims: str, project_url: str) -> str:
        key = str(int(self.project_count))
        project = {"name": str(name).strip(), "claims": str(whitepaper_claims).strip()[:2000], "url": str(project_url).strip(), "drift_score": 0, "last_check": "", "checks": 0}
        self.projects[key] = json.dumps(project)
        self.project_count += u256(1)
        return key

    @gl.public.write
    def check_drift(self, key: str) -> None:
        key = str(key)
        if key not in self.projects: raise Exception("unknown")
        proj = json.loads(self.projects[key])
        verdict = self._scan(proj)
        proj["drift_score"] = verdict["drift_score"]; proj["last_check"] = verdict["reasoning"]; proj["checks"] += 1
        self.projects[key] = json.dumps(proj)

    def _scan(self, proj):
        def leader_fn() -> str:
            page = "(fetch failed)"
            if proj["url"].startswith("http"):
                try: page = gl.nondet.web.render(proj["url"], mode="text")[:4000]
                except: pass
            prompt = f"""Compare whitepaper promises vs current reality.\nPROMISES:\n{proj['claims']}\nCURRENT PAGE:\n{page}\n\nScore drift 0-100 (0=all delivered, 100=nothing).\nReply JSON: {{"drift_score": <int>, "reasoning": "<brief>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            return json.dumps(raw) if isinstance(raw, dict) else str(raw).strip()
        def validator_fn(r) -> bool:
            if not isinstance(r, gl.vm.Return): return False
            try: d = json.loads(r.calldata); return isinstance(d.get("drift_score"), int) and 0 <= d["drift_score"] <= 100
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
