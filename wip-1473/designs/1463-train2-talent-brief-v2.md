# Design v2 — train 2 du lot « ops à référence typées » : la référence de Talent (#1473, reprend #1646, #1621, intègre #1926), 2026-09-24

v1 (`1463-train2-talent-brief.md`) RÉFUTÉE par le juge de design le 2026-09-24 : 13 bloquants, dont 3 structurels
(E2 régime hors schéma, E4 second hôte `when`, texte d'instance sans régime unique), 0 écarté. Verdict :
`/mnt/project-files/dettes/1463-train2-juge-design.json`. La v2 repart des deux hôtes existants que le juge nomme et
tranche la classe du texte d'instance au `Source/`, que l'orchestrateur a rouvert pour chaque membre.

Arbre de lecture : `/home/claude/game/.wt-1473-r2v2-lecture`, détaché à `55d4ea7fc` (tête de #1897 qui porte les
régimes de `refOuSpec`). Base du codeur : `chantier/1473-r2` APRÈS la fusion de #1897 (tête courante `73eae8afe`)
dans `chantier/1473-r1` corrigé (`81e3f256f` et suivants). Les lignes se relisent à la tête de la fusion.

Tickets : #1646 « Specs de talent HORS talents[] : 18 porteurs {talentId, spec} … marche à étendre aux porteurs GameOp +
axes.json » ; #1621 « specsOpen par TYPE = faux verrou dans les DEUX sens … l'ouverture vit PAR ENTREE ; bloquant du lot
L3 #1463 » ; #1926 « Sorts : 6 grantTalent posent un talent à spécialisation SANS spécialisation (1 imprimée, 3 au
choix, 2 nues à arbitrer) — aucune garde » ; #1924 « Création de personnage : createHero rend les AdvancementRef (ids)
en LIBELLÉS puis les reparse ».

## Invariant

1. #1646, corps, verbatim : « une ref de talent avec spec est le MÊME concept quel que soit son porteur (talents[]
   d'entité, passive d'une mutation/d'un trait, op d'un sort) ». Question : comment s'écrit une référence de Talent,
   et qui juge sa spécialisation, quel que soit son porteur ?
2. #1897, verdict du juge de design 2e-f1 (issuecomment-5805081053), verbatim : « `choix` s'ouvre sur opt-in, en une
   ligne, aux seuls porteurs d'EMPLACEMENT ». Question : où une spécialisation peut-elle rester non désignée ? Là
   seulement où un chemin d'application la désigne, et c'est le SCHÉMA du porteur qui le déclare
   (`RegimeDeSpec`, `ref.ts:294`, « ce que le PORTEUR admet »).
3. LDB 10 l.17, verbatim : « **Nom du Talent (utilisation) :** la dénomination du Talent. S'il y a des parenthèses, le
   mot à l'intérieur décrit une utilisation que le Talent influence. » Question : que porte la parenthèse d'un Talent ?
   Sa spécialisation, dont l'hôte est `spec` et le catalogue `talents.json#[].specs`.
4. `CLAUDE.md`, règle 7 : « une règle présente dans la source est IMPLÉMENTÉE, jamais reportée ». Credo : « RAW qui
   définit une mécanique que le code contourne → DETTE : on implémente ou on ouvre l'issue ».

## Cas canonique déjà couvert

- La fabrique `refOuSpec(type, extra?, regime?)` (`ref.ts:379-391`) et ses régimes (`specSeule` par défaut,
  `specOuChoixFacultatifs`) ; porteurs : `creatures.ts:44` (Compétences de statbloc, `specOuChoixFacultatifs`,
  désignées au spawn par `designateSpec`, `src/state/spawn.ts:144`), `pregens.ts:32` (`refOuSpec('talent')`).
- La parenthèse restreinte à un public, soldée par un ID DE CATALOGUE sourcé à la phrase qui l'imprime : B3 de #1457,
  `talents.json` `savoir-vivre.specs` `disciples-de-tzeentch` (source `EDOC 13 l.524`) et `suivants-de-khorne`
  (`MDG 07 l.250`), commentés à `src/data/refs-migrated.test.ts:830-835`.
- Le catalogue OUVERT par entrée : marqueur `specsOpen` (`defs/talents.ts:24-26`, lu par `entreeOuverte`,
  `ref.ts:153-165`) : un catalogue imprimé non vide, et une spec en texte libre admise quand le livre ouvre la liste.

Le nouveau cas en est une instance : chaque parenthèse de Talent est une `spec`, désignée par la fabrique ; la seule
variable est le régime, déclaré par le porteur.

## Constat (ce qui corrige ou complète la v1)

1. **La classe « texte d'instance » (refs-migrated.test.ts:861-870, `PLAFOND = 24`, « le régime du champ texte
   d'instance se tranche à #1621 ») n'est pas UNE classe au `Source/`.** Membres mesurés : `destinee` ×21, `frenesie`
   ×3 (`creatures.json`), `attirant` ×1 (`mutations.json` `crete-sur-la-tete`). Aucun des trois n'a de catalogue.
   - Destinée, LDB 10 l.315 : « En accord avec votre MJ, proposez une Destinée appropriée. » ; l.319 : « Voici des
     exemples de Destinées pour vous aider à créer votre propre Talent Destinée : » puis dix exemples (l.321-330). Les
     21 textes viennent de statblocs de Middenheim (sources `middenheim`, pages 32 à 152). Le livre imprime donc un
     catalogue d'exemples ET ouvre la liste : c'est le régime `specsOpen` d'une entrée à catalogue.
   - Frénésie, LDB 10 l.502-506 : « **Maxi :** 1 / Vous pouvez entrer en *Frénésie* comme décrit à la page 190. »
     Les trois « Frénésie (à Volonté !) » viennent de `Source/Warhammer - Habitants & Creatures  du Vieux-Monde
     (Discord) PDF/58 - Clan Pestilens.md:123,209,298` (livre `frenchy-bzh`, pages 384-390), qui imprime une règle
     propre : « Le skaven est immunisé contre tous les États Psychologiques […] bénéficie d'une Action supplémentaire
     par Tour […] d'un Bonus de +1 Point de Dégâts […] subit un État « Fatigue » pendant une durée équivalente. »
     C'est une utilisation du Talent (LDB 10 l.17) avec sa propre mécanique.
   - Attirant, LDB 10 l.80-86 : « **Tests :** Test de Charme pour influencer ceux qui vous trouvent attirant. » ;
     EDOC 12 l.84 (Crête sur la tête) : « Gagne le Talent Attirant avec les mutants et les hommes-bêtes ». Le public
     restreint l'utilisation influencée : c'est le cas de `savoir-vivre|disciples-de-tzeentch`.
2. **Porteurs de `choix` mesurés** (sonde de l'orchestrateur sur `src/data/*.json`) : `stars.json` 1 `grantTalent`
   (Les Deux Bœufs, désigné à la création) ; `talents.json` 2 `grantCareerSkill` (désignés par la spec du Talent
   porteur, `talentEffects.ts:166-168`). Aucun autre. `gameOpSchema` est importé par 67 lignes de `defs/` et
   `defs-scenes/`.
3. Lecteurs et graphies du juge (bloquant 9) : `ActiveEffect.grantedTalent` (`src/engine/types.ts:859`, écrit
   `ops.ts:2231`, lu `combatFeatures/dispatch.ts:59-61`, `talentEffects.ts:226-228`) ; `TalentRef extends Ref`
   (`src/data/index.ts:3186`, lu `spawn.ts:166`) ; `axes.ts:82`, `src/ui/compendium/registry.ts:1508` ;
   `src/ui/compendium/opRows.ts:70-74`, `humanize.ts:393`, `src/ui/editor/GameOpEditor.tsx:679` ; 25 fichiers de `src`
   nomment `grantTalent` hors tests (le juge). Le codeur re-mesure, rien n'est à croire.
4. `bon-marcheur`, LDB 10 l.111-117 : « Les spécialisations courantes incluent : Littoral, Déserts, Marécages,
   Rocailleux, Toundra, Régions boisées. » (liste ouverte, `specsOpen: true`). Catalogue actuel sans `plaine` ; les 5
   entrées de `SPECS_DE_TALENT_A_CREER` impriment « Forêt OU Plaine » (`frenchy.bzh 26 l.366`, `l.413`, `l.686`,
   `l.950`, `l.1008`).

## Design

**E1. Graphie unique.** `grantTalent: { op, talent: <réf de Talent> }`, `grantCareerTalent: { op, talent: <réf> }`,
`axes.talents: z.array(<réf>)`, `talentRefSchema` (`grammaire/reference.ts:39`) et son homonyme d'`axes.ts:26-30`
deviennent tous `refOuSpec('talent', extra?, regime)`. La clé `talent` suit `grantCareerSkill.skill`. Le type moteur est
le type de la fabrique (`RefASpecialisation`, `ref.ts:262`) ; `TalentRef` (`index.ts:3186`) en dérive. Migration datée
sous `scripts/migrations/` pour toute la donnée, jouée par le job `migrations`. Les deux ops sortent d'`OPS_NON_TYPEES`.
`TalentInstance` (`{ talentId, spec?, times }`, `types.ts:299-303`) et `ActiveEffect.grantedTalent` (`types.ts:859`)
restent l'état runtime d'une instance ; leur clé est `(talentId, spec)` (`ops.ts:2217-2220`) et ne change pas.

**E2. Le régime est une décision de SCHÉMA du porteur (option B du juge).** `gameOpSchema` devient la valeur par
défaut d'une fabrique `gameOpSchemaDe(regime)`, mémoïsée par régime ; les ops dont une référence est un EMPLACEMENT
(`grantTalent.talent`, `grantCareerSkill.skill`) prennent le régime du schéma qui les parse, les conteneurs d'ops
(`delayed`, `zone`… via `z.lazy`) le propagent. `export const gameOpSchema = gameOpSchemaDe('specSeule')` : tout
porteur qui ne déclare rien refuse `choix` AU PARSE. Déclarent `specOuChoixFacultatifs`, une ligne chacun, les seuls
porteurs qui ont un désignateur : `defs/stars.ts` (création, `character.ts:353`) et `defs/talents.ts` (spec du Talent
porteur, `talentEffects.ts:166-168`). `grantCareerSkill`, admis partout aujourd'hui, rentre dans la même règle. Le
test de contrat par porteur et le refus à `applyOps` de la v1 n'existent pas. `OP_DEFS` reste l'export lu
statiquement (`champsDOpASlot`, docs) : ses feuilles ne dépendent pas du régime. Question en sortie : la mémoïsation
garde-t-elle l'identité de nœud qu'exige la mesure au parse (`opsDuParse`, `slotsDuParse`) ?

**E3. Chaque parenthèse de Talent est une `spec` ; la classe « texte d'instance » meurt.** Données, sourcées à la phrase
qui imprime chaque entrée (constat 1), sans libellé inventé :
- `destinee` : `specs` = les dix exemples de LDB 10 l.321-330 (ids slug, libellés verbatim), `specsOpen: true`
  (LDB 10 l.315) ; les 21 textes de `creatures.json` restent des `spec` en texte libre, admis par l'entrée ouverte.
- `frenesie` : `specs` = `a-volonte`, libellé « à Volonté ! », source `frenchy-bzh` p.384, note
  `Habitants & Creatures 58 l.123`. Sa mécanique propre n'est pas implémentée : ticket au gabarit #101, dédupliqué par
  label, avec la citation verbatim, lié à #1463 (« on implémente ou on ouvre l'issue »).
- `attirant` : `specs` = `mutants-et-hommes-betes`, libellé « Mutants et hommes-bêtes », source EDOC p. et note
  `EDOC 12 l.84` (le codeur relève le folio), `pool: false` comme `savoir-vivre|disciples-de-tzeentch`. Crête sur la
  tête écrit `{ id: 'attirant', spec: 'mutants-et-hommes-betes' }`. `attirant` reste `manual` (`magic.ts:338`) : le
  public s'affiche avec le Talent. Aucun `when`, aucun `gate`, aucun `what` neuf.
- `bon-marcheur` : `specs` gagne `plaine`, source `frenchy-bzh`, note `frenchy.bzh 26 l.366` ; les 5 bornes deviennent
  `choix: ['foret', 'plaine']`, et `SPECS_DE_TALENT_A_CREER` meurt.
Le test `PLAFOND = 24` et son commentaire meurent ; `refs-migrated.test.ts:815-870` se réécrit sur la seule règle
« toute spec de Talent résout au catalogue ou dans une entrée ouverte ».

**E4. Désignateur du spawn, un pour les deux types (bloquants 3, 5, 12).** `designateSpec` (`spawn.ts:144`) se
généralise sur `TypeEntite` : pool = `choix` borné, sinon le catalogue générique (`catalogueSpecs(type, id)` de
`ref.ts`, déjà importé par le moteur à `careerSlots.ts:33`, ou `specPoolOf` s'il couvre les deux types : dire lequel est
canonique, citation à l'appui). `talentsFromBook` prend la même `seed` que `skillsFromBook` (`spawn.ts:158`) et
l'appelle. Alors seulement les statblocs de Talent passent en `specOuChoixFacultatifs` (`creatures.ts:74`), les 12
sentinelles « au choix » deviennent `choix: true`, et la branche sentinelle de `defs-scenes/narratif.ts:120-127`
meurt.

**E5. Données des sorts de #1926.** Sagesse de la chouette : `{ id: 'sens-aiguise', spec: 'vue' }` (LDB 43 l.307).
Cœurs ardents : une op `grantTalent` `coude-a-coude` rejoint les deux autres, et le fragment « Coude-à-coude … (arbitrage
MJ) » quitte la `narrative` (LDB 48 l.229). Les Deux Bœufs : `{ id: 'maitre-artisan', choix: true }` (ADE II 03
l.235), parsé par `stars.ts` en `specOuChoixFacultatifs`. Sans peur nu (Flambeau, Cœurs ardents) : la `spec` de la
réponse de Clément, consignée verbatim et datée à #1926 ; sans réponse, ces deux ops restent telles quelles et le train
ne se publie pas. Instincts animaux, Traversée rapide, Dévotion : restent au train 3, qui livre le désignateur au
lancement ET la ligne `defs/spells.ts` en `specOuChoixFacultatifs` ; trains 2 et 3 se publient ensemble.

**E6. Lecteurs, rendu d'un emplacement (bloquants 6, 8).** Les lecteurs d'op lisent `op.talent` et appellent
`refConcrete('talents', o.talent)` ; `talentConcrete` reste la clé d'une `TalentInstance` (appelants
`CharCard.tsx:80`, `EntityChip.tsx:110`, `CharacterCreator.tsx:1850`, `character.ts:356`). Tout libellé d'une réf à
`choix` passe par `choixLabel` (`index.ts:3614-3620`, « SOURCE UNIQUE du rendu d'un `choix` ») : Les Deux Bœufs garde
`isUnresolvedChoice(...) === true` (`CharacterCreator.tsx:1275`, `creation.ts:198`), prouvé par un test promu de la
sonde `sonde-e3-deux-boeufs.mts` du juge. Les deux chemins d'application de `grantTalent` (mutation de `c.talents`,
`ops.ts:2208` ; lecture dérivée `traitGrantedTalents`, `talentEffects.ts:203-212`) lisent la même graphie.

**E7. Éditeurs, zone touchée aux normes (bloquant 13).** `TalentSpecListField` et `SkillSpecListField` deviennent des
listes de `RefField`. La spec de `RefField` (`RefField.tsx:112-139`, `<input>` libre) devient une liste tirée du
catalogue de l'entrée, avec saisie libre seulement pour une entrée `specsOpen` ; primitive : celle du créateur
(`specOptionsFor`) si elle est canonique, sinon le codeur dit laquelle, citation à l'appui. `OP_REF_FIELDS`
(`GameOpEditor.tsx:579-608`) : ses entrées des ops TYPÉES se dérivent d'`OP_DEFS` (règle générale, pas la seule entrée
`grantTalent`) ; il ne reste à la main que les ops d'`OPS_NON_TYPEES`, lot de mort #1468.

**E8. Ce qui meurt dans le geste (bloquant 10).** `gameOpRefFk.mjs:101-102` (`grantTalent.talentId`,
`grantCareerTalent.talentId`) ; `grammaireStock.mjs:79` ; les lignes `reference … talentId` de `structuresStock.mjs`
(`:251`, `:252`, `:439`, `:440`, `:534`, `:536`, `:549`, `:550`, `:580`, `:589`, `:613`, `:614`, `:636`, et
`:1233-1259`) ; `spec-pool-contrat.test.ts:153-157` ; `refs-migrated.test.ts:815-870` (réécrit, E3) ;
`grammaire/reference.ts:32-33` ; `narratif.ts:120-127` (E4). Le codeur re-mesure chaque ligne à la tête de la fusion
et nomme en sortie celles qui ont bougé.

## Questions au juge

1. E3 : la lecture « chaque parenthèse de Talent est une `spec` » tient-elle pour les trois membres, au `Source/` cité ?
   En particulier, Destinée : un catalogue d'EXEMPLES plus `specsOpen` est-il la bonne instance de l'entrée ouverte, et
   `talentMaxReached` (`ops.ts:2217`) par `(talentId, spec)` rend-il possible deux Destinées ?
2. E3 : Frénésie (à Volonté !) en spec plus ticket de mécanique, ou Talent distinct ? L'identité `(frenesie,
   a-volonte)` change-t-elle un lecteur de `has what:'talent'` (`flowCore.ts:209`) ?
3. E2 : la fabrique `gameOpSchemaDe(regime)` est-elle la seule couture, ou une op connaît-elle déjà son porteur
   ailleurs ? Coût N+1 : un porteur désignateur neuf = une ligne ?
4. E4-E5 : laisser trois sorts « au choix » au train 3, publié avec celui-ci, est-il un séquençage ou un report (règle 7) ?
5. `variants` de Cœurs ardents (VDM, « Si une cible possède déjà l'un d'entre eux, elle gagne temporairement un niveau
   supplémentaire ») : règle que ce train doit porter, ou dette à ticketer ?

## Trains et dépendances

- Train 2a : E1, E2, E3, E5 (sauf trois sorts), E6, E7, E8. Bloqué par la fusion de #1897 dans `chantier/1473-r2`.
- Train 2b : E4 (désignateur du spawn, statblocs, sentinelles), même lot, même publication.
- Train 3 : désignateur au lancement et `defs/spells.ts` en `specOuChoixFacultatifs`, garde de classe de #1926, recette
  navigateur en joueur. Se publie avec 2a et 2b.
- #1924 : clés de `specChoices` en ids, signe astral compris.

## Portes (geste joueur)

Lancer Sagesse de la chouette : la fiche montre Sens aiguisé (Vue). Lancer Cœurs ardents : Coude-à-coude apparaît.
Créer un héros né sous Les Deux Bœufs : le créateur demande le Métier, le héros a Maître artisan (ce Métier). Un
héros qui reçoit Crête sur la tête voit « Attirant (Mutants et hommes-bêtes) ». Un Moine de la peste en combat montre
« Frénésie (à Volonté !) ». Un Prêtre rôdeur de Taal a Bon marcheur (Forêt) ou (Plaine), le même à chaque projection.

## Réponse au verdict v1 (13 bloquants)

1. [structurel] `when` sur l'instance → E3 : public = spec de catalogue (précédent `savoir-vivre`), aucun second hôte.
2. [structurel] régime hors schéma → E2 : fabrique par régime, déclarée par le porteur, refus au parse.
3. `designateSpec` typé Compétence → E4.
4. [structurel] texte d'instance sans régime → Constat 1 et E3 : la classe se résout au `Source/` en `spec` pour ses
   trois membres ; le cliquet `PLAFOND` meurt.
5. Statblocs sans désignateur → E4, statblocs ouverts APRÈS le désignateur.
6. Deux Bœufs perd sa demande → E6 : `choixLabel`, test promu.
7. `when` terme concurrent → sans objet (aucun champ neuf).
8. `talentConcrete` doublon → E6.
9. Graphies non inventoriées → Constat 3, E1.
10. Retraits nommés incomplets → E8.
11. `plaine` absent → E3 : entrée sourcée, stock mort.
12. Désignateur absent (doublon de 3/5) → E4.
13. `<input>` libre reporté, `OP_REF_FIELDS` → E7.
