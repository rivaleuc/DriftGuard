# DriftGuard

**A promise-accountability layer for crypto. Register what a whitepaper claims, then let AI validators measure how far reality has drifted.**

DriftGuard tracks whether crypto projects actually ship what their whitepapers promise. You register a project with its claims and live URL; anyone can then trigger a re-check, where GenLayer validators crawl the current site and score the gap between promise and delivery on a 0–100 drift scale. The verdict is reached by consensus, not by a single oracle — every validator independently fetches the page and must agree the score is well-formed before it lands on-chain.

- **Contract (Bradbury, chain 4221):** `0x319639B299C6f5559f4352E8620B64a89ea17559`
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0x319639B299C6f5559f4352E8620B64a89ea17559
- **Live app:** https://driftguard-6by.pages.dev

## What it does

The lifecycle runs across two write methods and two views on the `DriftGuard` contract:

1. **`register_project(name, whitepaper_claims, project_url)`** — stores a JSON record in the `projects: TreeMap[str, str]` keyed by an incrementing `project_count`, with `drift_score` initialised to `0` and `checks` to `0`. Returns the new key.
2. **`check_drift(key)`** — loads the project and runs the non-deterministic scan. The leader function calls `gl.nondet.web.render(proj["url"], mode="text")` to fetch the live page (truncated to 4000 chars), then `gl.nondet.exec_prompt(prompt, response_format="json")` to compare promises against current reality and emit `{"drift_score": <int 0-100>, "reasoning": "..."}`. Consensus is enforced by `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`, where `validator_fn` re-checks the leader's `gl.vm.Return` calldata and accepts only if `drift_score` is an integer in `[0, 100]`. The updated record (new score, reasoning, incremented `checks`) is written back to the TreeMap.
3. **`get_project(key)`** — view returning the full project record (or `{"exists": False}`).
4. **`stats()`** — view returning `{"total_projects": <int>}`.

A drift score of `0` means everything promised was delivered; `100` means nothing was.

## Why GenLayer

A deterministic EVM cannot do this. "Did they ship concentrated liquidity?" or "is the multi-chain deployment actually live?" are interpretive questions that require reading a live web page and comparing natural-language claims against it. There is no price feed or oracle for "promise drift."

GenLayer's Optimistic Democracy makes the subjective objective: the leader produces a candidate score, and independent validators each re-run the web fetch and LLM judgment, accepting the result only if it survives `validator_fn`. Disagreement triggers the appeal/consensus path rather than silently trusting one node.

Use GenLayer when the verdict depends on reading and judging unstructured, live, real-world data. Use a plain backend when the inputs are deterministic and you don't need trustless agreement on a subjective call.

## Architecture

| Contract (GenLayer) | Frontend | EVM / off-chain |
| --- | --- | --- |
| `scanner/drift_guard.py` | `scanner/app` (React + Vite) | none — pure GenLayer, web crawl happens inside the contract |

## Tech

- **GenVM Python**, pinned to `py-genlayer:1jb45aa8…jpz09h6` via the contract's `Depends` header. Storage uses `TreeMap[str, str]` (JSON-encoded records) and a `u256` counter.
- **Frontend** reads through `genlayer-js` (`createClient({ chain: testnetBradbury })` → `readContract`) and writes via **MetaMask without the snap** — the app calls `wallet_switchEthereumChain` / `wallet_addEthereumChain` directly to put the wallet on Bradbury (chain `4221`, hex `0x107d`) and signs with `writeContract`, waiting for a `FINALIZED` receipt.
- **UI:** React 19 + Vite + Tailwind v4, `framer-motion` for transitions and `sonner` for toasts. The app is a project dashboard: register a project, fire a drift check, and watch the 0–100 score with the validator's reasoning.

## Project structure

```
DriftGuard/
├── scanner/
│   ├── drift_guard.py        ← GenLayer contract (DriftGuard)
│   ├── index.html            ← standalone single-file demo
│   └── app/                  ← production frontend
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig*.json
│       ├── public/           ← favicon.svg, icons.svg
│       └── src/
│           ├── App.tsx       ← UI
│           ├── genlayer.ts   ← client, wallet, read/write helpers
│           ├── main.tsx
│           └── index.css
└── README.md
```

## Develop

```bash
cd scanner/app
npm install
npm run dev      # local dev server (Vite)
npm run build    # type-check + production build to dist/
```

## Deploy the frontend

Cloudflare Pages:

- **Root directory:** `scanner/app`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment:** `NODE_VERSION=20`

## Why GenLayer (engineering notes)

- **`run_nondet_unsafe` needs a strict validator.** The leader's JSON can be a dict or a string; `leader_fn` normalises with `json.dumps(raw) if isinstance(raw, dict)`. `validator_fn` only trusts a `gl.vm.Return` and re-parses `calldata`, rejecting any `drift_score` outside `[0, 100]` — otherwise a malformed leader response would corrupt the stored record.
- **Web fetches fail open.** `gl.nondet.web.render` is wrapped in try/except with a `"(fetch failed)"` fallback so a dead URL doesn't brick the transaction; the LLM still scores against whatever it has.
- **Everything is JSON in a TreeMap.** GenLayer storage holds the record as a serialized string; you must `json.loads` → mutate → `json.dumps` on every write. Forgetting the re-serialize is the classic foot-gun.
- **Page content is truncated** to 4000 chars before prompting to keep validator runs deterministic in cost and bounded in size.

## License

MIT
