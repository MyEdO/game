# #1463 · concept RÉFÉRENCE — brief du lot R2 commit 2, v1 (2026-09-24) : `sea-events.params` typé par `kind`

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par #1466
ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept (L2/L3) et
gameOpRefFk.mjs ». Épique : #1463. Voisins : #1652 « Dés EN CHAÎNE : 61 valeurs « 1d10 »/« d100 » invisibles au
stock, 3 parseurs (rollExpr + 2 recopies dans le store, l'une d10 en dur), ≥11 params de sea-events sans
consommateur (angle mort de la vague de #1463) » ; #1939 « [RAW/naval] Événements de mer : 24 natures tombent au
narratif, et le moteur code en dur des valeurs que sea-events.json porte déjà ».

Worktree : `/home/claude/game/.wt-1473-r1`, branche `chantier/1473-r1`, tête `9cf3308af` (CI verte). Grounding :
rendu de lecteur du 2026-09-24 (51 `kind`, clés et types observés, lecteurs par `kind`, sondes d'inclusion),
recoupé par l'orchestrateur sur `seaVoyageFlow.ts:2344-2349` (`eventParam`), `:2539-2560` (`chance-navigateur`,
`rafale-ghyran` codés en dur) et sur `#1652`.

Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour une
structure plus adapté ».

## Invariant

1. Verbatim (brief R1 v1.1 de #1473, https://github.com/cgauche/game/issues/1473#issuecomment-5801354411) :
   « **Toute vérification d'un id contre le registre, sous `src/data/schemas`, passe par `idDe`.** »
   Question à laquelle il répondait : où une référence à une entité se déclare-t-elle ? Sur une feuille `idDe`.
   Portée ici : `params.talent`, `params.skills[]`, `params.ship`, `params.crewRef`, `params.chefRef` désignent
   des entités de datasets déjà typés dans `TYPES` (`talent`, `skill`, `vehicle`, `creature`,
   `src/data/schemas/grammaire/ref.ts:46-78`), aujourd'hui en `z.unknown()`.
2. Verbatim (`.claude/skills/orchestrer-des-agents/SKILL.md`, § Brief) : « Un lot qui touche un CHAMP embarque
   TOUTES les conventions de ce champ. »
   Question à laquelle elle répondait : quand un lot touche un champ, jusqu'où va-t-il ? Jusqu'à toutes ses
   conventions : ici les dés en chaîne de `params` (concept `de`, `diceSpecSchema`
   `src/data/schemas/grammaire/valeurs.ts:524-525`, `{n, sides, plus?}`), et le parseur local qui les lit.
3. Verbatim (`CLAUDE.md`, règle 3) : « **Le moteur (`src/engine`) reste pur et testé.** Store, UI et rendu en
   dépendent, jamais l'inverse. »
   Question : où vit le tirage d'un dé ? Au moteur (`rollExpr`, `src/engine/dice.ts:98`, et le lanceur de
   `DiceSpec`). `eventParam` (`src/state/seaVoyageFlow.ts:2344-2349`, regex `/(\d+)d10/` au d10 en dur) et
   `rollDiceExpr` (`:2001`) sont des recopies DANS LE STORE.
4. Verbatim (credo, `.claude/credo.md`) : « **Règles GÉNÉRALES, jamais spécifiques.** Corriger la classe entière du
   problème, pas le cas rencontré. Une garde de synchronisation est un smell : une seule source de vérité. »
   Question : qui porte la valeur d'un événement ? La donnée. `rafale-ghyran` (`:2553-2557`, trois
   `skillDRBonus` +2 en dur) et `chance-navigateur` (`:2544`, `'chanceux'` en dur) doublent `params.skills`,
   `params.drBonus`, `params.talent`.

## Cas canonique déjà couvert

Payload typé par discriminant, membres stricts : `spellRangeSchema`, `spellTargetSchema`, `spellDurationSchema`
(`src/data/schemas/defs/spells.ts:28-50`), `z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal(…), … })])`,
miroir du type moteur (`engine/spellRange.ts`, `engine/spellDuration.ts`). `OP_DEFS`
(`src/data/schemas/grammaire/mecanique.ts`) est l'autre forme (carte + `superRefine` + repli nominatif
`OPS_NON_TYPEES`), justifiée par 110 ops dont une partie non typée ; ici les 51 `kind` sont finis et tous
observés.

Le nouveau cas en serait une INSTANCE du premier : `seaEventDef` devient une union discriminée par `kind` de
membres stricts, chacun portant ses `params` stricts ; le type moteur `SeaEventDef`
(`src/engine/seaVoyage.ts:36-44`) devient l'union jumelle ; `switch (event.kind)` du store gagne l'exhaustivité.
À juger : instance, ou faut-il `OP_DEFS` (carte) parce que des natures sont « narratives » sans payload ?

## Design proposé (à attaquer)

- **D1.** `seaEventDef` → `z.discriminatedUnion('kind', …)`, un membre strict par `kind` (51), champs communs
  (`plage`, `id`, `label`, `desc`, `source`) partagés ; `params` strict par membre, clés = celles observées
  (rendu de lecteur, § 2). Les natures sans clé ont `params` absent ou `{}` (à trancher, une seule forme).
- **D2.** Désignateurs → `idDe` : `talent` → `idDe('talent')` ; `skills[]` → `refOuSpec('skill')` (forme canonique
  de la référence de Compétence depuis R1, migration des ids nus en `{ id }`) ; `ship` → `idDe('vehicle')` ;
  `crewRef`, `chefRef` → `idDe('creature')`. `testType` (→ `crew-test-types.json › types[]`) et les colonnes
  météo (`visibilite`, `precipitations`, `temperature`, `vents` → colonnes de `sea-weather.json`) restent en
  `z.string()` : leurs cibles n'ont pas d'emplacement au registre avant R2 v2 de #1473. Fossile de transition,
  inscrit au registre des fossiles de #1463, tué par R2 v2.
- **D3.** Dés en chaîne de `params` (≈ 40 occurrences sur 61 de #1652) → `diceSpecSchema` (ou `formulaSchema` si
  une clé admet nombre OU dé — à mesurer par clé). `eventParam` et `rollDiceExpr` meurent : le store lit le
  payload typé et tire par le moteur.
- **D4.** Le store lit le payload typé : plus de cast au site (`as Difficulty`), plus de valeur en dur qui double
  une clé présente (`rafale-ghyran`, `chance-navigateur`, et chaque cas du § 3 du rendu où le `case` existe et
  fixe sa propre valeur). Les clés d'une nature SANS `case` (24 natures) restent typées et non lues : leur
  implémentation est #1939.
- **D5.** Critère : une nature de plus = un membre de l'union (schéma) + un membre du type moteur + son `case`.

## Questions posées au jugement

1. D1 : union discriminée à 51 membres, ou carte `kind → params` (forme `OP_DEFS`) ? Laquelle rend l'éditeur
   du Compendium (formulaire inféré, `src/ui/compendium/editFields.ts:28-53`) capable de proposer les clés d'une
   nature neuve ?
2. D2 : le fossile `z.string()` de `testType` et des colonnes météo est-il acceptable, ou le lot doit-il attendre
   R2 v2 ? Aujourd'hui aucune garde ne vérifie ces valeurs (sonde à faire : `gameOpRefFk.mjs` ne couvre que les
   ops).
3. D3 : quelles clés sont des dés, lesquelles des nombres, lesquelles admettent les deux ? Le « jours : 1d10 » de
   `days` est-il un dé ou une formule ? Et `lostCrew`, `ransomCO` ? Chaque verdict cite la ligne du `Source/`
   (MDG ch.15, l.132-263).
4. D4 : chaque valeur en dur du store qui double une clé : laquelle est juste au livre, la donnée ou le code ?
   (Sonde au `Source/`, pas au code.)
5. Chevauchement : ce lot solde-t-il la part `sea-events` de #1652 (points 2 et 4) ? Que reste-t-il à #1652 et à
   #1939 après lui, nommément ?
6. `SeaEventDef` a un second lecteur : le Codex (`src/ui/compendium/registry.ts:868-871`). Un écran change-t-il ?

## Périmètre (fichiers que le codeur peut toucher)

- `src/data/schemas/defs/sea-events.ts`, `src/data/sea-events.json` (migration des dés et des ids nus de
  Compétence, par script sous `scripts/migrations/` daté, selon la convention du dépôt).
- `src/engine/seaVoyage.ts` (type `SeaEventDef`), `src/state/seaVoyageFlow.ts` (lecteurs, mort d'`eventParam` et
  `rollDiceExpr`), `src/ui/compendium/registry.ts` si le type l'exige.
- Tests : `src/state/sea-voyage-flow.test.ts`, `src/scenes/test-scenarios/14-voyage-maritime.test.ts`, tests de
  schéma voisins ; stocks et cliquets que la migration fait bouger (lignes `CLIQUET:`).
- Hors périmètre : `scripts/gen-registry.mjs`, `src/data/schemas/grammaire/ref.ts` (train 2e-f1 de #1897 en
  cours) ; les autres porteurs de dés en chaîne de #1652 (`river-perils`, `sea-navigation`,
  `steam-breakdown`, `problemes-vehicule`, `ship-criticals`, `sea-cargo`, `arcane-phenomena`).
