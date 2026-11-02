---
paths:
  - "src/engine/**"
  - "src/state/**"
  - "src/noyau/**"
  - "src/net/**"
---

# Moteur et flux de state

- Avant d'ajouter un champ, un drapeau ou une capacité à une op ou à une entité, lis ses champs : lequel le dit déjà ? Un drapeau ou une capacité neuve est suspect par défaut. Un cas propre à un porteur d'un concept général est un trou de socle à remonter, jamais une garde de donnée. `src/engine/ops.ts`, `docs/vocabulaire-mecanique.md`
- Mesure une duplication à une question : un appelant peut-il VIOLER l'invariant ? Si oui, extrais la primitive ET retire le geste optionnel qui permettait la faute (le paramètre devient la valeur déjà résolue, la fonction ne re-tire rien). `docs/doctrines.md` (verrou par construction)
- Porte un système combat-only hors combat en rendant `battle`-nullable le flux EXISTANT, jamais par un flux parallèle ; un fichier dédié n'est admis que s'il ne réutilise que des résolveurs purs, sans logique d'effet à copier : `actorIn`/`inBattleId`, `touchActors`, sortie unique `finishPlayerAction`. `src/noyau/monde/combatants.ts` `src/noyau/combatOrParty.ts` `src/noyau/combatFlow.ts`
- Un adversaire ou un participant est une ENTITÉ À FICHE (compétences, effets, bourse, États) ; une valeur nue n'est qu'une forme SUPPLÉMENTAIRE pour les figurants, jamais la seule. Une valeur nue trouvée à sa place se résorbe dans le chantier courant (#1318).
- Portée, adjacence, empreinte et surbrillance d'un cavalier se mesurent sur la géométrie de sa MONTURE ; un résultat nul ferme la cascade d'attaque. `combatGeomOf` `attackGeomOf` `src/noyau/mount.ts:75`
- Seule une monture chevauchée à Trait Nerveux perd son tour propre (`isControlledMount`). `src/noyau/mount.ts:37`, LDB 14 l.182
