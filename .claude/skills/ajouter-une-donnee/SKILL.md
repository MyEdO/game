---
name: ajouter-une-donnee
description: À utiliser quand on ajoute ou cure une entrée dans un src/data/*.json (trapping, qualité, carrière, machine de guerre, trait naval, activité, critique, lieu…), ou dès qu'on est tenté d'ajouter un id/label sans avoir vérifié qu'il existe déjà ailleurs. Route vers le skill de domaine dédié si l'ajout est un sort, une créature, un effet mécanique, une icône ou un livre.
---

# Ajouter une donnée dans src/data

Lire **`docs/ajouter-une-donnee.md`** (déroulé) et **`docs/donnees.md`** (carte + conventions + pièges
d'homonymes). En un mot :

1. **CHECK-FIRST** : `grep -rniE '<id>|<label>|<concept>' src/data/*.json` — un même concept vit souvent
   déjà dans un AUTRE sous-système (un bélier est à la fois trapping, machine de guerre et action). S'il
   existe → ne duplique pas : étends-le ou re-scope. Cherche par LABEL et synonymes, jamais par préfixe
   d'id. Un descripteur (« petit », « de qualité », « féroce ») se vérifie au RAW : s'il nomme un trait
   (`Taille`, `Rapide`…) ou une règle, il se modélise SUR la référence (trait, ou Atout
   `qualities`/`qualityChoice`, `src/data/schemas/grammaire/reference.ts`, matérialisé avec sa `value`
   par `qualityInstance`, `src/data/index.ts`), jamais par une entité distincte.
2. **Router** : si c'est un sort / une créature / un effet mécanique / une icône / un livre → STOP, skill
   de domaine dédié. Sinon, choisir le fichier via la carte `docs/donnees.md` (une « machine de guerre »
   n'est PAS un trapping).
3. **Chaque champ = Source RAW ⊕ convention voisine** — jamais d'invention, jamais d'inflexion RAW
   silencieuse (ticket ou valeur `maison` taguée).
4. **Canonicaliser via `serializeDataset`** + `npm run typecheck:fast` + `npm run test:perimetre` verts (suite et typecheck complets : CI de
   branche) ; recette navigateur
   si visible au Codex.
