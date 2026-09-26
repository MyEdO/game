# #1473 · R1-bis, corrections du juge (2026-09-24)

Worktree : `/home/claude/game/.wt-1473-r1`, branche `chantier/1473-r1`, base `fc7b527fb` (R1-bis commit 1, arbre
propre). Chemins ABSOLUS dans ce worktree. Brief parent : `/mnt/project-files/dettes/1463-r1bis-brief.md`
(invariant, cas canonique, design : inchangés). Verdict du juge de diff : TIENT, 0 bloquant ; ce train solde
les trois trouvailles de son périmètre.

## Périmètre

1. **`grantReverseToken` typée.** Le filet de `src/data/refs-migrated.test.ts:386-411` ne garde que cette op,
   dont l'unique occurrence réelle (`src/data/activities.json:1585`) ne porte pas de `skill` : il ne parcourt
   aucune référence réelle. Type du moteur : `src/engine/ops.ts:565`
   (`{ op: 'grantReverseToken'; skill?: SkillRef }`). Type-la dans `OP_DEFS`
   (`src/data/schemas/grammaire/mecanique.ts`) avec `refOuSpec('skill')` comme les quatre ops du commit 1,
   retire-la d'`OPS_NON_TYPEES`, et supprime le filet, sa liste et son contrôle positif s'il ne reste aucune op
   loose à référence de Compétence (question a). Mets à jour `scripts/guards/lib/gameOpRefFk.mjs:103-105`.
2. **`skillDRBonus` en OU exclusif.** Les données portent `skill` seul (58) ou `testType` seul (2), jamais aucun
   des deux ni les deux (mesure du juge). Une op sans l'un ni l'autre est inerte au moteur (`ops.ts:248`,
   `navalTraits.ts:118`). Écris le schéma et le type moteur (`ops.ts:960`) en union des deux formes, et
   adapte les consommateurs qui ne compileraient plus.
3. **JSDoc `mecanique.ts:108-110`** (`testType` hors registre) : elle cite le ticket qui porte la classe,
   #1473 (lot suivant : sous-listes à ids des documents `config`).
4. Stocks et docs générés re-mesurés si ces gestes les font bouger ; `npm run docs:build`, puis
   `node scripts/docs/build-all.mjs --empreinte`.

## Questions, réponse citée en sortie

a. Après le typage de `grantReverseToken`, reste-t-il une op d'`OPS_NON_TYPEES` dont le type moteur porte une
   Compétence (`SkillRef`, `skill`, `skills`, `skillId`) ? Sonde sur `src/engine/ops.ts`, sortie collée.
b. Pour l'union de `skillDRBonus` : quel message d'erreur le parse rend-il pour une op qui porte les deux clés,
   et pour une op qui n'en porte aucune ? Est-il lisible pour un auteur ?

## Preuves par mutation (à toi, fichier muté puis restauré à l'empreinte identique)

- `grantReverseToken` : ajouter `skill: { id: 'id-fantome' }` à l'occurrence réelle → parse rouge → restauré.
- `skillDRBonus` : une occurrence réelle avec `skill` ET `testType`, puis sans aucun des deux → parse rouge à
  chaque fois → restauré.
Empreintes `sha256sum` avant, pendant, après, collées.

## Portes, sortie brute collée

- `npm run typecheck:fast`.
- `npx vitest run src/data/schemas/grammaire src/data/refs-migrated.test.ts src/data/grammaire-guard.test.ts
  src/data/structures-contrat.test.ts src/data/slots-contrat.test.ts src/data/data-wellformed.test.ts
  src/comment-poison-guard.test.ts` plus les tests de `src/engine` et `src/state` qui touchent `skillDRBonus`
  et `grantReverseToken` (trouve-les par grep).
- `node --test scripts/hooks/stocks-nominatifs.test.mjs`.

## Interdits et rendu

Interdit : `git checkout/restore/reset/stash/add/commit`, toute suppression récursive. Budget d'horloge :
45 minutes ; à l'échéance, rends ce qui est fait et NOMME le reste. Un livrable : le diff et le rapport.
Rendu final = données brutes, en français : fichiers touchés, réponses a et b, mouvements de stocks, preuves
par mutation, sorties des portes, sonde `git -C /home/claude/game status --short`.
