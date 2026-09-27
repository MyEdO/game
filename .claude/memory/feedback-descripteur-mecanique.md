---
name: feedback-descripteur-mecanique
description: "Un descripteur dans une donnée (« petit », « de qualité », « féroce ») référence souvent un TRAIT ou une RÈGLE — le vérifier au RAW avant de le traiter en saveur"
metadata:
  type: feedback
---

**Règle :** avant de traiter un mot de descripteur comme de la saveur, vérifier au RAW s'il nomme un trait (`Taille`, `Vitesse`…) ou une règle (qualité de fabrication, état).
**Why:** droper un descripteur mécanique est une perte de règle silencieuse ; re-keyer vers une entité distincte est tout aussi faux — le bon modèle est le trait ou la règle SUR la référence existante.
**How to apply:** modéliser par trait sur la ref, ou par Atout au registre (`qualities`/`qualityChoice` de la référence d'objet, `src/data/schemas/grammaire/reference.ts`, matérialisés par `buildInventory`/`qualityInstance` de `src/engine/items.ts`, qui préservent la `value`) ; chercher au bestiaire et au catalogue par LABEL + synonymes, jamais par préfixe d'id seul.
