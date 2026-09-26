# #1463 · concept RÉFÉRENCE — brief du lot R1-bis, commit 1 (2026-09-23)

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par #1466
ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept (L2/L3) et
gameOpRefFk.mjs ». Part de #1468 « [#1463 L1c] OPS par construction : OP_DEFS (102 ops → payloads composés,
refs EMBOÎTÉES) dérive gameOpSchema, applyOps, GameOpEditor et docs/vocabulaire-mecanique — fin du
looseObject qui accepte n'importe quelle op ». Épique : #1463.

Worktree : `/home/claude/game/.wt-1473-r1`, branche `chantier/1473-r1`, base `e639e4236` (lot R1 complet :
commits `662fd7ad0`, `b9eabfad4`, `6b19a74ee`, `e639e4236`). Chemins ABSOLUS dans ce worktree, jamais l'arbre
principal.

Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour une
structure plus adapté ».
Consigne de l'utilisateur, 2026-09-23 : « Dit leur de penser a intégrer les chantiers en cours qui sont en
rapport avec leur sujet et qui traine surement dans un worktree avec possiblement du travail en cours et non
fini. Si c'est le cas, surtout relire les tickets concernés mais aussi les commentaires ».
État mesuré de cette consigne (grounding du 2026-09-23 sur `e639e4236`, rendu d'agent, à recouper) : aucun
worktree monté hors `.wt-1473-r0` et `.wt-1473-r1` ; une seule branche distante en rapport,
`chantier/1456-choix` (`772a217cc`, 2026-08-23), dont le commentaire de #1456 du 2026-08-23T08:53:14Z dit :
« le preneur de #1463 le reprend ou le jette — la forme `{id, spec|choix, value}` est une PROPOSITION, pas le
schéma final ». Sa forme est déjà remplacée par `refOuSpec` (`grammaire/ref.ts:396-401`). Rien à y reprendre
pour ce commit ; si tu y trouves quelque chose qui touche ton périmètre, dis-le en sortie.

## Invariant

1. Verbatim : « Payload STRICT par op (`src/engine/ops.ts`, union `GameOp`). Chaque entrée est un contrat
   POSITIF vérifié sur toutes les occurrences réelles de l'op dans les 2 racines authorées. »
   Source : `src/data/schemas/grammaire/mecanique.ts:18-21` (JSDoc d'`OP_DEFS`).
   Question : que veut dire « typer une op » ? Déclarer son payload strict, que toute occurrence réelle des
   deux racines (`src/data`, `src/scenes`) valide.
2. Verbatim : « Une entrée ne se retire que par le commit qui TYPE l'op dans `OP_DEFS`. »
   Source : `mecanique.ts:111` (JSDoc d'`OPS_NON_TYPEES`).
   Question : quand une op sort-elle de l'inventaire ? Au commit qui la type.
3. Verbatim : « Un type s'ajoute avec le lot qui le migre, jamais « au cas où ». »
   Source : `src/data/schemas/grammaire/ref.ts:44` (JSDoc de `TYPES`).
   Question : quand un type d'entité entre-t-il au registre ? Avec le lot qui type ses références.
4. Le titre de #1473, cité ci-dessus : une référence est validée AU PARSE contre le registre d'ids. Une garde
   FK nominative qui couvre le même champ devient une deuxième source de vérité et meurt dans le même commit.

## Cas canonique déjà couvert

- Ops typées à référence : `corruptionExposure` (`mecanique.ts:31-36`, `refTestDeCorruption`),
  `removeTrait` / `domeWard` (`idDe('trait')`), `offTerrainMod` (`idDe('terrain')`), dans `OP_DEFS`
  (`mecanique.ts:22-103`), vérifiées par `src/data/schemas/grammaire/op-defs.test.ts`.
- Référence de Compétence : `refOuSpec('skill')` (`ref.ts:396-401`), aux sites `mecanique.ts:367`,
  `defs/etats.ts:26`, `defs/miscast.ts:70`. Liste de Compétences : `defs/crew-roles.ts:23`
  (`skills: z.array(refOuSpec('skill'))`).

Les nouveaux cas en sont des INSTANCES : une entrée d'`OP_DEFS` dont le champ Compétence est `refOuSpec('skill')`,
une liste de Compétences de météo écrite comme celle de `crew-roles`. Aucune branche par op dans un socle,
aucune primitive nouvelle.

## Design jugé : non requis, motivé

Ce commit applique le design du lot R1 jugé au run `wf_1fcddf84-798` (brief v1.1,
`/mnt/project-files/dettes/1463-r1-brief.md`), qui range « le typage des ops d'`OPS_NON_TYPEES` dans
`OP_DEFS` (lot R1-bis, part de #1468) » et `sea-weather` dans R1-bis (section « Hors lot », l.254-255). Il ne
modifie ni `ref.ts` hors l'ajout d'une ligne à `TYPES`, ni `descente.ts`, ni la mesure au parse. Si ton
travail t'oblige à toucher un socle au-delà, STOPPE et rapporte.

## Périmètre

1. **Typer dans `OP_DEFS`** les quatre ops `skillMod`, `skillDRBonus`, `castPenalty`, `grantCareerSkill`, et les
   retirer d'`OPS_NON_TYPEES` (`mecanique.ts:113+`). Types du moteur à refléter : `src/engine/ops.ts:949`
   (`skillMod`), `:960` (`skillDRBonus`), `:557` (`castPenalty`), `:615` (`grantCareerSkill`). Champ Compétence :
   `refOuSpec('skill')`. Formules : `formulaSchema`. Réutilise les schémas déjà nommés pour les autres champs
   (`PairedSense` a-t-il déjà un schéma ? cherche-le avant d'en écrire un).
2. **`skillDRBonus.testType`** désigne une entrée de `src/data/crew-test-types.json`
   (`scripts/guards/lib/gameOpRefFk.mjs:106` : `'skillDRBonus.testType': { registry: 'crewTestTypes' }`).
   Ajoute le type au registre `TYPES` (`ref.ts:46+`, une ligne) et type le champ par `idDe(<ce type>)`. Retire
   l'entrée `gameOpRefFk.mjs:106` dans le même commit.
3. **Couverture de test en double** : le commentaire `gameOpRefFk.mjs:103-104` renvoie la couverture des `skill`
   d'op à `src/data/refs-migrated.test.ts` « § ops à réf de Compétence ». Une fois ces quatre ops validées au
   parse, la part de ce test qui couvre les mêmes champs est une deuxième source de vérité : retire-la, mets le
   commentaire à jour, et prouve par mutation que le parse refuse à sa place (voir « Preuves »).
4. **Météo de mer** : `precipitations[].skillMods[]` (`src/data/schemas/defs/sea-weather.ts:63-72`) écrit une
   liste d'ids nus (`skills: z.array(z.string())`) plus un record `spec` keyé par id de Compétence
   (`{ "projectiles": "poudre-noire" }`). La forme canonique d'une liste de Compétences à spécialisation
   éventuelle est `z.array(refOuSpec('skill'))` (`crew-roles.ts:23`). Migre le schéma, `src/data/sea-weather.json`
   (5 entrées `skillMods`), le type `PrecipitationDef` et `precipitationSkillMod` (`src/engine/seaWeather.ts:55`,
   `:182-196`), et tous leurs autres consommateurs (cherche-les). Le record `spec` meurt. Relis au `Source/` les
   lignes que cite le code (`MDG 13 l.187-201`) et cite-les en sortie : la sémantique « le mod ne s'applique
   qu'à la spécialisation désignée » doit rester vraie. Le commentaire de tête `sea-weather.ts:8-11` décrit le
   record `spec` : il se réécrit en réf nue ou disparaît.
5. **Stocks** : re-mesure et mets à jour dans ce commit `SLOTS_SANS_DECLARATION` (`scripts/guards/lib/slotsStock.mjs`),
   `STRUCTURES_FORMES` et `STRUCTURES_ORPHELINES` (`scripts/guards/lib/structuresStock.mjs`),
   `HORS_STRATE_RATCHET` (`scripts/guards/lib/horsStrateStock.mjs`) et tout autre stock que tes changements
   font bouger. Chaque mouvement se dit en sortie : vraie sortie (le champ est déclaré et joint), ou
   reventilation (et vers quoi).
6. **Docs générés** : `npm run docs:build`, puis `node scripts/docs/build-all.mjs --empreinte` doit passer.
7. **Champ mort du lot R1** : `effectiveSeaM` (`src/state/seaVoyageFlow.ts:425-455`) rend un `label` que ses six
   appelants ne lisent pas (`:794`, `:805`, `:1317`, `:1847`, `:2074`, `:2473`, sonde de la recette du
   2026-09-23 recoupée par l'orchestrateur). Le commit `6b19a74ee` l'a migré sans le voir mort. Retire le champ et
   son calcul, les clés i18n qu'il est seul à lire (`sv.becalmed`, `sv.strikeSails` dans
   `src/i18n/messages/fr.ts` : sonde leurs autres lecteurs avant de les retirer), les imports devenus inutiles, et
   le cas de `src/state/sequence-parite-catalogue.test.ts:517-522`, dont le site affirme un id « rendu à
   l'écran » qui ne l'est pas. Les libellés de `windAspectSchema` restent : ils sont le vocabulaire affichable,
   et l'affichage de l'allure au joueur est ticketé en #1935.

Hors commit, à rapporter seulement : `augmentWeapon` (ses champs relèvent de la Qualité et de la catégorie
d'arme, et `TYPES` n'a pas de type `quality`) ; `sea-events.params` (`defs/sea-events.ts:33`, record non typé).

## Questions, réponse citée en sortie

a. Pour chacune des quatre ops : chaque clé observée sur toutes ses occurrences des deux racines, avec son
   compte, et le schéma que tu lui donnes. Les clés que le type du moteur déclare mais qu'aucune donnée ne porte :
   liste-les, avec le consommateur moteur qui les lit (`fichier:ligne`), ou « aucun » avec la sonde.
b. `refOuSpec('skill')` accepte le régime `choix`. Le type moteur `SkillRef` (`src/engine/skills.ts:237`) ne le
   porte pas. Une occurrence de ces quatre ops porte-t-elle `choix` ? Que fait le moteur d'un `choix` sur
   `skillMod` / `skillDRBonus` / `castPenalty` ? Si c'est un trou, il concerne toute la classe des sites
   `refOuSpec('skill')` d'effet : ne change pas `ref.ts`, rapporte la classe avec ses sites.
c. Autres sites qui désignent un type de Test d'équipage (`crew-test-types.json`) : liste-les avec leur typage
   actuel (`defs/flow-stakes.ts:47` et suivants). Lesquels passent à `idDe` dans ce commit (seulement les champs
   du périmètre), lesquels restent, et pourquoi.
d. `src/engine/ops.ts` : quelles ops portent encore une Compétence à plat (`skillId`) plutôt que `SkillRef` ?
   Liste seulement, pour #1468.
e. `augmentWeapon` et `sea-events.params` : formes observées, et le type de `TYPES` que chaque champ référent
   demanderait. Données seulement.

## Preuves par mutation (à toi, sur fichier temporairement muté puis restauré à l'empreinte identique)

Pour chaque champ nouvellement typé (Compétence de chaque op, `testType`, `skills` de la météo) : une valeur
d'id inconnue dans une occurrence réelle → le parse est rouge avec le message de la feuille ; restauration →
vert. Empreintes `sha256sum` avant, pendant et après, collées. Une mutation à la fois, restaurée avant la
suivante.

## Portes à jouer, sortie brute collée

- `npm run typecheck` en sortie complète.
- `npx vitest run src/data/schemas/grammaire src/data/structures-contrat.test.ts src/data/slots-contrat.test.ts
  src/data/grammaire-guard.test.ts src/data/refs-migrated.test.ts src/data/data-wellformed.test.ts
  src/comment-poison-guard.test.ts src/zod-retire-guard.test.ts src/state/sequence-parite-catalogue.test.ts
  src/state/sea-voyage-flow.test.ts src/i18n` plus les tests de `src/engine` qui
  touchent `seaWeather`, `skillMod`, `skillDRBonus`, `castPenalty`, `grantCareerSkill` (trouve-les par grep).
- `node --test scripts/hooks/stocks-nominatifs.test.mjs`.
- `node scripts/docs/build-all.mjs --empreinte` après `npm run docs:build`.

## Porte joueur (DoD)

Le mod de Précipitations atteint le joueur dans le scénario « Voyage maritime » (`docs/test-scenarios.md`
l.119), sur un Test d'équipage d'une journée pluvieuse. Dis en sortie quel geste l'atteint (fichier:ligne de
l'appel à `precipitationSkillMod`), pour la recette qui suivra.

## DoD mesurable

- `OPS_NON_TYPEES` : −4 entrées ; `OP_DEFS` : +4, chacune validée par toutes ses occurrences réelles.
- `TYPES` : +1 ligne ; `gameOpRefFk.mjs` : −1 entrée.
- `sea-weather` : le record `spec` n'existe plus (schéma, donnée, moteur).
- `effectiveSeaM` ne rend plus de `label` ; aucune clé i18n orpheline.
- Stocks re-mesurés, chaque mouvement expliqué.
- Portes vertes, sorties collées.

## Interdits et rendu

Interdit : `git checkout/restore/reset/stash/add/commit`, toute suppression récursive, toute édition de prose
source verbatim dans un JSON. Tu écris des fichiers ; l'orchestrateur gère git. Budget d'horloge : 2 heures ; à
l'échéance, rends ce qui est fait et NOMME le reste. Un livrable : le diff dans le worktree et le rapport.
Rendu final = données brutes, en français : fichiers touchés, réponses aux questions a à e avec citations,
mouvements de stocks, preuves par mutation, sorties des portes.
