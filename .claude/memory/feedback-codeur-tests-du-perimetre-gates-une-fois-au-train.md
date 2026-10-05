---
name: feedback-codeur-tests-du-perimetre-gates-une-fois-au-train
description: "Localement, un codeur ne joue que les tests de SON périmètre (lecteurs du symbole, cliquets, gardes de racine, migrations) ; les gates et suites entières se jouent UNE fois, au train / en CI — jamais dans le brief ni en local"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fcb6a280-87dc-4980-95ca-97561d13d0f6
  modified: 2026-09-15T19:02:00.276Z
---

**Verbatim utilisateur (2026-09-15)** : « C'est absurde ... on a dépêché un agent pour créer un fichier (+ son test, + le lien pour l'appeler) et ça va nous prendre 25 min ? »
Consigne utilisateur relayée (2026-09-17) : « ce sont les opérations `npm` locales (npm ci, typecheck, lint, docs:build, suites) qui font ramer »

**Why:** le train de publication et la CI de branche jouent déjà lint, knip, `docs:check`, suites et
gates ; les rejouer en local double le coût, sature une machine partagée et n'ajoute aucune preuve.

**How to apply:** un brief codeur ne demande que `npm run typecheck:fast` (si du `.ts` bouge) et les
tests de son PÉRIMÈTRE, dérivé des LECTEURS du symbole touché (`git grep <symbole>`), jamais d'une
liste de dossiers habituelle :
- l'arbre du fichier touché lui-même ;
- les cliquets : dataset ou schéma neuf/renommé → `npm test -- src/data` entier ;
- un `.test.` écrit → gardes de racine `npm test -- src/*-guard.test.ts` lancées par le tool Bash
  (PowerShell ne développe pas le glob : aucune garde ne tourne) ; exiger le compte ;
- un module de `scripts/` importé par une migration, ou `scripts/migrations/**` →
  `npm run migrations:replay:head` et `migrations:replay:croissance`.
Jamais `npm test` nu ni `npm run gates` en local ; gate du train rouge → train COURT. Voir [[user-doctrine-chantier-outille-sans-reinventer]] et
[[env-charge-machine]].
