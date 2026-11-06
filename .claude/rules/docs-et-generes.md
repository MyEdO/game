---
paths:
  - "docs/**"
  - "scripts/docs/**"
---

# Docs vivants et générés

- Dans toute prose (doc, brief, skill, définition d'agent, règle), une mention de suppression ne reste que si le piège survit à la suppression (un GESTE qui se recrée, jamais un identifiant) et n'est porté nulle part ailleurs. Sinon supprime-la, ou réécris-la en contrat positif au présent. `src/comment-poison-guard.test.ts` ne scanne que les commentaires.
- `npm run docs:check` ne rejoue pas les portes raw du job `docs` : après une retouche de `docs/raw/`, lance aussi `raw:check-ancres`, `raw:check-refs` et `raw:check-code-refs`.
- Une citation `fichier:ligne` d'un doc ou d'un manifeste doit porter son symbole à ±2 lignes (`scripts/corpus/docs/manual-docs-ratchet.test.mjs`, job `corpus`) : après une insertion de lignes dans un fichier cité, `git grep -n "<fichier>:[0-9]"`.
