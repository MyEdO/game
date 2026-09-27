---
name: env-cliquet-porteur-avant-commit-pre-commit-aveugle
description: "Toute entrée ajoutée à un PORTEUR de stock (baseline JSON, *Stock.mjs, scripts/hooks/*.json) exige sa ligne CLIQUET au message AVANT le commit — le pre-commit laisse passer, test:hooks sur la plage poussée rougit et fait sauter toutes les gates suivantes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c95432bf-a32b-458a-8974-aa68a2923b3c
  modified: 2026-09-14T19:55:23.303Z
---

Une entrée de plus dans un porteur de stock nominatif (`scripts/guards/lib/decisions-baseline.json`, `scripts/guards/lib/*Stock.mjs`, `scripts/hooks/*.json`, `scripts/raw/*-stock.json`…) est une CROISSANCE que la porte de plage `croissanceDesStocks` (`scripts/guards/lib/stocksNominatifs.mjs`) exige déclarée par `CLIQUET: <fichier> +N — <motif>` dans le message du commit qui la porte.

**Why:** le pre-commit ne juge PAS la plage (il n'a pas de commit) ; c'est `scripts/hooks/stocks-nominatifs.test.mjs` « la PLAGE POUSSÉE ne fait grossir aucun stock en silence », joué par la gate `test:hooks` de `ops:publier`, qui rougit — et toutes les gates suivantes sont sautées. Le message d'un commit sous un commit de docs ne se répare pas sans reconstruire la pile (rebase interactif bloqué : reset doux sur la base, recommit par chemins avec les messages sauvegardés).

**How to apply:** avant tout commit, `git diff --cached --stat` sur les porteurs ; chaque porteur qui grandit reçoit sa ligne `CLIQUET:` (motif ≥ 20 caractères, y compris une entrée de baseline qui ne fait que reconnaître un site préexistant). Voir [[env-garde-memoire-harnais-gates-serie-detachees]].

**Complément (revue de palier `cd9bb3299..9d66de88f`, 2026-09-18, grief 4) :** le PLAFOND vit souvent AILLEURS que le magasin — dans un `.test.ts` de contrat (`src/data/structures-contrat.test.ts`, `slots-contrat.test.ts`, `migrations-type-enveloppe.test.ts`, `registry-enveloppe.test.ts`) — et la plage ne le détecte pas : une ligne `CLIQUET:` par FICHIER dont un cran bouge, plafond compris, sinon `git log --grep=CLIQUET -- <fichier>` ne rend rien pour un cran documenté « REMONTÉ ». Un plafond ne se relève que si le réel le DÉPASSE (relever « pour accompagner » une entrée qui tient sous l'existant reconduit un mou : grief 3, `STRUCTURES_DEFAUT` 27 → 28 redescendu). Et un message ne cite jamais le SHA d'un commit de branche NON PUBLIÉE (le rebase de publication le réécrit : `296965162` cité au train C n'existait plus après rebase — grief 1) : citer une empreinte de fichier ou le SHA d'`origin/main`.
