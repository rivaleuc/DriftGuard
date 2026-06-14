# DriftGuard

DriftGuard is a promise accountability layer on GenLayer. It monitors whether crypto projects deliver what their whitepapers promise. Register a project with its claims and URL, then periodically check drift. AI validators fetch the current project page and score how much reality has diverged from promises.

## Why GenLayer

Comparing whitepaper promises against current reality is pure interpretation. "Concentrated liquidity" — did they ship it? "Multi-chain deployment" — is it actually live? AI validators fetch the project's current state and judge the gap between promise and delivery. No oracle can provide a "promise drift" score — this requires reading, understanding, and comparing natural language claims against live web data.

## Deployed

**GenLayer (Bradbury):** `0x319639B299C6f5559f4352E8620B64a89ea17559`

## Structure

```
DriftGuard/
├── scanner/
│   ├── drift_guard.py  ← GenLayer contract
│   └── index.html      ← Frontend
└── .gitignore
```
