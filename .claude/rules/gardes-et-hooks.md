---
paths:
  - "scripts/guards/**"
  - "scripts/hooks/**"
  - "scripts/git-hooks/**"
  - ".claude/settings.json"
  - ".codex/hooks.json"
  - "knip-exports-baseline.json"
---

# Gardes, hooks, stocks et cliquets

- Édite un fichier de `scripts/hooks/` ou `scripts/guards/lib/` sur une COPIE au scratchpad, passe `node --check`, puis recopie-le. Un module qui ne se charge plus fait refuser par la barrière tout outil de l'arbre, hors lectures (Read, `ctx_read`, `ctx_search`…). `scripts/hooks/barriere-outil.mjs:68-69` `.claude/settings.json:26` #2606
- Arbre bloqué par une garde cassée : donne à l'utilisateur une commande `!` COURTE (le terminal coupe les longues lignes), ou demande-lui de supprimer les lignes dans l'éditeur. Ne fais jamais réparer par une autre session. #2606
- Un stock nominatif est une DETTE vers zéro, jamais un registre : retire l'entrée, ou porte la règle dans le socle pour qu'aucune entrée ne soit nécessaire. N'ouvre jamais de stock neuf (#1176) : une classe de défaut trouvée se corrige à ZÉRO dans le chantier, sous une garde ABSOLUE (sans liste) ; trop gros, c'est un ticket, pas un registre. Une garde qui EXIGE un contournement est une rustine : remonte à la cause. `scripts/guards/lib/stocksNominatifs.mjs:1068-1072`
- Élargir une garde, c'est migrer ce qu'elle révèle.
- Avant de proposer une garde contre une classe de contournement, cherche la STRUCTURE qui la rend incompilable (module, exports minimaux, types) ; une garde seulement là où la structure ne peut pas porter l'invariant, en le disant. Doctrine « structure avant garde » (`docs/doctrines.md`).
- Les gardes FK, orphelins et consommateurs (`scripts/guards/lib/integriteStock.mjs`, `scripts/guards/lib/tableConsumerAudit.ts`) résolvent contre l'index des ids : `.claude/rules/donnees.md`.
- Une directive qui redéfinit un invariant (qui contrôle, qui possède, ce qui compte comme X) re-juge dans le même lot les exemptions STRUCTURELLES accordées sous l'ancien. Grep les exclusions de principe des scanners et juge-les une à une : reconfirmée, elle se re-date ; caduque, elle devient le stock du lot suivant (#1728). `scripts/guards/lib/rollSeamExclusivity.mjs:141` (`isWorldDie`)
- Avant de juger l'utilité d'une garde, mesure ce qui l'a déclenchée ET ce que l'utilisateur en a fait, jamais un simple compte. Une garde qui n'a rien arrêté de réel se supprime, sans conversion en `deny`.
- Ne déduis jamais l'arbre visé du texte d'une commande : `~/.claude/projects/<slug>/memory` est une jonction vers `Game/.claude/memory`. #2125
- Un chantier perf sur une suite de gardes ou de tests commence par son profil PAR ÉTAPE (énumération, lecture, parse, visite, constructeur), mesuré en JSON, avant de nommer la cause. Chaque hypothèse du brief porte sa sonde discriminante ; tout gain se mesure en A/B ALTERNÉ.
- Une mémoïsation partagée entre fichiers exige un arbre scanné statique pendant le run (écrivain unique nommé) et un prix de rétention par worker chiffré. Sinon, elle reste intra-fichier et paresseuse.
