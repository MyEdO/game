## Brief codeur — corrections du train 1, lot « ops à référence typées » (#1473), 2026-09-24

Worktree : `/home/claude/game/.wt-1473-r1`, branche `chantier/1473-r1`, tête `9f12595f6` (train 1, committé en
local, NON poussé). Budget d'horloge : 1 h 30. Un livrable : le diff non committé + le rendu ci-dessous. À
l'échéance, rends ce qui est fait et NOMME le reste.

Interdits : `git checkout/restore/reset/stash/add/commit/push`, suppression récursive, écriture hors du
worktree (sondes sous `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/corr-train1/`).
Ne lance pas la suite complète (le run CI de la branche la jouera) ; lance les fichiers de test du périmètre.

Entrées : brief du train 1 (https://github.com/cgauche/game/issues/1473#issuecomment-5806003115,
`/mnt/project-files/dettes/1463-ops-ref-train1-brief-codeur.md`), rendu du juge de diff (verdict FRAGILE, résumé
ci-dessous), sondes du juge sous `/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-train1/`.

## Invariant

Verbatim, commentaire A3 de `src/data/refs-migrated.test.ts` (train 1) : « un champ d'op à slot ne sort du scan
que si CHAQUE occurrence committée que le scan visite est une CASE validée par `idDe` au parse de mesure ».
Question à laquelle il répondait : quand un champ d'op peut-il quitter la garde de clés étrangères
(`scripts/guards/lib/gameOpRefFk.mjs`) ? Quand le parse le vérifie partout.

Défaut établi par le juge (sonde `juge-train1/sonde4.mts`, sortie collée) :
```
parse delayed{testMod exceptSkills fantome, giveTrapping fantome} => OK (accepte)
occurrencesASlot vues par A3 : ["fixture.json[0].ops[1].trappingId=objet-fantome"]
offenders FK : 0
```
Une valeur OBJET (`exceptSkills: [{ id }]`, un terme `{rule}` de `Formula`) d'une op placée sous un conteneur
non typé échappe au parse, à A3 (qui ne voit que les chaînes) et au scan. La question juste n'est pas « chaque
chaîne est-elle un slot ? » mais « chaque nœud d'op est-il atteint par le parse ? ».

## Cas canonique déjà couvert

A4 du train 1 : les conteneurs `perRound` et `rollThreshold` ont été typés (`OP_DEFS`,
`src/data/schemas/grammaire/mecanique.ts`) pour que leurs ops soient parsées. Le nouveau cas en est une
instance : typer tout conteneur d'ops, pas ajouter une branche au scan.

Mesure de l'orchestrateur (sonde `scratchpad/sonde-conteneurs.mts`, corpus `src/data` + `src/scenes`, ops
imbriquées sous une op d'`OPS_NON_TYPEES`) :
```
2 augmentWeapon   (ex. spells.json[73].effects.steps[0].effect.ops[0].onHitEffects[0].flow.effect.ops[0])
5 delayed         (ex. spells.json[420].effects.steps[0].fail.effect.ops[0].ops[1])
1 grantWeapon     (ex. spells.json[88].effects.steps[0].effect.ops[0].onHitEffects[0].flow.effect.ops[0])
3 zone            (ex. spells.json[137].effects.steps[1].effect.ops[0].perRound[0])
```
(colonne 1 : nombre de couples conteneur › op distincts). À re-mesurer par le parse, pas à croire.

## Design jugé :

Juge de diff du train 1, 2026-09-24, verdict FRAGILE (1 bloquant T1, 5 non bloquants T2-T6). Corrections
retenues par l'orchestrateur :

1. **T1 (bloquant).** Réécrire A3 en « TOUT nœud `GameOp` du corpus (`scanDuCorpus`) est atteint par le parse
   de mesure », quelle que soit son op et quelle que soit la forme de ses valeurs. La mesure se fait AU PARSE, par
   le mécanisme de mesure existant (`reperesDuParse`, `slotsDuParse`, `scripts/docs/lib/slots-registre.mts`,
   `src/data/schemas/grammaire/ref.ts`), jamais par un proxy statique (« aucun ancêtre dans `OPS_NON_TYPEES` »).
   Question en sortie : comment le parse marque-t-il un nœud d'op atteint, sans ajouter de chemin au parse
   normal ? Typer ensuite dans `OP_DEFS` chaque conteneur que ce test nomme (attendus : `delayed`, `zone`,
   `augmentWeapon`, `grantWeapon`), membre par membre sur l'union `GameOp` de `src/engine/ops.ts`. Les champs
   de qualité (`addQualities`, `removeQualities`, `qualities`) et de groupe d'arme (`subType`) restent des
   `z.string()` gardés par `GAMEOP_FIELD_TARGETS` : aucun type `quality` n'entre à `TYPES` (règle
   `ref.ts:39` « Un type s'ajoute avec le lot qui le migre, jamais « au cas où » » ; le concept Qualité est un
   autre lot). Si typer un conteneur ouvre une question de design (un champ sans forme évidente, une union
   ambiguë), ARRÊTE-toi sur ce conteneur et rends la question.
   Dire en sortie si la jointure « chaîne ↔ slot » de l'ancien A3 garde une utilité une fois le nouvel
   invariant posé (une op typée atteinte par le parse a toutes ses feuilles `idDe` jugées), et la supprimer
   sinon.
   Preuve par mutation exigée : la fixture de `sonde4.mts` (un `delayed` qui porte un `testMod` à
   `exceptSkills` fantôme) promue en test, rouge avant, verte après ; un conteneur retypé en loose rougit le
   test sur son chemin.
2. **T2.** `src/data/data-wellformed.test.ts` : la famille 5 restante (`grantTrait.traitId`,
   `condition`/`removeCondition.id`, `:108-109`) doublonne `GAMEOP_FIELD_TARGETS`, sur un corpus plus étroit
   (`listerDossier`, sans `miscast.json`) que le scan (`scanDuCorpus`, 128 documents). Retirer la famille 5
   entière, sa contre-épreuve (`:190-195`) et sa ligne d'en-tête. Garde de synchronisation : credo « Une garde de
   synchronisation est un smell : une seule source de vérité. »
3. **T3.** `testMod.exceptSkills` : le schéma (`refOuSpec('skill')`) admet `spec` et `choix`, le lecteur
   (`src/engine/conditions.ts:611`) compare le seul `id`. Le texte (`LDB 16 l.52`, « autres que ceux
   impliquant la course ou la dissimulation ») exempte des Compétences entières. Passer à
   `z.array(ref('skill'))` (`{ id }` strict, `ref.ts:282-287`), et le type moteur à la même forme. Aucune
   migration de donnée (`etats.json` porte déjà `{ id }`).
4. **T4.** Lecteurs des valeurs réservées en littéral : `src/state/combatFlow.ts:6091` lit `SELF_REF` ;
   `src/ui/compendium/humanize.ts:93` lit `INDICE_TEMPLATE` ; `scripts/guards/lib/registryIdBranch.mjs:112`
   (`OP_VOCABULARY = new Set(['', 'self'])`) : dire ce que ce vocabulaire sert et si `'self'` y a encore un
   sens, puis lire la constante ou retirer l'entrée. `combatFlow.ts:6091` replie sur `actor.label` quand l'acteur
   n'a pas de `creatureId` : c'est un libellé pris pour un id (doctrine « Toute LOGIQUE est keyée par id STABLE,
   le `label` est de l'AFFICHAGE », CLAUDE.md). Établir en sortie, citations à l'appui, quels porteurs peuvent
   programmer une `scheduleRespawn` à `SELF_REF`, puis retirer le repli : refus nommé si l'acteur n'a pas de
   `creatureId`, test à l'appui.
5. **T5.** En-tête de `GAMEOP_FIELD_TARGETS` (`gameOpRefFk.mjs`) : nommer le lot qui tue chaque reste, les ops
   de `OPS_NON_TYPEES` (L1c #1468) et les types absents de `TYPES` (R2 de #1473). `OP_REF_FIELDS`
   (`src/ui/editor/GameOpEditor.tsx:579-608`) n'est PAS dans ce train : l'orchestrateur le ticket.
6. **Signaux du pre-commit** sur `src/engine/conditions.ts` (fichier touché par le train) : `:484` et `:642`
   (« revendication d'autorité sans trace », arbitrage maison), `:724` (« hardcode réactif par-nom »,
   `hasCondition(c, 'naufrage')`). Pour chacun : ouvre le `Source/` cité, dis ce qui est RAW et ce qui est
   arbitrage, et corrige si la correction est locale (réf nue, id par constante). Si c'est un arbitrage maison à
   rendre éditable, ne le refais pas : rends le constat avec `fichier:ligne` et la citation.
7. **T6** : pas de changement. `summon.ref` reste `idDe('creature')` (contrat de l'op, `ops.ts`, et ancienne
   cible `{ registry: 'creatures' }` de la garde) ; arbitrage d'ingénierie révisable du 2026-09-24.

Tests à jouer en plus des 21 fichiers du train 1 : `GameOpEditor.minimum`, `etat-porte`, `tables.test`,
`parse-de-mesure.test`, `formes-partagees.test` (ils importent `OP_DEFS`/`gameOpSchema`), et `npm run
docs:check`.

## Rendu (données brutes)

- `git diff --stat` collé ; le diff fichier par fichier en une ligne chacun.
- Chaque preuve par mutation : empreinte avant, mutée, après ; sortie rouge puis verte collées.
- Sorties brutes : tests du périmètre, `npm run typecheck:fast`, `npm run docs:build` puis
  `node scripts/docs/build-all.mjs --empreinte`, `npm run docs:check`.
- Réponses aux questions posées aux points 1, 4 et 6, citations à l'appui.
- Lignes `CLIQUET:` (commande de mesure + avant → après), dont `OPS_NON_TYPEES`.
- Poison hors périmètre rencontré (`fichier:ligne`), reste nommé.
