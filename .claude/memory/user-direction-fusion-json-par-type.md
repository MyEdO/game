---
name: user-direction-fusion-json-par-type
description: "N fichiers pour N instances d'un même système se fusionnent en UNE collection à discriminant"
metadata:
  type: user
---

**Verbatim (2026-09-01)** : « Si a terme on peu fusionner des .json et juste rajouter un "type" pour des systèmes similaires »

**Why :** N fichiers = N defs qui recopient l'enveloppe, N lecteurs et N graphies — la divergence par manque de rigueur.
**How to apply :** devant « système similaire en N fichiers », la cible par défaut est la fusion dans la collection existante la plus peuplée + un discriminant (`kind`, jamais un `type` de document ; patron des documents de `miscast.json` lus par id, `rangeesDe`, `src/data/rangees.ts`), avec un lecteur unique par id et une seule surface d'édition au Codex ; un train de socle prépare la fusion, il ne la remplace pas.
