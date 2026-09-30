---
name: env-revue-palier-tete-publiee-jamais-locale
description: "Revue de palier : sa tête de fenêtre est le dernier commit PUBLIÉ (origin/main après fetch), jamais un commit local du chantier — il n’est pas publié, la publication entre sur main par un commit de FUSION, et la revue devient orpheline ; une session parallèle peut archiver la même fenêtre pendant le jugement"
metadata:
  node_type: memory
  type: feedback
---

La tête de fenêtre d'une revue de palier est `origin/main` après `git fetch`, jamais un sha local du
chantier : ce sha n’est pas sur `main` — `ops:publier` y entre par un commit de FUSION (`fusion^2` = la
tête de la branche, scripts/ops/etapesDuTrain.mjs), seul sha de `main` —, le fichier nomme alors une histoire absente
(`revuePalier.mjs` : « une revue dont la tête de fenêtre est ORPHELINE (rebase) se ré-écrit sur sa
fenêtre réelle ») et le train doit être arrêté puis relancé sans le doublon.

**Why:** `mesureDuPalier` compte depuis la dernière revue dont la tête est ANCÊTRE de HEAD ; deux
sessions qui jugent la même fenêtre produisent deux archives pour un seul palier, et la seconde ne peut
pas entrer dans l'histoire.

**How to apply:** avant de dépêcher le juge de palier : `git fetch origin`, puis `mesureDuPalier`
(`ops:faits-de-palier -- --base <tête de la dernière revue> --tete <origin/main>`) ; si une revue de
la fenêtre existe déjà sur `origin/main` ou sur un chantier voisin, ne pas en écrire une seconde ; le
lot en cours se juge à part, hors fenêtre, et son jugement va aux soldes, pas au nom du fichier. Voir
[[env-coordination-sessions]].
