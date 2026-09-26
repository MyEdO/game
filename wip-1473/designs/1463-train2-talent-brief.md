# Design — train 2 du lot « ops à référence typées » : la référence de Talent (#1473, reprend #1646, intègre #1926), 2026-09-24

Arbre de lecture : `/home/claude/game/.wt-1473-r2v2-lecture`, détaché à `55d4ea7fc` (tête de #1897 qui porte les régimes de
`refOuSpec`). Toutes les réfs `fichier:ligne` sont de cet arbre sauf mention « r1 » (`chantier/1473-r1`, `9f12595f6`).
Base du codeur : `chantier/1473-r2` APRÈS la fusion de #1897 (tête courante `4e34ea4ff`) dans `chantier/1473-r1` corrigé ;
les régimes de `refOuSpec` n'existent pas sur r1.

Grounding : deux passes de lecteur (2026-09-24) puis relecture de l'orchestrateur. Chaque passage du `Source/` cité ici a été
ouvert par l'orchestrateur. La passe 2 du lecteur disait `sans-peur` sans `specsOpen` : c'est faux (`specsOpen: true`,
`src/data/talents.json`, entrée `sans-peur`).

## Invariant

1. #1646, corps du ticket, verbatim : « #1463 (directive 2026-08-23) : « un concept = une structure » et une porte — une
   ref de talent avec spec est le MÊME concept quel que soit son porteur (talents[] d'entité, passive d'une mutation/d'un
   trait, op d'un sort). » Question à laquelle il répond : comment s'écrit une référence de Talent, et qui juge sa
   spécialisation, quel que soit son porteur ?
2. #1897, verdict du juge de design 2e-f1, 2026-09-24 (issuecomment-5805081053, l.156 du corps), verbatim : « `choix`
   s'ouvre sur opt-in, en une ligne, aux seuls porteurs d'EMPLACEMENT ». Question : où une spécialisation peut-elle rester
   non désignée dans la donnée ? Réponse : là seulement où un chemin d'application la désigne.
3. `CLAUDE.md`, règle 7, verbatim : « une règle présente dans la source est IMPLÉMENTÉE, jamais reportée. » Question :
   que fait la donnée d'un effet que le livre imprime mais que l'op ne porte pas ?

## Cas canonique déjà couvert

- `OP_DEFS.grantCareerSkill` (r1, `src/data/schemas/grammaire/mecanique.ts:134`) :
  `z.strictObject({ op: z.literal('grantCareerSkill'), skill: refOuSpec('skill') })`, type moteur `src/engine/ops.ts:615`
  `{ op: 'grantCareerSkill'; skill: { id: string; spec?: string; choix?: true | string[] } }`. C'est l'analogue Compétence
  de `grantCareerTalent` (`ops.ts:617-619`, docblock « analogue Talent de `grantCareerSkill` »).
- Les Compétences de statbloc (`src/data/schemas/defs/creatures.ts:44`) :
  `refOuSpec('skill', { value: z.number() }, 'specOuChoixFacultatifs')`, emplacement désigné au spawn. Un porteur
  d'emplacement AVEC son désignateur. Côté Talent, le seul porteur déjà sur la fabrique est `pregens.careerTalent`
  (`src/data/schemas/defs/pregens.ts:32`, `refOuSpec('talent')`, régime `specSeule`).
- Le nouveau cas en est une instance : `grantTalent`, `grantCareerTalent` et `axes.talents` prennent la même fabrique
  `refOuSpec('talent', extra?, regime?)` (`src/data/schemas/grammaire/ref.ts:379-391`), le régime choisi par le porteur.
  Aucune branche neuve dans la fabrique.

## Constat mesuré

1. **Formes actuelles.**
   - `ops.ts:610` `{ op: 'grantTalent'; talentId: string; spec?: string }` ; `ops.ts:619` même forme pour `grantCareerTalent`.
   - `src/data/schemas/defs/axes.ts:26-30` : `talentRefSchema = z.strictObject({ talentId, spec? })` écrit à la main, avec
     la sémantique « absente = TOUTE spec compte », alors que la ligne au-dessus (`:24`) écrit `refOuSpec('skill')` pour les
     Compétences.
   - Les deux ops sont dans `OPS_NON_TYPEES` (`mecanique.ts:119-120`) ; leurs signatures sont au stock
     `scripts/guards/lib/structuresStock.mjs:1233-1259` (lot L1c #1468) ; `grantCareerTalent.talentId` est à
     `scripts/guards/lib/gameOpRefFk.mjs:102`.
2. **Les six sorts de #1926** (orchestrateur, `Source/` ouvert) :
   - Sagesse de la chouette, LDB 43 l.307 : « gagnez +1 Talent Menaçant et +1 Talent Sens aiguisé (Vue). » Donnée :
     `spells.json` `sagesse-de-la-chouette.effects.steps[0].effect.ops[2] = {"op":"grantTalent","talentId":"sens-aiguise"}`.
   - Cœurs ardents, LDB 48 l.229 : « gagnent +1 Talent Coude-à-coude, Sans peur et Cœur vaillant tant que le Sort est
     actif. » Donnée : `ops[2]` `sans-peur`, `ops[3]` `coeur-vaillant` ; Coude-à-coude n'est porté que par une op
     `narrative` (`spells.json:4692`, « +1 Talent Coude-à-coude tant que le Sort est actif (arbitrage MJ) »). L'entrée porte
     aussi `variants` (texte `spells.json:4711`), sans aucune op `grantTalent`.
   - Flambeau de Vertu, LDB 43 l.129 : « gagnent le Talent Sans peur pendant que le Miracle est actif ». Donnée : `ops[1]`
     `sans-peur` nu.
   - Instincts animaux, LDB 43 l.186 : « vous gagnez +1 Talent Sens aiguisé (au choix) ». Donnée : `ops[0]` nu.
   - Traversée rapide, VDM 11 l.475 : « les Talents *Grimpeur* et *Bon marcheur (1 terrain au choix)* ». Donnée : `ops[2]`
     `bon-marcheur` nu.
   - Dévotion de la vierge guerrière, AA 06 l.495 : « gagnent +1 rang du Talent Sans peur (Ennemi). Cet ennemi peut être
     soit un individu en particulier, soit une espèce en particulier. » Donnée : `ops[0]` `sans-peur` nu.
   - Le Talent : LDB 10 l.1045 « Sans peur (Ennemi) » ; LDB 10 l.17 « S'il y a des parenthèses, le mot à l'intérieur décrit
     une utilisation que le Talent influence. » Catalogue `sans-peur` : `specsOpen: true`, dont `tout` (note de source
     « LDB 08 l.1472 », ligne de pré-tiré « **Talents :** Frénésie, Maniement de deux armes, Sans peur ») ; MDG 16 l.403
     imprime « Sans peur (Tout) ».
   - Le Sans peur nu (Flambeau, Cœurs ardents) est un arbitrage de RÈGLE posé à Clément le 2026-09-24 (carte de décision du
     fil, recommandation « Tout »). La donnée suit sa réponse, consignée à #1926 avec sa date.
3. **Choix au lancement : aucun mécanisme.** `ops.ts:2208` (case `grantTalent`) pose `o.spec` tel quel ; `specChoices`
   (`src/engine/character.ts:253`) n'est lu qu'à la création (`character.ts:290-296` `resolveEntry`, `:353`) ; sonde du
   lecteur : `grep -rn "specChoices" src/state/*.ts` → 0 (périmètre : `src/state/*.ts`). `OptionChooser` sert le choix des
   cibles dans `src/ui/CastModal.tsx:270`.
4. **Les Deux Bœufs.** ADE II 03 l.235 : « vous gagnez un niveau dans le Talent Maître artisan (Vous n'êtes pas obligé de
   choisir le Métier correspondant à ce Talent pour le moment, mais vous devriez le faire après avoir déterminé votre
   Carrière de départ.) » Donnée : `stars.json` `les-deux-boeufs` `{"op":"grantTalent","talentId":"maitre-artisan","spec":"Au choix"}`,
   que `SENTINELLE_DE_SPEC` (`ref.ts:271`) refuse. Créateur : `src/ui/creator/draft.ts:698-699`, la carrière précède le
   signe ; `src/ui/creator/CharacterCreator.tsx:1275` clé `grantChoice = talentConcrete(o)`, un LIBELLÉ ;
   `character.ts:353` `applyStarOps(opts.starId, chars, (label) => addTalent(resolveEntry(label, opts.specChoices)))`.
   Cet aller-retour id→libellé→id appartient à #1924 (lot 2e-g1 de #1897, verdict issuecomment-5806102984, point 1.3).
5. **Crête sur la tête.** EDOC 12 l.84 (table des mutations) : « Gagne le Talent Attirant avec les mutants et les
   hommes-bêtes ». Donnée : `mutations.json` `crete-sur-la-tete.passive[0]`
   `{"op":"grantTalent","talentId":"attirant","spec":"Mutants et hommes-bêtes"}`. `attirant` a `specs: []` ; son
   `test.matches` vaut `[{ skill: { id: 'charme' }, manual: true }]` et `matchApplies` rend `false` sur `manual`
   (`src/engine/magic.ts:338`). `groups.json` a `homme-bete` (l.48), aucun `mutant` (sonde du lecteur, 37 ids). L'algèbre de
   Conditions a `{ kind: 'has'; who; what: 'group' | 'talent' | 'trait' | 'psych'; value; spec? }`
   (`src/engine/flowCore.ts:209`). `TalentInstance` = `{ talentId; spec?; times }` (`src/engine/types.ts:299-303`),
   sérialisé en bloc avec le `Combatant`.
6. **Lecteurs de `talentId`/`spec` sur ces ops** (grep, hors tests) : `ops.ts:2208` ; `src/engine/creation.ts:198`
   (`talentConcrete(op)`, `src/data/index.ts:3610`) ; `src/engine/corruption.ts:209,236` ;
   `src/engine/talentEffects.ts:187-210` ; `src/state/seaVoyageFlow.ts:2552` (op littérale) ;
   `scripts/data/lib/obtainabilityGraph.ts:63-78` ; `src/ui/editor/GameOpEditor.tsx:1051-1055` ;
   `src/ui/compendium/CodexEdit.tsx:1144-1163` (`TalentSpecListField`, axes). À re-mesurer par le codeur, pas à croire.
7. **Éditeurs.** `GameOpEditor.tsx:1051-1055` édite `grantTalent` par `RefField` `{ ds: 'talents', single: true, spec: true }` ;
   `src/ui/compendium/RefField.tsx:112-139` écrit la spec dans un `<input>` TEXTE libre. `TalentSpecListField` et
   `SkillSpecListField` (`CodexEdit.tsx`) réécrivent chacun à la main la paire `<select>` + `<input>` au lieu de lister des
   `RefField`. `OP_REF_FIELDS` (`GameOpEditor.tsx:579-608`) est une 4e source de vérité des champs à référence, commentée
   sur #1468 (issuecomment-5806420655).
8. **Une troisième graphie : `talentRefSchema`.** `src/data/schemas/grammaire/reference.ts:39` :
   `z.strictObject({ id: z.string(), spec: z.string().optional(), times: z.number().optional() })`, hors fabrique, lu par
   `creatures.ts:74` (`talents`) et `defs-scenes/communs.ts:59`. `axes.ts:26` déclare un AUTRE `talentRefSchema` du même
   nom et d'une autre forme. `src/data/spec-pool-contrat.test.ts:153-155`, verbatim : « `talentRefSchema` n'a pas de
   régime `choix`, et les 5 « Au choix » de `maitre-artisan` survivent à #1457 […] — leur extinction demande le régime
   `choix` des réfs de Talent, reporté à #1621 ». `defs-scenes/narratif.ts:125-127` : « 12 sentinelles mesurées dans
   `creatures.json` ». Mesures de l'orchestrateur : 1724 réfs de Talent dans `creatures.json › talents[]`, dont 12 à
   sentinelle « au choix » ; le stock `SPECS_DE_TALENT_A_CREER` (`src/data/refs-migrated.test.ts:837-843`) compte 5
   entrées, dont trois `bon-marcheur` à borne imprimée (« ForêtouPlaine », « PlaineOUForêt »), que le commentaire
   `:825` garde parce qu'une sentinelle libre « perd la BORNE imprimée ».

## Design proposé

**E1. Graphie.** `grantTalent: { op, talent: refOuSpec('talent', undefined, 'specOuChoixFacultatifs') }` ;
`grantCareerTalent: { op, talent: refOuSpec('talent') }` (régime `specSeule` : aucune donnée n'y porte `choix`, à mesurer) ;
`axes.talents: z.array(refOuSpec('talent'))`, la sémantique « spec absente = toute spec » restant au lecteur. La clé
`talent` suit `grantCareerSkill.skill`. Le type moteur est le type de la fabrique (`RefASpecialisation`, `ref.ts:262`), jamais
un type parallèle. Migration datée sous `scripts/migrations/` pour toute la donnée (`spells`, `stars`, `mutations`,
`traits`, `tables`, `trappings`, `talents`, scènes, `axes.json`), jouée par le job `migrations`. Les deux ops sortent
d'`OPS_NON_TYPEES` ; leurs lignes de `structuresStock.mjs` et `gameOpRefFk.mjs:102` meurent.

**E2. `choix` sur `grantTalent` est un EMPLACEMENT.** Tout chemin qui applique l'op le désigne AVANT `applyOps` ; un
`choix` qui atteint `applyOps` non désigné est un refus NOMMÉ, jamais un Talent nu posé en silence. Désignateurs :
(a) la création (signe astral) : existe, keyé par libellé, ses clés migrent avec #1924 ; ce train ne change que la lecture
de la nouvelle graphie par `talentConcrete` ; (b) le lancement de sort : absent, c'est le train 3 ; (c) tous les autres
porteurs (passives de mutation et de trait, tables, possessions, scènes, `seaVoyageFlow`) n'ont pas de désignateur : un test
de contrat, mesuré par le parse de mesure, y refuse `choix`.

**E3. Donnée de ce train.** Sagesse de la chouette : `{ id: 'sens-aiguise', spec: 'vue' }`. Cœurs ardents : une op
`grantTalent` `coude-a-coude` rejoint les deux autres, le fragment « Coude-à-coude … (arbitrage MJ) » quitte la
`narrative`. Les Deux Bœufs : `{ id: 'maitre-artisan', choix: true }`. Sans peur nu (Flambeau, Cœurs ardents) : la `spec`
de la réponse de Clément ; si elle est « Au choix », les deux sorts rejoignent le train 3. Instincts animaux, Traversée
rapide, Dévotion : restent nus dans ce train et reçoivent leur `choix` au train 3 avec leur désignateur, sinon E2 les
refuserait au lancement.

**E4. Crête sur la tête : un public n'est pas une spécialisation.** Candidat : la restriction d'application d'un Talent
octroyé s'écrit dans l'algèbre de Conditions existante, `grantTalent.when?: Condition`, portée par l'instance
(`TalentInstance.when?`) et lue par `matchApplies` en plus de `manual`. Attirant restant `manual`, le public s'AFFICHE avec
le Talent (fiche) et ne se calcule pas. « Mutants » n'a ni groupe ni prédicat `has` : il manque un `what`.

**E5. Lecteurs.** Chaque lecteur du constat 6 lit `op.talent` ; `talentConcrete` prend la référence de la fabrique.

**E6. Éditeurs, zone touchée aux normes.** `TalentSpecListField` et `SkillSpecListField` deviennent des listes de
`RefField` ; `GameOpEditor` édite `talent`. Le `<input>` libre de `RefField` pour la spec reste en l'état dans ce train.

**E7. Le concept Talent a UNE graphie.** `talentRefSchema` (`reference.ts:39`) devient
`refOuSpec('talent', { times: z.number().optional() }, <régime du porteur>)` ; statbloc en `specOuChoixFacultatifs`
(emplacement désigné au spawn, à l'image des Compétences, `creatures.ts:44`) ; les 12 sentinelles deviennent `choix: true`,
les bornes imprimées `choix: [ids]` (le stock de 5 s'éteint si chaque borne a ses ids au catalogue). Le doublon de nom
d'`axes.ts` meurt avec E1. Ce qui reste de #1621 et de l'angle mort de #1646 se solde ici.

## Questions au juge

1. E1 : `grantCareerTalent` en `specSeule`, alors que `grantCareerSkill` ouvre `choix` (#1897, l.156) : incohérence
   entre analogues, ou juste parce que la donnée n'en porte pas ?
2. E2 : refuser `choix` par porteur au PARSE (le schéma du porteur choisit le régime de l'op qu'il contient) ou par un test
   de contrat sur la mesure du parse ? Le premier suppose qu'une op connaisse son porteur : est-ce une couture qui existe ?
3. E2 : le refus nommé à l'application est-il le bon filet, ou double-t-il la garde du parse (credo : « Une garde de
   synchronisation est un smell : une seule source de vérité ») ?
4. E3 : laisser nus trois sorts que le livre dit « au choix » jusqu'au train 3 est-il un report de règle (règle 7), ou un
   séquençage légitime puisque les deux trains se publient ensemble ?
5. E4 : `when` sur l'instance, ou autre forme ? Quel prédicat pour « mutant » : un `what: 'mutation'` sur `has`, un groupe
   `mutant` dans `groups.json`, ou autre ? Le livre définit-il qui est « mutant » (chercher au `Source/`) ? Crête sur la tête
   est-elle une instance d'une CLASSE (octrois restreints à un public ailleurs dans la donnée) ?
6. E6 : l'`<input>` libre de `RefField` laisse écrire une spec hors catalogue que le parse refusera ensuite ; le rendre
   catalogue (`specOptionsFor` du créateur) relève-t-il de ce train ? Et `OP_REF_FIELDS` : ce train change son entrée
   `grantTalent`, ou la dérive d'`OP_DEFS` ?
7. `variants` de Cœurs ardents (texte VDM, « Si une cible possède déjà l'un d'entre eux, elle gagne temporairement un niveau
   supplémentaire ») n'a aucune op : hérite-t-il des effets de la base, et le niveau temporaire est-il une règle que ce train
   doit porter ?

8. E7 : le spawn désigne-t-il aujourd'hui un Talent de statbloc « au choix » (`src/state/spawn.ts:164-168`,
   `talentsFromBook`), comme il le fait pour une Compétence ? Sinon, E7 ouvre `choix` sans désignateur, ce qu'interdit E2.
9. E7 : ce volet tient-il dans le même train que E1-E6, ou fait-il un train 2b (même lot, même publication) ?

## Trains et dépendances

- Train 2 (ce design) : E1, E2, E3 sans les trois sorts « au choix », E4, E5, E6, et E7 sauf si le juge le sépare en
  train 2b. Bloqué par la fusion de #1897 dans `chantier/1473-r2`.
- Train 3 : désignateur au lancement (Instincts animaux, Traversée rapide, Dévotion, et Sans peur nu si la réponse est
  « Au choix »), garde de classe de #1926, recette navigateur en joueur. Se publie avec le train 2.
- #1924 (lot 2e-g1 de #1897) : les clés de `specChoices` en ids, signe astral compris.

## Portes (geste joueur)

Lancer Sagesse de la chouette : la fiche montre Sens aiguisé (Vue). Lancer Cœurs ardents : Coude-à-coude apparaît.
Créer un héros né sous Les Deux Bœufs : le créateur demande le Métier et le héros a Maître artisan (ce Métier). Un
héros qui reçoit Crête sur la tête voit Attirant avec son public.
