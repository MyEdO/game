## Design du train 2a3, v2 — règles d'acquisition d'un Talent déclarées sur son entrée (#1473, #1463, #1621), 2026-09-24

Train du lot « ops à référence typées » (#1473), après 2a2 (`chantier/1473-t2`, arbre de `.wt-1473-t2`, HEAD
`6a55a5d7c`). Remplace la v1 (`/mnt/project-files/dettes/1463-train2a3-maxi-brief.md`), jugée RÉFUTÉE par
`juge-design-socle` (run `wf_4221222e-d3f`, 8 bloquants dont 1 structurel ; verdict complet
`/tmp/claude-0/-home-claude-game/9b4a8164-2f4a-5715-8cac-1eec5a598091/scratchpad/juge-maxi/verdict.json`). La v1 faisait
de Magie des Arcanes une branche du verdict ; Magie du Chaos a la même forme, et le livre imprime aussi un coût fixe et
des exclusions entre Talents. La v2 remonte d'un niveau : ce qui borne l'acquisition d'un Talent est une DÉCLARATION de
son entrée, lue par un seul verdict sans branche par Talent.

## Invariant

Verbatims lus au `Source/` le 2026-09-24 (`Source/Warhammer v4 - Livre de base version corrigee/`).

1. `LDB 10 l.17` : « **Nom du Talent (utilisation) :** la dénomination du Talent. S'il y a des parenthèses, le mot à
   l'intérieur décrit une utilisation que le Talent influence. » `LDB 10 l.18` : « **Maxi :** cela indique le nombre
   maximum d'acquisitions de ce Talent, en général 1 ou un Bonus de Caractéristique associée. »
   Question : sur quoi se compte le Maxi ? Sur le Talent, toutes parenthèses confondues, sauf là où son entrée dit
   autre chose.
2. `LDB 10 l.548` (Haine (Groupe)) : « Chaque fois que vous prenez ce Talent, vous développez une certaine haine envers
   un nouveau groupe. » Question : deux groupes font-ils deux acquisitions du même Talent ? Oui.
3. `LDB 10 l.696-698` (Magie des Arcanes (Domaine), Maxi : 1, `l.682`) : « Dans des conditions normales, vous ne pouvez
   pas apprendre plus d'un Talent Magie des Arcanes (Domaine). De plus, vous ne pouvez pas apprendre les Talents Béni
   ou Invocation quand vous possédez le Talent Magie des Arcanes. »
   Question : qu'est-ce qui borne l'acquisition de Magie des Arcanes, et que défend-elle ? Un seul Domaine « dans des
   conditions normales » ; elle défend d'apprendre Béni ou Invocation à qui la possède.
4. `LDB 46 l.177` (« MULTIPLES DOMAINES MAGIQUES ») : « Si vous êtes un elfe, vous pouvez apprendre un nombre de Domaines
   magiques égal à votre Bonus de Force Mentale. […] Vous ne pouvez pas acheter un nouveau **Talent Magie des Arcanes**
   avant de maîtriser le précédent en ayant acquis au moins 20 Améliorations dans la Compétence Focalisation de votre
   Domaine, et appris au moins 8 Sorts s'y rapportant. D'autre part, n'importe quel Sorcier peut apprendre un seul
   Domaine sombre en plus d'un autre Domaine […]. »
   Question : quelles conditions lèvent la borne d'un seul Domaine ? Celles-ci : le nombre de Domaines et la condition
   d'achat du suivant ; chaque Domaine reste sous le Maxi 1.
5. `LDB 10 l.625` (Invocation (Savoir divin), Maxi : 1) : « Dans des conditions normales, vous ne pouvez pas apprendre
   plus d'un Talent Invocation (Savoir divin). De plus, vous ne pouvez pas apprendre les Talents Magie mineure ou Magie
   des Arcanes quand vous possédez le Talent Invocation. »
   Question : que défend Invocation ? D'apprendre Magie mineure ou Magie des Arcanes à qui la possède. Le texte ne dit
   pas l'inverse, et le code ne l'invente pas.
6. `LDB 10 l.704` (Magie du Chaos (Domaine)) : « **Maxi :** Nombre de Sorts disponibles dans le Domaine de Magie du
   Chaos choisi » ; `l.708` : « Lorsque vous prenez ce Talent, qui coûte à chaque fois 100 PX, vous apprenez un autre
   Sort du Domaine choisi et gagnez un Point de Corruption. […] Dans des conditions normales, vous ne pouvez connaître
   qu'un seul Savoir de Magie chaotique. »
   Question : quels sont le Maxi, le coût et la borne des parenthèses de Magie du Chaos ? Le nombre de Sorts du Domaine
   choisi ; 100 PX à chaque fois ; un seul Domaine.
7. `LDB 07 l.105` : « **Les Augmentations de Talent coûtent 100 PX + 100 PX par Augmentation** déjà achetée pour ce
   Talent. » ; table `l.156` : « 100 PX +100 PX par fois où le Talent a déjà été pris ».
   Question : sur quoi se compte le coût ? Sur le Talent, toutes parenthèses confondues, sauf le coût fixe qu'une entrée
   imprime (`l.708`).

## Cas canonique déjà couvert

- `talentMaxById` (`src/engine/careerSlots.ts:367-371`) lit le Maxi que DÉCLARE l'entrée effective (`effectiveEntry`,
  `src/engine/variants.ts`, variantes AA 13 l.54-59) : c'est déjà une déclaration de l'entrée, lue par un seul code.
  Les nouvelles déclarations (D2) en sont des instances, sur la même entrée, par la même lecture.
- `acquerirTalent` (`careerSlots.ts:405`) : seule couture qui écrit `talents`, bornée par `talentMaxReached` (`:388`).
- La porte des Domaines : `heldArcaneDomains`, `arcaneDomainCap`, `arcaneDomainGate` (`careerSlots.ts:429-470`),
  LDB 46 l.177 déjà codé depuis la donnée. Elle devient une porte NOMMÉE du registre de D2, sans changer de règle.
- Motif de refus typé : `RefusDEmplacement` (`careerSlots.ts:299`) ; D3 en suit la forme.
- Coût : `talentCost` (`src/engine/advancement.ts:56`), et six sites qui recomptent une instance : `advancement.ts:95`,
  `src/state/advancement.ts:188-189`, `:206`, `:214-215`, `src/engine/activities.ts:956`,
  `src/state/interludeFlow.ts:631`.

## Design

- **D1. Le compte.** `acquisitionsDuTalent(porteur, talentId)` : somme des `times` des instances PERMANENTES
  (`talents`). Un octroi temporaire (`activeEffects[].grantedTalent`, `src/engine/ops.ts:2222-2229`) n'est pas une
  acquisition. Seuls D3 et D4 lisent ce compte ; les lecteurs de `times` comme niveau d'effet ne changent pas.
- **D2. Les déclarations de l'entrée** (`src/data/schemas/defs/talents.ts`, lues par `effectiveEntry`) :
  - `max` gagne la forme « nombre de Sorts du Domaine de la parenthèse » (LDB 10 l.704) ; `magie-du-chaos` passe de `1`
    à cette forme.
  - `parentheses?: { plafond: number | NomDePorte }` : présent, le Maxi borne chaque parenthèse et `plafond` borne le
    nombre de parenthèses, par un nombre (`magie-du-chaos` : 1, LDB 10 l.708) ou par une porte du registre
    `PORTES_DE_PARENTHESES` (`domaines-arcaniques` = la porte des Domaines, LDB 46 l.177, sur `magie-des-arcanes`).
    Absent : le Maxi compte le Talent (LDB 10 l.18).
  - `interditDApprendre?: id[]` : posséder ce Talent défend d'acquérir ceux-là (`magie-des-arcanes` : `beni`,
    `invocation`, LDB 10 l.696-698 ; `invocation` : `magie-mineure`, `magie-des-arcanes`, LDB 10 l.625).
  - `coutFixe?: number` : le coût en PX de chaque acquisition (`magie-du-chaos` : 100, LDB 10 l.708).
  - `grantsArcaneDomain` meurt : `heldArcaneDomains` lit les Talents dont la porte est `domaines-arcaniques`. Le test
    `specsSource === 'arcaneDomains'` de `src/state/partyFlow.ts:482` meurt avec l'appel de la porte (D3).
  Chaque déclaration porte sa réf selon la convention des champs mécaniques de la donnée (question 4).
- **D3. Un verdict.** `refusDAcquisition(porteur, ref): RefusDAcquisition | undefined`, motif typé (`maxi`, `parentheses`,
  `porte` avec la raison de la porte, `interdit` avec le Talent qui défend), rendu en français par UNE fonction. Il lit
  les déclarations de D2 et n'a aucune branche par Talent. `acquerirTalent` rend ce refus (ou `undefined` quand il a
  écrit) au lieu d'un booléen ; ses 9 appelants se convertissent dans le même geste (`src/ui/creator/draft.ts:509`,
  `src/engine/corruption.ts:214`, `src/engine/character.ts:327`, `advancement.ts:98`, `ops.ts:2218`,
  `src/state/devtools.ts:1457`, `src/scenes/test-scenarios/entrainement.ts:56`, `:65`, `_casters.ts:36`) ; aucun
  appelant n'appelle le verdict PUIS la couture. `talentMaxReached` et `talentMax(hero, label)` meurent ; leurs sites
  (`partyFlow.ts:478`, `draft.ts:623`, `:638`, `character.ts:339`, `activities.ts:952`, `state/advancement.ts:189`,
  `:215`) lisent le verdict. Le booléen `maxReached` de `state/advancement.ts:82` devient le refus, que l'écran rend
  par la même fonction.
- **D4. Le coût.** `coutDuProchainTalent(porteur, talentId)` : `coutFixe` s'il est déclaré, sinon
  `talentCost(acquisitionsDuTalent(…))` (LDB 07 l.105) ; le paramètre de `talentCost` prend le nom du compte. Les six
  sites du cas canonique le lisent.
- **D5. Le porteur.** `PorteurDeTalents` porte ce que lisent les portes (espèce, Compétences, Sorts connus) ;
  `heldArcaneDomains`, `arcaneDomainCap` et `arcaneDomainGate` le prennent au lieu de `Combatant`. Les sondes de
  création (`character.ts:325`, `draft.ts:509`) le construisent.
- **D6. La création.** `rollRandomTalent` et `resolveSpeciesTalents` (`character.ts:139-162`) décident « déjà possédé,
  relance » par le verdict, jamais par `refKey` ; `createHero` et `probeHero` ne jettent plus un refus en silence.
- **D7. Les fabriques de scénario** (`_casters.ts`, `entrainement.ts`, `devtools.ts`) passent par la couture comme tout
  chemin : une sorcière à plusieurs Domaines reçoit espèce, Compétences et Sorts avant chaque Domaine, dans l'ordre de
  la maîtrise.
- **D8. Morts de la zone.** Paraphrases `careerSlots.ts:7-8`, `:361-363`, `activities.ts:938-943` (réf nue) ;
  réexport de `splitLabel` pour « importeurs historiques » (`careerSlots.ts:39-41`), dont les importeurs migrent.
- **Édition.** Toutes les bornes vivent dans la donnée du Talent ; une autre édition les déclare dans sa propre donnée.

## Tests exigés

- Haine : deux groupes font deux acquisitions ; au-delà du Bonus de FM, refus `maxi`.
- Sens aiguisé (Vue) puis (Ouïe) : comptés ensemble ; (Ouïe) coûte 200 PX.
- Magie des Arcanes : humain avec Feu, Métal refusé (`porte`), Domaine sombre admis ; elfe de Bonus de FM 3, Métal
  refusé avant la maîtrise de Feu, admis après ; le second Domaine coûte 200 PX.
- Magie du Chaos : jusqu'au nombre de Sorts du Domaine choisi, chacun à 100 PX ; un second Domaine refusé
  (`parentheses`).
- Exclusions : avec Magie des Arcanes, Béni refusé (`interdit`) ; avec Invocation, Magie mineure refusée ; avec Béni,
  Magie des Arcanes admise.
- Création : un halfling dont le Bonus d'Initiative borne Sens aiguisé voit le tirage suivant relancé, jamais perdu.
- Le refus passe par TOUS les chemins : achat, op `grantTalent`, création.

## Questions (réponse en sortie, citation ou sonde à l'appui)

1. Tout site de donnée ou de scénario (carrières, espèces, Signes, mutations, sorts, traits, statblocs, fabriques de
   `src/scenes/test-scenarios/`) où une acquisition serait maintenant refusée, avec la phrase du livre qui l'imprime.
2. Les livres autorisés portent-ils d'autres passages qui bornent ou ouvrent l'acquisition d'un Talent (« conditions
   normales » de Béni `l.109`, Invocation `l.625`, Magie du Chaos `l.708` ; « ne pouvez pas apprendre », « qu'un seul »,
   coût imprimé) ? Chacun devient une ligne de donnée de D2, ou se nomme.
3. Reste-t-il un site qui décide « Maxi atteint », recompte un coût, ou juge « déjà possédé » hors de D1, D3 et D4
   (contre-grep `.times`, `talentCost`, `owned.has(refKey(`) ?
4. La convention de réf d'un champ mécanique d'entrée de donnée (`fichier:ligne` d'un précédent).

---
_Generated by [Claude Code](https://claude.ai/code)_
